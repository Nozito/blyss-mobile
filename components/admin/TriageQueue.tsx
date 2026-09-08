import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminBooking, AdminMessageThreadListItem } from "@/lib/api";
import { ADMIN } from "@/constants/adminTheme";
import { SectionLabel } from "@/components/admin/SectionLabel";
import { Card } from "@/components/admin/Card";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { formatEUR } from "@/lib/format";

type FlaggedReview = { id: number; author_name: string; rating: number; comment: string | null; pro_name: string };

const MAX_PER_BLOCK = 3;

function timeLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Bouton d'action inline — plein (primaire) ou fantôme (secondaire). */
function MiniBtn({ label, icon, tone = "ghost", onPress, busy }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "solid" | "ghost";
  onPress: () => void;
  busy?: boolean;
}) {
  const solid = tone === "solid";
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={busy}
      style={{
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
        paddingVertical: 8, paddingHorizontal: 12, flex: 1,
        backgroundColor: solid ? ADMIN.accent : "transparent",
        borderWidth: 1, borderColor: solid ? ADMIN.accent : ADMIN.border,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy
        ? <ActivityIndicator size="small" color={solid ? ADMIN.accentInk : ADMIN.textSub} />
        : <>
            <Ionicons name={icon} size={13} color={solid ? ADMIN.accentInk : ADMIN.textSub} />
            <Text style={{ ...ADMIN.type.label, fontSize: 10, color: solid ? ADMIN.accentInk : ADMIN.textSub }}>{label}</Text>
          </>}
    </AnimatedPressable>
  );
}

function Block({ title, count, seeAll, children }: {
  title: string; count: number; seeAll: () => void; children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: ADMIN.space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ ...ADMIN.type.label, color: ADMIN.textSub }}>{title}</Text>
        {count > MAX_PER_BLOCK && (
          <AnimatedPressable onPress={seeAll}>
            <Text style={{ ...ADMIN.type.label, color: ADMIN.accent }}>Tout voir · {count}</Text>
          </AnimatedPressable>
        )}
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

/**
 * File d'attente actionnable du dashboard admin : confirmer une réservation,
 * lever un signalement d'avis ou de message — sans quitter l'accueil.
 * Ne rend rien si tout est traité.
 */
export function TriageQueue() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: pendingData, isLoading: loadingBookings } = useQuery({
    queryKey: ["admin-bookings-pending"],
    queryFn: () => adminApi.getBookings({ status: "pending", limit: 8 }),
    staleTime: 60_000,
  });
  const { data: reviewsData } = useQuery({
    queryKey: ["admin-reviews-flagged"],
    queryFn: () => adminApi.getReviews({ flagged: true, limit: 50 }),
    staleTime: 60_000,
  });
  const { data: threadsData } = useQuery({
    queryKey: ["admin-messages-flagged"],
    queryFn: () => adminApi.getMessageThreads({ flagged: true, limit: 50 }),
    staleTime: 60_000,
  });

  const pending = ((pendingData?.data as AdminBooking[] | undefined) ?? []).filter((b) => b.status === "pending");
  const reviews = (reviewsData?.data as FlaggedReview[] | undefined) ?? [];
  const threads = (threadsData?.data as AdminMessageThreadListItem[] | undefined) ?? [];

  const confirmMut = useMutation({
    mutationFn: (id: number) => adminApi.confirmBooking(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-bookings-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const ignoreReviewMut = useMutation({
    mutationFn: (id: number) => adminApi.ignoreReviewFlag(id),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-reviews-flagged"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const ignoreThreadMut = useMutation({
    mutationFn: (id: number) => adminApi.ignoreMessageFlag(id, { outcome: "dismissed" }),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-messages-flagged"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const total = pending.length + reviews.length + threads.length;
  if (loadingBookings && total === 0) return null;
  if (total === 0) {
    return (
      <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
        <SectionLabel>À traiter</SectionLabel>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="checkmark-circle" size={18} color={ADMIN.success} />
            <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub }}>Rien à traiter — tout est à jour.</Text>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
      <SectionLabel trailing={String(total)}>À traiter</SectionLabel>
      <Card>
        {pending.length > 0 && (
          <Block title="Réservations à confirmer" count={pending.length} seeAll={() => router.push("/(admin)/bookings")}>
            {pending.slice(0, MAX_PER_BLOCK).map((b) => (
              <View key={b.id} style={{ borderWidth: 1, borderColor: ADMIN.border }}>
                <View style={{ padding: 10, gap: 2 }}>
                  <Text style={{ ...ADMIN.type.name, fontSize: 13, color: ADMIN.text }} numberOfLines={1}>
                    {b.client_name ?? "Client"} · {b.service_name ?? "Prestation"}
                  </Text>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }} numberOfLines={1}>
                    {timeLabel(b.start_datetime)}{b.price ? ` · ${formatEUR(b.price, { cents: true })}` : ""}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: ADMIN.border }}>
                  <MiniBtn
                    label="Confirmer" icon="checkmark" tone="solid"
                    busy={confirmMut.isPending && confirmMut.variables === b.id}
                    onPress={() => confirmMut.mutate(b.id)}
                  />
                </View>
              </View>
            ))}
          </Block>
        )}

        {reviews.length > 0 && (
          <Block title="Avis signalés" count={reviews.length} seeAll={() => router.push("/(admin-tools)/reviews")}>
            {reviews.slice(0, MAX_PER_BLOCK).map((r) => (
              <View key={r.id} style={{ borderWidth: 1, borderColor: ADMIN.border }}>
                <View style={{ padding: 10, gap: 2 }}>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }} numberOfLines={1}>
                    {"★".repeat(Math.max(0, Math.min(5, r.rating)))} · {r.author_name} → {r.pro_name}
                  </Text>
                  {!!r.comment && (
                    <Text style={{ ...ADMIN.type.body, fontSize: 12, color: ADMIN.textSub }} numberOfLines={2}>{r.comment}</Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: ADMIN.border }}>
                  <MiniBtn
                    label="Ignorer" icon="close"
                    busy={ignoreReviewMut.isPending && ignoreReviewMut.variables === r.id}
                    onPress={() => ignoreReviewMut.mutate(r.id)}
                  />
                  <View style={{ width: 1, backgroundColor: ADMIN.border }} />
                  <MiniBtn label="Examiner" icon="arrow-forward" onPress={() => router.push("/(admin-tools)/reviews")} />
                </View>
              </View>
            ))}
          </Block>
        )}

        {threads.length > 0 && (
          <Block title="Conversations signalées" count={threads.length} seeAll={() => router.push("/(admin-tools)/messages")}>
            {threads.slice(0, MAX_PER_BLOCK).map((t) => (
              <View key={t.id} style={{ borderWidth: 1, borderColor: ADMIN.border }}>
                <View style={{ padding: 10, gap: 2 }}>
                  <Text style={{ ...ADMIN.type.name, fontSize: 13, color: ADMIN.text }} numberOfLines={1}>
                    {t.client_name} ↔ {t.pro_name}
                  </Text>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }} numberOfLines={1}>
                    {t.last_reason || t.last_reason_code || "Signalement"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: ADMIN.border }}>
                  <MiniBtn
                    label="Ignorer" icon="close"
                    busy={ignoreThreadMut.isPending && ignoreThreadMut.variables === t.id}
                    onPress={() => ignoreThreadMut.mutate(t.id)}
                  />
                  <View style={{ width: 1, backgroundColor: ADMIN.border }} />
                  <MiniBtn label="Examiner" icon="arrow-forward" onPress={() => router.push("/(admin-tools)/messages")} />
                </View>
              </View>
            ))}
          </Block>
        )}
      </Card>
    </View>
  );
}
