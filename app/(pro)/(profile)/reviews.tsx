import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useActionSheet } from "@/components/ui/ActionSheet";
import { useToast } from "@/components/ui/Toast";
import { safeBack } from "@/lib/navigation";
import { reviewsApi, type ProReview } from "@/lib/api";

function StarRow({ rating }: { rating: number }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={13}
          color={i <= rating ? colors.warning : colors.mutedForeground}
        />
      ))}
    </View>
  );
}

function ReviewCard({ review, onFlag }: { review: ProReview; onFlag: (review: ProReview) => void }) {
  const colors = useThemeColors();
  const dateLabel = new Date(review.created_at).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, ...Shadows.card }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 3 }}>
            {review.client_name}
          </Text>
          <StarRow rating={review.rating} />
        </View>
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{dateLabel}</Text>
      </View>

      {review.comment ? (
        <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 19, marginBottom: 10 }}>
          {review.comment}
        </Text>
      ) : null}

      {review.flagged_by_me ? (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
          backgroundColor: colors.warningLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
        }}>
          <Ionicons name="flag" size={12} color={colors.warningText} />
          <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: colors.warningText }}>Signalé, en cours d'examen</Text>
        </View>
      ) : (
        <AnimatedPressable
          onPress={() => onFlag(review)}
          accessibilityLabel="Signaler cet avis"
          style={{
            flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: colors.border,
          }}
        >
          <Ionicons name="flag-outline" size={13} color={colors.mutedForeground} />
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>Signaler</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

export default function ProReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const showActionSheet = useActionSheet();
  const { showToast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pro-reviews"],
    queryFn: () => reviewsApi.getMine(),
  });

  const flagMut = useMutation({
    mutationFn: (reviewId: number) => reviewsApi.flag(reviewId),
    onSuccess: (res) => {
      if (res.success) {
        showToast("Avis signalé, un admin va l'examiner.", "success");
        queryClient.invalidateQueries({ queryKey: ["pro-reviews"] });
      } else {
        showToast(res.message ?? "Impossible de signaler cet avis", "error");
      }
    },
    onError: () => showToast("Impossible de signaler cet avis", "error"),
  });

  const handleFlag = (review: ProReview) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    showActionSheet(
      {
        title: "Signaler cet avis ?",
        message: "Un administrateur va examiner cet avis et décidera de le supprimer ou de classer le signalement.",
        options: ["Annuler", "Signaler"],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 1,
      },
      (idx) => {
        if (idx === 1) flagMut.mutate(review.id);
      }
    );
  };

  const reviews = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Mes avis</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Avis laissés par tes clientes</Text>
          </View>
        </View>

        {error ? (
          <ErrorMessage message="Impossible de charger tes avis" />
        ) : isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : reviews.length === 0 ? (
          <View style={{
            alignItems: "center", paddingVertical: 40, gap: 8,
            backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
          }}>
            <Ionicons name="star-outline" size={28} color={colors.mutedForeground} />
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Aucun avis pour le moment</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} onFlag={handleFlag} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
