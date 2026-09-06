import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { reviewsApi, type ClientReview } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { EmptyState } from "@/components/ui/EmptyState";
import { resolveMediaUrl } from "@/lib/media";
import { safeBack } from "@/lib/navigation";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function Stars({ rating }: { rating: number }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={14}
          color={i <= rating ? colors.warning : colors.mutedForeground}
        />
      ))}
    </View>
  );
}

function ReviewCard({ review, onPress }: { review: ClientReview; onPress: () => void }) {
  const colors = useThemeColors();
  const photo = resolveMediaUrl(review.pro_profile_photo) ?? null;
  const initials = review.pro_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <AnimatedPressable
      onPress={onPress}
      style={{ backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 12, ...Shadows.card }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: withAlpha(colors.primary, 0.13), alignItems: "center", justifyContent: "center" }}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 44, height: 44 }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.primary }}>{initials}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
            {review.pro_name}
          </Text>
          {review.pro_activity_name ? (
            <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
              {review.pro_activity_name}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Stars rating={review.rating} />
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{fmtDate(review.created_at)}</Text>
      </View>

      {review.comment ? (
        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.foreground }}>{review.comment}</Text>
      ) : null}
    </AnimatedPressable>
  );
}

export default function ClientReviewsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reviews, setReviews] = useState<ClientReview[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await reviewsApi.getMineAsClient();
      if (cancelled) return;
      if (res.success && res.data) setReviews(res.data);
      else setError(true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Mes avis</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              Les avis que tu as laissés aux pros
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Chargement impossible"
            description="Impossible de récupérer tes avis pour le moment."
          />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title="Aucun avis"
            description="Après un rendez-vous, tu pourras laisser un avis à ta pro. Ils apparaîtront ici."
          />
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(r) => String(r.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
            renderItem={({ item }) => (
              <ReviewCard
                review={item}
                onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: String(item.pro_id) } })}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
