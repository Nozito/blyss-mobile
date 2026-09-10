import React, { useMemo, useState, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { adminApi, type AdminSubscriptionItem } from "@/lib/api";
import { ADMIN } from "@/constants/adminTheme";
import { Colors, withAlpha } from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { formatEUR, formatNumberFR } from "@/lib/format";

const BG = ADMIN.bg;
const CARD = ADMIN.surface;
const BORDER = ADMIN.border;
const TEXT1 = ADMIN.text;
const TEXT2 = ADMIN.textSub;
const TEXT3 = ADMIN.textMuted;
const MUTED = ADMIN.surfaceHover;

const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const SOURCE_LABELS: Record<string, string> = {
  store: "App Store / Play", granted: "Offert", internal: "Interne", seed: "Seed", other: "—",
};
const PLANS = ["signature", "serenite", "start"] as const;

type StatusFilter = "active" | "cancelled" | "all";
const STATUS_FILTERS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "active", label: "Actifs", color: Colors.success },
  { key: "cancelled", label: "Résiliés", color: TEXT2 },
  { key: "all", label: "Tous", color: ADMIN.accent },
];

const monthYear = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
};
const dayMonth = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

function Kpi({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <View
      style={{
        flex: 1, backgroundColor: hero ? ADMIN.accent : CARD,
        borderWidth: 1, borderColor: hero ? ADMIN.accent : BORDER,
        borderRadius: ADMIN.cardRadius, padding: ADMIN.space.md, gap: 6,
      }}
    >
      <Text style={{ ...ADMIN.type.label, fontSize: 9, color: hero ? ADMIN.accentSub : TEXT2 }}>{label}</Text>
      <Text style={{ ...ADMIN.type.mono, fontSize: hero ? 26 : 18, color: hero ? ADMIN.accentInk : TEXT1 }}>
        {value}
      </Text>
    </View>
  );
}

function SubCard({ item }: { item: AdminSubscriptionItem }) {
  const active = item.status === "active";
  const price = item.billingType === "monthly" ? item.monthlyPrice : item.totalPrice ?? item.monthlyPrice * 12;
  return (
    <View
      style={{
        backgroundColor: CARD, borderRadius: 12, borderWidth: 1,
        borderColor: active ? withAlpha(Colors.success, 0.28) : BORDER,
        padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: MUTED, overflow: "hidden" }}>
        {item.profilePhoto ? <Image source={{ uri: item.profilePhoto }} style={{ width: 40, height: 40 }} /> : null}
      </View>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ ...ADMIN.type.name, color: TEXT1 }} numberOfLines={1}>
          {item.proName || item.email}
        </Text>
        <Text style={{ fontSize: 11, color: TEXT2 }} numberOfLines={1}>
          {item.city ? `${item.city} · ` : ""}{PLAN_LABELS[item.plan] ?? item.plan} ·{" "}
          {item.isGranted ? "Offert" : SOURCE_LABELS[item.source] ?? item.source}
        </Text>
        <Text style={{ fontSize: 11, color: TEXT3 }}>
          depuis {monthYear(item.startDate)}
          {active
            ? item.endDate ? ` · renouv. ${dayMonth(item.endDate)}` : " · récurrent"
            : " · résilié"}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ ...ADMIN.type.mono, fontSize: 15, color: TEXT1 }}>
          {formatEUR(price)}
          <Text style={{ fontSize: 10, fontWeight: "600", color: TEXT2 }}>
            {item.billingType === "monthly" ? "/mois" : "/an"}
          </Text>
        </Text>
        <View
          style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3,
            backgroundColor: active ? withAlpha(Colors.success, 0.16) : MUTED,
          }}
        >
          <Text style={{ ...ADMIN.type.label, fontSize: 9, color: active ? Colors.success : TEXT2 }}>
            {active ? "Actif" : item.status === "pending" ? "Attente" : "Résilié"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AdminSubscriptionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("active");
  const [plan, setPlan] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ["admin-subscriptions", status, plan],
    queryFn: () => adminApi.getSubscriptions({ status, plan: plan ?? undefined }),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const res = data?.success ? data.data : undefined;
  const summary = res?.summary;
  const items = res?.items ?? [];
  const planTotal = useMemo(
    () => (summary ? summary.byPlan.start + summary.byPlan.serenite + summary.byPlan.signature : 0),
    [summary],
  );

  const header = (
    <View style={{ paddingTop: insets.top, paddingBottom: 12 }}>
      <AnimatedPressable
        onPress={() => safeBack(router)}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 }}
      >
        <Ionicons name="chevron-back" size={18} color={ADMIN.accent} />
        <Text style={{ ...ADMIN.type.label, fontSize: 12, color: ADMIN.accent }}>Retour</Text>
      </AnimatedPressable>
      <Text style={{ ...ADMIN.type.display, fontSize: 30, color: TEXT1, marginBottom: 14 }}>Abonnements</Text>

      {summary && (
        <>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <Kpi label="Revenu mensuel" value={formatEUR(summary.mrr)} hero />
            <Kpi label="Abonnés actifs" value={formatNumberFR(summary.activeCount)} />
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <Kpi label="Payants / offerts" value={`${summary.activeStore} / ${summary.activeFree}`} />
            <Kpi label="Annualisé (ARR)" value={formatEUR(summary.arr)} />
          </View>

          {/* Répartition plan */}
          <View style={{ backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: ADMIN.cardRadius, padding: 14, marginBottom: 14, gap: 10 }}>
            <Text style={{ ...ADMIN.type.label, fontSize: 9, color: TEXT2 }}>Répartition par formule</Text>
            {PLANS.map((p) => {
              const n = summary.byPlan[p];
              const pct = planTotal > 0 ? Math.round((n / planTotal) * 100) : 0;
              const on = plan === p;
              return (
                <AnimatedPressable
                  key={p}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setPlan(on ? null : p); }}
                  style={{ gap: 5, opacity: on || !plan ? 1 : 0.5 }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT1 }}>{PLAN_LABELS[p]}</Text>
                    <Text style={{ fontSize: 11, color: TEXT2 }}>{n} · {pct}%</Text>
                  </View>
                  <View style={{ height: 5, borderRadius: 2, backgroundColor: MUTED, overflow: "hidden" }}>
                    <View style={{ height: 5, borderRadius: 2, width: `${pct}%` as never, backgroundColor: ADMIN.accent }} />
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>

          {(summary.newThisMonth > 0 || summary.cancelledThisMonth > 0 || summary.expiring7d > 0) && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              <View style={{ flex: 1, alignItems: "center", backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: ADMIN.cardRadius, paddingVertical: 10 }}>
                <Text style={{ ...ADMIN.type.mono, fontSize: 16, color: TEXT1 }}>{summary.newThisMonth}</Text>
                <Text style={{ fontSize: 9, color: TEXT2 }}>nouveaux (mois)</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: ADMIN.cardRadius, paddingVertical: 10 }}>
                <Text style={{ ...ADMIN.type.mono, fontSize: 16, color: TEXT1 }}>{summary.cancelledThisMonth}</Text>
                <Text style={{ fontSize: 9, color: TEXT2 }}>résiliés (mois)</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: ADMIN.cardRadius, paddingVertical: 10 }}>
                <Text style={{ ...ADMIN.type.mono, fontSize: 16, color: summary.expiring7d > 0 ? Colors.warning : TEXT1 }}>{summary.expiring7d}</Text>
                <Text style={{ fontSize: 9, color: TEXT2 }}>expirent &lt; 7j</Text>
              </View>
            </View>
          )}
        </>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {STATUS_FILTERS.map((f) => {
          const on = status === f.key;
          return (
            <AnimatedPressable
              key={f.key}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatus(f.key); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 3, borderWidth: 1,
                backgroundColor: on ? withAlpha(f.color, 0.16) : MUTED, borderColor: on ? f.color : BORDER,
              }}
            >
              <Text style={{ ...ADMIN.type.label, color: on ? f.color : TEXT2 }}>{f.label}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          {header}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={ADMIN.accent} />
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN.accent} />}
          ListHeaderComponent={header}
          renderItem={({ item }) => <SubCard item={item} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name={isError ? "cloud-offline-outline" : "card-outline"} size={32} color={TEXT3} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 6 }}>
                {isError ? "Chargement impossible" : "Aucun abonnement"}
              </Text>
              {isError && (
                <AnimatedPressable onPress={() => refetch()} style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 3, backgroundColor: ADMIN.accentBg, borderWidth: 1, borderColor: ADMIN.accentBorder }}>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.accent }}>Réessayer</Text>
                </AnimatedPressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}
