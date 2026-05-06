import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { specialistsApi, favoritesApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

const SERVICE_CHIPS = [
  { label: "Gel", query: "gel" },
  { label: "Manucure", query: "manucure" },
  { label: "French", query: "french" },
  { label: "Nail art", query: "nail art" },
  { label: "Semi-perm.", query: "semi-permanent" },
  { label: "Baby boomer", query: "baby boomer" },
];
const RATING_OPTIONS = [
  { label: "4+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

interface Specialist {
  id: number;
  business_name: string;
  specialty: string;
  city: string;
  rating: number;
  reviews_count: number;
  profile_image_url: string | null;
  cover_image_url: string | null;
  first_name: string;
  distance_km: number | null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function Chip({
  active,
  onPress,
  children,
  disabled,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: active ? Colors.primary : Colors.muted,
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </Pressable>
  );
}

function SkeletonCard() {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: Colors.card,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: `${Colors.border}66`,
        minHeight: 130,
        marginBottom: 12,
      }}
    >
      <View
        style={{ width: 108, backgroundColor: Colors.muted, flexShrink: 0 }}
      />
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <View
          style={{
            height: 16,
            width: "75%",
            backgroundColor: Colors.muted,
            borderRadius: 8,
          }}
        />
        <View
          style={{
            height: 12,
            width: "50%",
            backgroundColor: Colors.muted,
            borderRadius: 8,
          }}
        />
        <View
          style={{
            height: 12,
            width: "65%",
            backgroundColor: Colors.muted,
            borderRadius: 8,
          }}
        />
        <View
          style={{
            height: 36,
            backgroundColor: Colors.muted,
            borderRadius: 12,
            marginTop: "auto",
          }}
        />
      </View>
    </View>
  );
}

export default function SpecialistsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ search?: string; service?: string }>();

  const [searchInput, setSearchInput] = useState(params.search ?? "");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [serviceFilter, setServiceFilter] = useState(params.service ?? "");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [cityFilter, setCityFilter] = useState("");

  const { data: specialists = [], isLoading, isFetching } = useQuery<
    Specialist[]
  >({
    queryKey: [
      "specialists",
      debouncedSearch,
      cityFilter,
      serviceFilter,
      ratingFilter,
    ],
    queryFn: async () => {
      const res = await specialistsApi.getPros({
        limit: 100,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(cityFilter ? { city: cityFilter } : {}),
        ...(serviceFilter ? { service: serviceFilter } : {}),
        ...(ratingFilter > 0 ? { min_rating: ratingFilter } : {}),
      });
      if (!res.success || !res.data) return [];
      return (res.data as Array<Record<string, unknown>>).map((pro) => ({
        id: pro.id as number,
        business_name:
          (pro.activity_name as string) ||
          `${pro.first_name} ${pro.last_name}`,
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

  const hasActiveFilters = !!(
    searchInput ||
    cityFilter ||
    serviceFilter ||
    ratingFilter > 0
  );
  const activeFiltersCount =
    (cityFilter ? 1 : 0) +
    (serviceFilter ? 1 : 0) +
    (ratingFilter > 0 ? 1 : 0);

  const clearAll = useCallback(() => {
    setSearchInput("");
    setCityFilter("");
    setServiceFilter("");
    setRatingFilter(0);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Specialist; index: number }) => {
      const isFav = favoriteIds.has(item.id);
      const photo = item.cover_image_url ?? item.profile_image_url;
      return (
        <Animated.View entering={FadeIn.delay(Math.min(index * 40, 280))}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/specialist/[id]",
                params: { id: item.id },
              })
            }
            style={{
              flexDirection: "row",
              backgroundColor: Colors.card,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: `${Colors.border}66`,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 1,
              marginBottom: 12,
            }}
          >
            {/* Photo */}
            <View
              style={{
                width: 108,
                flexShrink: 0,
                backgroundColor: Colors.muted,
                minHeight: 130,
              }}
            >
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={[
                    `${Colors.primary}26`,
                    `${Colors.primary}14`,
                    "transparent",
                  ]}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 30,
                      fontWeight: "700",
                      color: `${Colors.primary}40`,
                    }}
                  >
                    {item.first_name[0]}
                  </Text>
                </LinearGradient>
              )}
              {/* Favorite */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  toggleFav.mutate(item.id);
                }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isFav
                    ? `${Colors.primary}E6`
                    : "rgba(0,0,0,0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={isFav ? "heart" : "heart-outline"}
                  size={12}
                  color="#fff"
                />
              </Pressable>
            </View>

            {/* Info */}
            <View
              style={{
                flex: 1,
                padding: 16,
                flexDirection: "column",
                minHeight: 130,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: Colors.foreground,
                    lineHeight: 20,
                  }}
                  numberOfLines={1}
                >
                  {item.business_name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.primary,
                    fontWeight: "500",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {item.specialty}
                </Text>

                {item.rating > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    <Ionicons name="star" size={11} color="#FBBF24" />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: Colors.foreground,
                      }}
                    >
                      {item.rating.toFixed(1)}
                    </Text>
                    {item.reviews_count > 0 && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.mutedForeground,
                        }}
                      >
                        · {item.reviews_count} avis
                      </Text>
                    )}
                  </View>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 6,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color={Colors.mutedForeground}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.mutedForeground,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {item.city}
                  </Text>
                  {item.distance_km != null && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: Colors.primary,
                        flexShrink: 0,
                      }}
                    >
                      {item.distance_km} km
                    </Text>
                  )}
                </View>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/specialist/[id]",
                    params: { id: item.id },
                  })
                }
                style={{
                  marginTop: 12,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: Colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
                >
                  Réserver
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [favoriteIds, router, toggleFav]
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Top bar */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingBottom: 20,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 16,
              backgroundColor: Colors.muted,
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: Colors.foreground,
                lineHeight: 22,
              }}
            >
              Expertes ongulaires
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
              {isFetching
                ? "Recherche en cours…"
                : `${specialists.length} experte${specialists.length > 1 ? "s" : ""} trouvée${specialists.length > 1 ? "s" : ""}`}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 48,
            borderRadius: 16,
            backgroundColor: Colors.muted,
            paddingHorizontal: 16,
            gap: 10,
            marginBottom: 16,
          }}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons
              name="search-outline"
              size={16}
              color={Colors.mutedForeground}
            />
          )}
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Nom, spécialité, ville…"
            placeholderTextColor={Colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <Pressable
              onPress={() => setSearchInput("")}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: `${Colors.foreground}1A`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={12} color={Colors.foreground} />
            </Pressable>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          style={{ marginBottom: 4 }}
        >
          {RATING_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={ratingFilter === opt.value}
              onPress={() =>
                setRatingFilter(ratingFilter === opt.value ? 0 : opt.value)
              }
            >
              <Ionicons
                name="star"
                size={12}
                color={
                  ratingFilter === opt.value ? "#fff" : "#FBBF24"
                }
                style={ratingFilter === opt.value ? {} : undefined}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "500",
                  color:
                    ratingFilter === opt.value
                      ? "#fff"
                      : Colors.foreground,
                }}
              >
                {opt.label}
              </Text>
            </Chip>
          ))}
          <Chip
            active={!!cityFilter}
            onPress={() => setShowCityPanel((p) => !p)}
          >
            <Ionicons
              name="location-outline"
              size={13}
              color={cityFilter ? "#fff" : Colors.foreground}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "500",
                color: cityFilter ? "#fff" : Colors.foreground,
              }}
            >
              {cityFilter || "Ville"}
            </Text>
          </Chip>
          {SERVICE_CHIPS.map((c) => (
            <Chip
              key={c.query}
              active={serviceFilter === c.query}
              onPress={() =>
                setServiceFilter(serviceFilter === c.query ? "" : c.query)
              }
            >
              {serviceFilter === c.query && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "500",
                  color:
                    serviceFilter === c.query ? "#fff" : Colors.foreground,
                }}
              >
                {c.label}
              </Text>
            </Chip>
          ))}
        </ScrollView>

        {/* City panel */}
        {showCityPanel && uniqueCities.length > 0 && (
          <View
            style={{
              paddingTop: 12,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {["", ...uniqueCities].map((city) => (
              <Chip
                key={city || "__all"}
                active={!city ? !cityFilter : cityFilter === city}
                onPress={() => {
                  setCityFilter(city === cityFilter ? "" : city);
                  setShowCityPanel(false);
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color:
                      (!city ? !cityFilter : cityFilter === city)
                        ? "#fff"
                        : Colors.foreground,
                  }}
                >
                  {city || "Toutes les villes"}
                </Text>
              </Chip>
            ))}
          </View>
        )}

        {/* Active filters */}
        {hasActiveFilters && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
              {activeFiltersCount > 0
                ? `${activeFiltersCount} filtre${activeFiltersCount > 1 ? "s" : ""} actif${activeFiltersCount > 1 ? "s" : ""}`
                : "Filtres actifs"}
            </Text>
            <Pressable
              onPress={clearAll}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="close" size={10} color={Colors.primary} />
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.primary,
                  fontWeight: "600",
                }}
              >
                Tout effacer
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* List */}
      {isLoading ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ScrollView>
      ) : specialists.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: Colors.muted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="search-outline" size={24} color={Colors.mutedForeground} />
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: Colors.foreground,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Aucun résultat
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: Colors.mutedForeground,
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
                backgroundColor: Colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}
              >
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
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
          style={{
            opacity: isFetching && specialists.length > 0 ? 0.5 : 1,
          }}
        />
      )}
    </View>
  );
}
