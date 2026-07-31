import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  specialistsApi,
  reviewsApi,
  instagramApi,
  clientApi,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { ReviewModal } from "@/components/ui/ReviewModal";
import { Colors, withAlpha } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

function photoUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function getRelativeDate(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks} ${weeks > 1 ? "semaines" : "semaine"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(days / 365);
  return `il y a ${years} ${years > 1 ? "ans" : "an"}`;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={13}
          color={i <= rating ? Colors.primary : Colors.disabled}
        />
      ))}
    </View>
  );
}

export default function SpecialistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const heartScale = useRef(new Animated.Value(1)).current;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showReviewModal, setShowReviewModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["specialist", id],
    queryFn: () => specialistsApi.getProById(Number(id)),
    enabled: Boolean(id),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => reviewsApi.getBySpecialist(id!),
    enabled: Boolean(id),
  });

  const { data: servicesData } = useQuery({
    queryKey: ["services", id],
    queryFn: () => specialistsApi.getServices(Number(id)),
    enabled: Boolean(id),
  });

  const { data: igData } = useQuery({
    queryKey: ["instagram", id],
    queryFn: () => instagramApi.getPublicPhotos(Number(id)),
    enabled: Boolean(id),
  });

  const { isFavorited: isFavoritedFn, toggle: toggleFavorite } = useFavorites();

  const { data: myBookingsData } = useQuery({
    queryKey: ["client-bookings"],
    queryFn: () => clientApi.getMyBookings(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const pro = data?.data as Record<string, unknown> | undefined;

  // Response: { success, data: [...reviews], meta: { total } }
  const rawReviews = reviewsData?.data;
  const reviews: Array<Record<string, unknown>> = Array.isArray(rawReviews)
    ? (rawReviews as Array<Record<string, unknown>>)
    : [];
  const reviewsMeta = (reviewsData as Record<string, unknown> | undefined)?.meta as
    | Record<string, unknown>
    | undefined;

  const igPhotos = (
    (igData?.data as Record<string, unknown> | undefined)?.photos ??
    (igData as Record<string, unknown> | undefined)?.photos
  ) as Array<Record<string, unknown>> | undefined;
  const isFavorited = isFavoritedFn(Number(id));

  const myBookings = Array.isArray(myBookingsData?.data)
    ? (myBookingsData.data as Array<Record<string, unknown>>)
    : [];
  const hasCompletedBooking = myBookings.some(
    (b) => Number(b.pro_id) === Number(id) && b.status === "completed"
  );

  const toggleFav = () => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 80, bounciness: 10 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 0 }),
    ]).start();
    toggleFavorite(Number(id));
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!pro) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 15, color: Colors.mutedForeground }}>Spécialiste introuvable</Text>
        <Pressable onPress={() => safeBack(router)}>
          <Text style={{ color: Colors.primary, fontWeight: "700" }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  // Vrai format API (aligné avec specialists.tsx) : { activity_name, city,
  // rating, reviews_count, profile_image_url, cover_image_url, bio,
  // first_name, last_name } — les champs "business_name" et "user.first_name"
  // n'existent pas dans la réponse réelle, d'où le fallback "Profil" qui
  // s'affichait systématiquement à la place du nom de la pro.
  const firstName = String((pro?.first_name as string | null) ?? "la pro");
  const lastName = String((pro?.last_name as string | null) ?? "");
  const displayName = String(
    (pro?.activity_name as string | null) ??
    (firstName !== "la pro" ? `${firstName} ${lastName}`.trim() : null) ??
    "Profil"
  );
  const proAvgRating: number | null = pro?.avg_rating != null ? Number(pro.avg_rating) : null;
  const proCity = String((pro?.city as string | null) ?? "");
  const addressVisible = Boolean(pro?.address_visible);
  const proAddressLine = (pro?.address_line as string | null) ?? null;
  const proServiceRadiusKm = (pro?.service_radius_km as number | null) ?? null;
  const proServiceAreaLabel = (pro?.service_area_label as string | null) ?? null;
  const specialty = (pro?.specialty as string | null) ?? null;
  const avatarUrl = photoUrl((pro?.profile_photo as string | null));
  const bannerUrl = photoUrl((pro?.banner_photo as string | null));
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const services: unknown[] = Array.isArray(servicesData?.data)
    ? (servicesData.data as unknown[])
    : [];

  const reviewsCount =
    (reviewsMeta?.total as number | undefined) ??
    (reviews.length > 0 ? reviews.length : Number(pro?.reviews_count ?? 0));

  const minPrice = services.reduce<number | null>((min, s) => {
    const price = Number((s as Record<string, unknown>).price ?? (s as Record<string, unknown>).prixBase ?? NaN);
    if (Number.isNaN(price)) return min;
    return min == null ? price : Math.min(min, price);
  }, null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
    >
      {/* Hero banner */}
      <View style={{ height: 200, backgroundColor: withAlpha(Colors.primary, 0.13) }}>
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles" size={48} color={withAlpha(Colors.primary, 0.25)} />
          </View>
        )}

        {/* Floating buttons */}
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: insets.top + 12,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.9)",
              alignItems: "center",
              justifyContent: "center",
              ...Shadows.card,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>

          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Pressable
              onPress={toggleFav}
              accessibilityLabel={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
              accessibilityRole="button"
              accessibilityState={{ checked: isFavorited }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.9)",
                alignItems: "center",
                justifyContent: "center",
                ...Shadows.card,
              }}
            >
              <Ionicons
                name={isFavorited ? "heart" : "heart-outline"}
                size={20}
                color={isFavorited ? Colors.primary : Colors.foreground}
              />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* Avatar + identity */}
      <View style={{ alignItems: "center", marginTop: -44 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            backgroundColor: withAlpha(Colors.primary, 0.13),
            borderWidth: 3,
            borderColor: Colors.white,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            ...Shadows.card,
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 88, height: 88 }}
              contentFit="cover"
            />
          ) : (
            <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.primary }}>
              {initials}
            </Text>
          )}
        </View>

        {/* BUG 1 fix — always render name */}
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.foreground,
            marginTop: 12,
            textAlign: "center",
            paddingHorizontal: 24,
            letterSpacing: -0.4,
          }}
        >
          {displayName}
        </Text>

        {/* Rating row */}
        {proAvgRating != null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <StarRow rating={Math.round(proAvgRating)} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>
              {proAvgRating.toFixed(1)}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
              ({reviewsCount})
            </Text>
          </View>
        )}

        {/* City */}
        {Boolean(proCity) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Ionicons name="location-outline" size={13} color={Colors.mutedForeground} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>{proCity}</Text>
          </View>
        )}

        {/* Address privacy notice — the exact address only appears once a booking
            with this pro is confirmed (see app/booking/[id].tsx) */}
        {addressVisible && proAddressLine ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Ionicons name="pin-outline" size={13} color={Colors.mutedForeground} />
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>{proAddressLine}</Text>
          </View>
        ) : !addressVisible ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Ionicons name="lock-closed-outline" size={12} color={Colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
              Adresse non affichée publiquement
              {proServiceRadiusKm != null ? ` — rayon d'intervention ${proServiceRadiusKm} km` : ""}
              {proServiceAreaLabel ? ` (${proServiceAreaLabel})` : ""}
            </Text>
          </View>
        ) : null}

        {/* Specialty chip + starting price */}
        {(specialty || minPrice != null) && (
          <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
            {specialty && (
              <View
                style={{
                  backgroundColor: withAlpha(Colors.primary, 0.08),
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.primary }}>{specialty}</Text>
              </View>
            )}
            {minPrice != null && (
              <View
                style={{
                  backgroundColor: withAlpha(Colors.foreground, 0.06),
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>
                  Dès {minPrice.toFixed(0)}€
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Scrollable content sections */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 16 }}>
        {/* Bio */}
        {Boolean(pro?.bio) && (
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: 16,
              padding: 16,
              ...Shadows.card,
            }}
          >
            <Text style={{ fontSize: 13, color: Colors.foreground, lineHeight: 20 }}>
              {pro.bio as string}
            </Text>
          </View>
        )}

        {/* BUG 2 fix — firstName fallback */}
        <Pressable
          onPress={() => {
            if (!user) {
              router.push("/(auth)/login");
              return;
            }
            router.push({ pathname: "/booking", params: { proId: id } });
          }}
          style={{
            backgroundColor: Colors.primary,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 16 }}>
            Réserver avec {firstName}
          </Text>
        </Pressable>

        {/* BUG 3 / 5 fix — Prestations always rendered */}
        <View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: Colors.foreground,
              marginBottom: 12,
              letterSpacing: -0.3,
            }}
          >
            Prestations
          </Text>
          {services.length === 0 ? (
            <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>
              Aucune prestation renseignée
            </Text>
          ) : (
            <>
              {services.map((s) => {
                const svc = s as Record<string, unknown>;
                return (
                  <View
                    key={String(svc.id)}
                    style={{
                      backgroundColor: Colors.white,
                      borderRadius: 14,
                      padding: 16,
                      marginBottom: 10,
                      shadowColor: Colors.black,
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
                          {String(svc.name ?? svc.nom ?? "")}
                        </Text>
                        {svc.description != null && (
                          <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 3, lineHeight: 18 }}>
                            {String(svc.description)}
                          </Text>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                          <Ionicons name="time-outline" size={12} color={Colors.mutedForeground} />
                          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
                            {formatDuration(Number(svc.duration_minutes ?? svc.tempsBloque ?? 60))}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground }}>
                        {Number(svc.price ?? svc.prixBase ?? 0).toFixed(2)}€
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Instagram gallery */}
        {igPhotos && igPhotos.length > 0 && (
          <View>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "800",
                color: Colors.foreground,
                marginBottom: 12,
                letterSpacing: -0.3,
              }}
            >
              Instagram
            </Text>
            <FlatList
              horizontal
              data={igPhotos}
              keyExtractor={(item) => String(item.media_id)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: String(item.media_url) }}
                  style={{ width: 120, height: 120, borderRadius: 14, marginRight: 8 }}
                  contentFit="cover"
                />
              )}
            />
          </View>
        )}

        {/* BUG 5 fix — Avis always rendered */}
        <View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: Colors.foreground,
              marginBottom: 12,
              letterSpacing: -0.3,
            }}
          >
            Avis ({reviewsCount})
          </Text>
          {reviews.length === 0 ? (
            <Text style={{ color: Colors.mutedForeground, fontSize: 14 }}>
              Aucun avis pour le moment
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {reviews.slice(0, 5).map((r) => {
                const clientName = String(r.client_first_name ?? "Client");
                const initial = clientName[0]?.toUpperCase() ?? "C";
                return (
                  <View
                    key={String(r.id)}
                    style={{
                      backgroundColor: Colors.white,
                      borderRadius: 16,
                      padding: 16,
                      ...Shadows.card,
                    }}
                  >
                    {/* Header : avatar + nom à gauche, date à droite */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: "#FFD6D6",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#C0392B" }}>
                            {initial}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>
                            {clientName}
                          </Text>
                          <StarRow rating={Number(r.rating)} />
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                        {getRelativeDate(String(r.created_at))}
                      </Text>
                    </View>
                    {r.comment != null && (
                      <Text style={{ fontSize: 13, color: Colors.foreground, lineHeight: 20 }}>
                        {String(r.comment)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {hasCompletedBooking && (
            <Pressable
              onPress={() => setShowReviewModal(true)}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: withAlpha(Colors.primary, 0.25),
                borderRadius: 999,
                paddingVertical: 14,
                alignItems: "center",
                backgroundColor: Colors.white,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.primary }}>
                Laisser un avis
              </Text>
            </Pressable>
          )}
        </View>
      </View>
      <ReviewModal
        visible={showReviewModal}
        proId={id!}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["reviews", id] })}
      />
    </ScrollView>
  );
}
