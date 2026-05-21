import React, { useState, useMemo, useCallback, useRef, useEffect, Suspense } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, FlatList, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { specialistsApi, favoritesApi } from "@/lib/api";
import {
  SpecialistCard,
  type Specialist,
} from "@/components/screens/client/specialists/SpecialistCard";
import { FilterBar } from "@/components/screens/client/specialists/FilterBar";
import { SearchHeader, type ViewMode } from "@/components/screens/client/specialists/SearchHeader";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

const SpecialistsMapView = React.lazy(() =>
  import("@/components/screens/client/specialists/MapView").then((m) => ({ default: m.SpecialistsMapView }))
);

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function SpecialistsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ search?: string; service?: string }>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [serviceFilter, setServiceFilter] = useState(params.service ?? "");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8000,
        });
        setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // Pas de coords → fallback silencieux, recherche sans distance
      }
    })();
  }, []);

  const { data: specialists = [], isLoading, isFetching } = useQuery<Specialist[]>({
    queryKey: ["specialists", debouncedSearch, cityFilter, serviceFilter, ratingFilter, userCoords],
    queryFn: async () => {
      const res = await specialistsApi.getPros({
        limit: 100,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(cityFilter ? { city: cityFilter } : {}),
        ...(serviceFilter ? { service: serviceFilter } : {}),
        ...(ratingFilter > 0 ? { min_rating: ratingFilter } : {}),
        ...(userCoords ? { lat: userCoords.lat, lng: userCoords.lng, nearby: true } : {}),
      });
      if (!res.success || !res.data) return [];
      return (res.data as Array<Record<string, unknown>>).map((pro) => ({
        id: pro.id as number,
        business_name:
          (pro.activity_name as string) || `${pro.first_name} ${pro.last_name}`,
        specialty:
          (pro.specialty as string) ||
          (pro.activity_name as string) ||
          "Prothésiste ongulaire",
        city: (pro.city as string) || "",
        rating: Number(pro.avg_rating) || 0,
        reviews_count: Number(pro.reviews_count) || 0,
        profile_image_url: (pro.profile_photo as string | null) ?? null,
        cover_image_url: (pro.banner_photo as string | null) ?? null,
        first_name: pro.first_name as string,
        distance_km: (pro.distance_km as number | null) ?? null,
        lat: (pro.lat as number | null) ?? null,
        lng: (pro.lng as number | null) ?? null,
        min_price: (pro.min_price as number | null) ?? null,
      }));
    },
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: favoriteIds = new Set<number>() } = useQuery<Set<number>>({
    queryKey: ["favorites-ids"],
    queryFn: async () => {
      const res = await favoritesApi.getAll();
      if (!res.success || !res.data) return new Set<number>();
      return new Set<number>(
        (res.data as Array<{ pro_id: number }>).map((f) => f.pro_id)
      );
    },
    staleTime: 60_000,
  });

  const toggleFav = useMutation({
    mutationFn: async (proId: number) => {
      if (favoriteIds.has(proId)) await favoritesApi.remove(proId);
      else await favoritesApi.add(proId);
    },
    onMutate: async (proId: number) => {
      await queryClient.cancelQueries({ queryKey: ["favorites-ids"] });
      const prev = queryClient.getQueryData<Set<number>>(["favorites-ids"]);
      queryClient.setQueryData<Set<number>>(["favorites-ids"], (old = new Set()) => {
        const next = new Set(old);
        next.has(proId) ? next.delete(proId) : next.add(proId);
        return next;
      });
      return { prev };
    },
    onError: (_e: unknown, _id: number, ctx: { prev?: Set<number> } | undefined) => {
      if (ctx?.prev) queryClient.setQueryData(["favorites-ids"], ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites-ids"] });
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const uniqueCities = useMemo(
    () => [...new Set(specialists.map((s) => s.city).filter(Boolean))].sort(),
    [specialists]
  );

  const hasActiveFilters = !!(searchInput || cityFilter || serviceFilter || ratingFilter > 0);
  const activeFiltersCount =
    (cityFilter ? 1 : 0) + (serviceFilter ? 1 : 0) + (ratingFilter > 0 ? 1 : 0);

  const clearAll = useCallback(() => {
    setSearchInput("");
    setCityFilter("");
    setServiceFilter("");
    setRatingFilter(0);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Specialist; index: number }) => (
      <SpecialistCard
        item={item}
        isFav={favoriteIds.has(item.id)}
        index={index}
        onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: item.id } })}
        onToggleFav={() => toggleFav.mutate(item.id)}
      />
    ),
    [favoriteIds, router, toggleFav]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <SearchHeader
        searchInput={searchInput}
        onChangeText={setSearchInput}
        onBack={() => router.back()}
        count={specialists.length}
        isFetching={isFetching}
        viewMode={viewMode}
        onToggleView={() => setViewMode((v) => (v === "list" ? "map" : "list"))}
      />

      {/* FilterBar only in list mode */}
      {viewMode === "list" && (
        <FilterBar
          ratingFilter={ratingFilter}
          onRatingChange={setRatingFilter}
          cityFilter={cityFilter}
          showCityPanel={showCityPanel}
          onCityToggle={() => setShowCityPanel((p) => !p)}
          onCitySelect={(city) => {
            setCityFilter(city === cityFilter ? "" : city);
            setShowCityPanel(false);
          }}
          uniqueCities={uniqueCities}
          serviceFilter={serviceFilter}
          onServiceChange={setServiceFilter}
          hasActiveFilters={hasActiveFilters}
          activeFiltersCount={activeFiltersCount}
          onClearAll={clearAll}
        />
      )}

      {/* ── MAP VIEW ── rendered always when viewMode=map, hidden otherwise */}
      {viewMode === "map" && (
        <Suspense fallback={<ActivityIndicator color="#FE5D9D" style={{ flex: 1 }} />}>
          <SpecialistsMapView specialists={specialists} />
        </Suspense>
      )}

      {/* ── LIST VIEW ── kept mounted to avoid refetch on toggle */}
      <View style={{ flex: 1, display: viewMode === "list" ? "flex" : "none" }}>
        {isLoading ? (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </ScrollView>
        ) : specialists.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#F8F5F1",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="search-outline" size={24} color="#6D6D78" />
            </View>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#09090B",
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              Aucun résultat
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#6D6D78",
                textAlign: "center",
                lineHeight: 20,
                maxWidth: 240,
                marginBottom: 24,
              }}
            >
              {hasActiveFilters
                ? "Aucune experte ne correspond à ces critères."
                : "Aucune experte disponible pour le moment."}
            </Text>
            {hasActiveFilters && (
              <Pressable
                onPress={clearAll}
                style={{
                  paddingHorizontal: 24,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: "#FE5D9D",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  Voir toutes les expertes
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={specialists}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 100,
            }}
            showsVerticalScrollIndicator={false}
            style={{ opacity: isFetching && specialists.length > 0 ? 0.5 : 1 }}
          />
        )}
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}
