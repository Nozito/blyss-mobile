import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { safeBack } from "@/lib/navigation";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const BG     = ADMIN.bg;
const CARD   = ADMIN.surface;
const BORDER = ADMIN.border;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;

interface FlaggedReview {
  id: number;
  author_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  pro_name: string;
  flags_count: number;
}

function ReviewSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SkeletonBox width={40} height={40} borderRadius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width="40%" height={11} borderRadius={5} />
              <SkeletonBox width="60%" height={9} borderRadius={5} />
            </View>
          </View>
          <SkeletonBox width="100%" height={50} borderRadius={10} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SkeletonBox width="45%" height={36} borderRadius={10} />
            <SkeletonBox width="45%" height={36} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={12}
          color={i <= rating ? Colors.warning : TEXT3}
        />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-reviews-flagged"],
    queryFn: () => adminApi.getReviews({ flagged: true }),
  });

  const reviews: FlaggedReview[] = ((data?.data as FlaggedReview[] | undefined) ?? []);

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteReview(id),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      void qc.invalidateQueries({ queryKey: ["admin-reviews-flagged"] });
    },
    onError: () => setActionError("Impossible de supprimer cet avis."),
  });

  const ignoreMut = useMutation({
    mutationFn: (id: number) => adminApi.ignoreReviewFlag(id),
    onSuccess: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void qc.invalidateQueries({ queryKey: ["admin-reviews-flagged"] });
    },
    onError: () => setActionError("Impossible d'ignorer ce signalement."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={18} color={TEXT1} />
          </AnimatedIconButton>
          <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT1, letterSpacing: -0.6 }}>Avis signalés</Text>
          {!isLoading && reviews.length > 0 && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: `${Colors.destructive}18`, borderWidth: 1, borderColor: `${Colors.destructive}30` }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: Colors.destructive }}>{reviews.length}</Text>
            </View>
          )}
        </View>
        {actionError && <View style={{ marginTop: 8 }}><ErrorMessage message={actionError} /></View>}
      </View>

      {isLoading ? (
        <ReviewSkeleton />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 40 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
          ListEmptyComponent={
            <EmptyState
              icon="shield-checkmark-outline"
              title="Aucun avis signalé"
              description="Tous les signalements ont été traités."
            />
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER }}>
              {/* Author + rating */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${Colors.destructive}18`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.destructive }}>
                    {item.author_name[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT1, marginBottom: 3 }}>{item.author_name}</Text>
                  <StarRow rating={item.rating} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: `${Colors.destructive}15`, borderWidth: 1, borderColor: `${Colors.destructive}25` }}>
                  <Ionicons name="flag-outline" size={11} color={Colors.destructive} />
                  <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.destructive }}>{item.flags_count}</Text>
                </View>
              </View>

              {/* Pro name */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
                <Ionicons name="person-outline" size={12} color={TEXT3} />
                <Text style={{ fontSize: 11, color: TEXT3 }}>Spécialiste : <Text style={{ color: TEXT2, fontWeight: "600" }}>{item.pro_name}</Text></Text>
              </View>

              {/* Comment */}
              {item.comment && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                  <Text style={{ fontSize: 13, color: TEXT2, lineHeight: 19 }}>{item.comment}</Text>
                </View>
              )}

              {/* Date */}
              <Text style={{ fontSize: 10, color: TEXT3, marginBottom: 12 }}>
                {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </Text>

              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <AnimatedPressable
                  onPress={() => { setActionError(null); ignoreMut.mutate(item.id); }}
                  disabled={ignoreMut.isPending}
                  style={{ flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
                >
                  {ignoreMut.isPending
                    ? <ActivityIndicator size="small" color={TEXT2} />
                    : <Text style={{ fontSize: 12, fontWeight: "600", color: TEXT2 }}>Ignorer le signalement</Text>}
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => { setActionError(null); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); deleteMut.mutate(item.id); }}
                  disabled={deleteMut.isPending}
                  style={{ flex: 1, height: 38, borderRadius: 11, backgroundColor: `${Colors.destructive}18`, borderWidth: 1, borderColor: `${Colors.destructive}30`, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  {deleteMut.isPending
                    ? <ActivityIndicator size="small" color={Colors.destructive} />
                    : <>
                        <Ionicons name="trash-outline" size={13} color={Colors.destructive} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.destructive }}>Supprimer l'avis</Text>
                      </>}
                </AnimatedPressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
