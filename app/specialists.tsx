import React, { useState, useMemo, useCallback, useRef, useEffect, Suspense } from "react";
import { View, ScrollView, ActivityIndicator, FlatList, Animated, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { specialistsApi } from "@/lib/api";
import {
  SpecialistCard,
  type Specialist,
} from "@/components/screens/client/specialists/SpecialistCard";
import { FilterBar } from "@/components/screens/client/specialists/FilterBar";
import { SearchHeader, type ViewMode } from "@/components/screens/client/specialists/SearchHeader";
import { Colors } from "@/constants/colors";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFavorites } from "@/hooks/useFavorites";

const SpecialistsMapView = React.lazy(
  () => import("@/components/screens/client/specialists/MapView") as Promise<{ default: React.ComponentType<{ specialists: Specialist[] }> }>
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
  const params = useLocalSearchParams<{ search?: string; service?: string }>();
  const reduceMotion = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [reduceMotion]);

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

  const { data: specialists = [], isLoading, isFetching, refetch } = useQuery<Specialist[]>({
    queryKey: ["specialists", debouncedSearch, cityFilter, serviceFilter, ratingFilter, userCoords],
    queryFn: async () => {
      const res = await specialistsApi.getPros({
        limit: 100,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(cityFilter ? { city: cityFilter } : {}),
        ...(serviceFilter ? { service: serviceFilter } : {}),
        ...(ratingFilter > 0 ? { min_rating: ratingFilter } : {}),
        // lat/lng seuls (sans `nearby`) : le backend les utilise pour calculer/afficher
        // la distance sans filtrer — `nearby: true` excluait purement et simplement
        // tous les résultats dès que la position réelle de la cliente ne tombait pas
        // dans un rayon par défaut (ex. hors zone de test), affichant "aucune experte
        // disponible" alors que des pros existaient bel et bien.
        ...(userCoords && !cityFilter
          ? { lat: userCoords.lat, lng: userCoords.lng }
          : {}),
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
        lat: (pro.latitude as number | null) ?? null,
        lng: (pro.longitude as number | null) ?? null,
        min_price: (pro.min_price as number | null) ?? null,
        address_visible: Boolean(pro.address_visible),
        service_radius_km: (pro.service_radius_km as number | null) ?? null,
        service_area_label: (pro.service_area_label as string | null) ?? null,
      }));
    },
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
  });

  const { isFavorited, toggle: toggleFav } = useFavorites();

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
        isFav={isFavorited(item.id)}
        index={index}
        onPress={() => router.push({
          pathname: "/specialist/[id]",
          params: {
            id: item.id,
            ...(item.lat != null && item.lng != null ? { lat: String(item.lat), lng: String(item.lng) } : {}),
          },
        })}
        onBook={() => router.push({ pathname: "/booking", params: { proId: item.id } })}
        onToggleFav={() => toggleFav(item.id)}
      />
    ),
    [isFavorited, router, toggleFav]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <SearchHeader
        searchInput={searchInput}
        onChangeText={setSearchInput}
        onBack={() => safeBack(router)}
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

      {/* ── MAP VIEW ── */}
      {viewMode === "map" && (
        <Suspense fallback={<ActivityIndicator color={Colors.primary} style={{ flex: 1 }} />}>
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
          <EmptyState
            icon="search-outline"
            title="Aucun résultat"
            description={
              hasActiveFilters
                ? "Aucune experte ne correspond à ces critères."
                : "Aucune experte disponible pour le moment."
            }
            ctaLabel={hasActiveFilters ? "Voir toutes les expertes" : undefined}
            onCta={hasActiveFilters ? clearAll : undefined}
          />
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
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor={Colors.primary}
                progressViewOffset={10}
              />
            }
          />
        )}
      </View>
      </Animated.View>
    </SafeAreaView>
  );
}
