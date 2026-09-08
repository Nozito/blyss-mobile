import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TodayOverview } from "@/components/admin/TodayOverview";
import { SectionLabel } from "@/components/admin/SectionLabel";
import { Card } from "@/components/admin/Card";
import { useScrollToTop } from "@react-navigation/native";
import { syncAdminDashboardWidgets } from "@/lib/widgetSync";
import { normalizeAdminDashboardStats } from "@/lib/adminStats";
import { formatEUR, formatNumberFR, formatPercentFR } from "@/lib/format";

function DashboardSkeleton({ top }: { top: number }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ADMIN.bg }}
      scrollEnabled={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: top + 60, paddingHorizontal: ADMIN.space.xl, gap: ADMIN.space.lg }}
    >
      <SkeletonBox width="70%" height={16} borderRadius={6} />
      <SkeletonBox width="100%" height={150} borderRadius={ADMIN.cardRadius} />
      <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
        <SkeletonBox width="100%" height={84} borderRadius={ADMIN.cardRadius} style={{ flex: 1 }} />
        <SkeletonBox width="100%" height={84} borderRadius={ADMIN.cardRadius} style={{ flex: 1 }} />
        <SkeletonBox width="100%" height={84} borderRadius={ADMIN.cardRadius} style={{ flex: 1 }} />
      </View>
      <SkeletonBox width="100%" height={100} borderRadius={ADMIN.cardRadius} />
      <SkeletonBox width="100%" height={150} borderRadius={ADMIN.cardRadius} />
    </ScrollView>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboardStats(),
    staleTime: 5 * 60_000, retry: false,
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

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const d   = (rawData?.data as any) ?? null;
  const stats = normalizeAdminDashboardStats(d?.stats);
  const sparkData = (d?.revenue_history ?? d?.revenueHistory ?? []) as number[];
  const pendingBookings = stats?.bookingsByStatus?.pending ?? 0;
  const flaggedReviews  = (reviewsData?.data as unknown[] | undefined)?.length ?? 0;
  const flaggedThreads  = (threadsData?.data as unknown[] | undefined)?.length ?? 0;
  const urgentCount = pendingBookings + flaggedReviews + flaggedThreads;

  const maxSpark = useMemo(() => Math.max(1, ...sparkData), [sparkData]);
  const totalSparkRevenue = useMemo(() => sparkData.reduce((s, v) => s + v, 0), [sparkData]);
  const todayRevenue = sparkData.length > 0 ? sparkData[sparkData.length - 1] : 0;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    if (!stats) return;
    syncAdminDashboardWidgets({
      todayRevenue,
      weekRevenue: totalSparkRevenue,
      revenueChange: stats.revenueChange,
      pendingBookings,
      flaggedReviews,
    });
  }, [stats, todayRevenue, totalSparkRevenue, pendingBookings, flaggedReviews]);

  const byStatus = stats?.bookingsByStatus ?? {};
  const totalBookingsToday = useMemo(() => Object.values(byStatus).reduce((s, v) => s + Number(v), 0), [byStatus]);
  const completionRate = useMemo(() => {
    const completed = byStatus.completed ?? 0;
    return totalBookingsToday > 0 ? Math.round((completed / totalBookingsToday) * 100) : 0;
  }, [byStatus, totalBookingsToday]);

  const STATUS_LABELS: Record<string, string> = { pending: "En attente", confirmed: "Confirmées", completed: "Terminées", cancelled: "Annulées" };
  const rankedStatuses = useMemo(() => {
    return Object.entries(byStatus)
      .map(([key, count]) => ({ key, label: STATUS_LABELS[key] ?? key, count: Number(count) }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [byStatus]);

  const plan = stats?.subsByPlan ?? { start: 0, serenite: 0, signature: 0 };
  const subsTotal = plan.signature + plan.serenite + plan.start;

  // Métrique phare : le vrai CA plateforme = abonnements pros (MRR). Tant
  // qu'il n'y en a pas, le "revenu du mois" (paiements de réservations) n'est
  // PAS notre CA — c'est l'argent des pros qui transite. On met alors en avant
  // le volume encaissé dans l'app + l'activité marketplace.
  const heroMetric = useMemo(() => {
    const s = stats;
    if (s && s.subMrr > 0) {
      return {
        label: "Revenu mensuel · abonnements",
        value: formatNumberFR(s.subMrr),
        change: s.subsChange,
        stats: [
          { k: "Abos actifs", v: formatNumberFR(s.subsActive) },
          { k: "Pris ce mois", v: formatNumberFR(s.subsThisMonth) },
          { k: "Encaissé app", v: formatEUR(s.collectedThisMonth) },
        ],
      };
    }
    return {
      label: "Encaissé dans l'app · ce mois",
      value: formatNumberFR(s?.monthRevenue ?? 0),
      change: s?.revenueChange ?? null,
      stats: [
        { k: "Utilisateurs", v: formatNumberFR(s?.totalUsers ?? 0) },
        { k: "RDV ce mois", v: formatNumberFR(s?.monthBookings ?? 0) },
        { k: "Terminées", v: formatPercentFR(completionRate) },
      ],
    };
  }, [stats, completionRate]);

  if (isLoading) return <DashboardSkeleton top={60} />;
  if (!stats) return (
    <View style={{ flex: 1, backgroundColor: ADMIN.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: ADMIN.textSub, fontSize: 14 }}>Impossible de charger les données</Text>
      <AnimatedPressable onPress={onRefresh} style={{ marginTop: 12 }}>
        <Text style={{ color: ADMIN.accent, fontWeight: "700" }}>Réessayer</Text>
      </AnimatedPressable>
    </View>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: ADMIN.bg }}
      contentContainerStyle={{ paddingBottom: ADMIN.space.xxl }}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN.accent} />}
    >
      <AdminHeader
        title={`Bonjour, ${user?.first_name ?? ""}`}
        subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)}`}
      />

      {/* ── Métrique phare — aplat rose plein largeur ── */}
      <View style={{ backgroundColor: ADMIN.accent, paddingHorizontal: ADMIN.space.xl, paddingVertical: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ ...ADMIN.type.label, color: ADMIN.accentSub, flexShrink: 1 }} numberOfLines={1}>
            {heroMetric.label}
          </Text>
          {heroMetric.change !== null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <Ionicons name={heroMetric.change >= 0 ? "trending-up" : "trending-down"} size={13} color={ADMIN.accentInk} />
              <Text style={{ fontSize: 12, fontWeight: "900", color: ADMIN.accentInk }}>
                {heroMetric.change >= 0 ? "+" : ""}{heroMetric.change}%
              </Text>
            </View>
          )}
        </View>

        <Text style={{ ...ADMIN.type.hero, fontSize: 56, lineHeight: 54, color: ADMIN.accentInk, marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>
          {heroMetric.value}
          <Text style={{ fontSize: 20 }}> €</Text>
        </Text>

        <View style={{ flexDirection: "row", gap: ADMIN.space.xl, marginTop: ADMIN.space.lg }}>
          {heroMetric.stats.map((s) => (
            <View key={s.k}>
              <Text style={{ fontSize: 20, fontWeight: "900", letterSpacing: -0.8, color: ADMIN.accentInk }}>{s.v}</Text>
              <Text style={{ ...ADMIN.type.label, color: ADMIN.accentSub, marginTop: 3 }}>{s.k}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── À traiter — détail opérationnel du verdict ci-dessus ── */}
      {urgentCount > 0 && (
        <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
          <SectionLabel>À traiter</SectionLabel>
          <Card>
            <TodayOverview
              items={[
                { label: "réservations à confirmer",      count: pendingBookings, tone: "warning", onPress: () => router.push("/(admin)/bookings") },
                { label: "avis signalés",                  count: flaggedReviews,  tone: "danger",  onPress: () => router.push("/(admin-tools)/reviews") },
                { label: "conversations signalées",        count: flaggedThreads,  tone: "danger",  onPress: () => router.push("/(admin-tools)/messages") },
              ]}
            />
          </Card>
        </View>
      )}

      {/* ── Répartition abonnements ── */}
      {subsTotal > 0 && (
        <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
          <SectionLabel trailing={`${formatNumberFR(subsTotal)} actifs`}>Abonnements</SectionLabel>
          <Card style={{ gap: ADMIN.space.md }}>
            {([
              { key: "signature", label: "Signature", count: plan.signature },
              { key: "serenite", label: "Sérénité", count: plan.serenite },
              { key: "start", label: "Start", count: plan.start },
            ]).map((p) => {
              const pct = subsTotal > 0 ? Math.round((p.count / subsTotal) * 100) : 0;
              return (
                <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.md }}>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.text, width: 74 }}>{p.label}</Text>
                  <View style={{ flex: 1, height: 8, backgroundColor: ADMIN.surfaceHover, overflow: "hidden" }}>
                    <View style={{ width: `${pct}%`, height: "100%", backgroundColor: ADMIN.accent }} />
                  </View>
                  <Text style={{ ...ADMIN.type.mono, fontSize: 13, color: ADMIN.text, width: 46, textAlign: "right" }}>{formatNumberFR(p.count)}</Text>
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {/* ── Accès rapides ── */}
      <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl, flexDirection: "row", gap: ADMIN.space.md }}>
        {[
          { label: "Coupon",         icon: "pricetag-outline"       as const, onPress: () => router.push("/(admin-tools)/coupons") },
          { label: "Notifier",       icon: "notifications-outline"  as const, onPress: () => router.push("/(admin-tools)/notifications") },
        ].map(({ label, icon, onPress }) => (
          <AnimatedPressable
            key={label}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
            style={{ flex: 1 }}
          >
            <Card style={{ alignItems: "center", gap: ADMIN.space.sm, paddingVertical: ADMIN.space.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 4, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={icon} size={17} color={ADMIN.textSub} />
              </View>
              <Text style={{ ...ADMIN.type.caption, color: ADMIN.text, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>{label}</Text>
            </Card>
          </AnimatedPressable>
        ))}
      </View>

      {/* ── Revenu du jour ── */}
      <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
        <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }}>Revenu du jour</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ADMIN.success }} />
              <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }} numberOfLines={1}>{formatNumberFR(stats.todayBookings)} rdv aujourd'hui</Text>
            </View>
          </View>
          <Text style={{ ...ADMIN.type.display, fontSize: 26, color: ADMIN.text }} numberOfLines={1}>{formatEUR(todayRevenue)}</Text>
        </Card>
      </View>

      {/* ── Deux faits ── */}
      <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl, flexDirection: "row", gap: ADMIN.space.md }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: ADMIN.space.sm }} numberOfLines={1}>Complétion</Text>
          <Text style={{ ...ADMIN.type.display, fontSize: 24, color: ADMIN.text }} numberOfLines={1}>{formatPercentFR(completionRate)}</Text>
          <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub, marginTop: 2 }} numberOfLines={1}>terminées</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: ADMIN.space.sm }} numberOfLines={1}>Utilisateurs</Text>
          <Text style={{ ...ADMIN.type.display, fontSize: 24, color: ADMIN.text }} numberOfLines={1}>{formatNumberFR(stats.activeUsers)}</Text>
          <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub, marginTop: 2 }} numberOfLines={1}>actifs sur {formatNumberFR(stats.totalUsers)}</Text>
        </Card>
      </View>

      {/* ── Réservations par statut — classement, pas une grille ── */}
      {rankedStatuses.length > 0 && (
        <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.xl }}>
          <SectionLabel>Réservations</SectionLabel>
          <Card style={{ gap: ADMIN.space.md }}>
            {rankedStatuses.map((s, i) => {
              const pct = totalBookingsToday > 0 ? Math.round((s.count / totalBookingsToday) * 100) : 0;
              return (
                <View key={s.key}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: ADMIN.textSub }}>{i + 1}</Text>
                      </View>
                      <Text style={{ ...ADMIN.type.body, fontSize: 13, color: ADMIN.text }}>{s.label}</Text>
                    </View>
                    <Text style={{ ...ADMIN.type.caption, fontWeight: "700", color: ADMIN.text }}>{formatPercentFR(pct)}</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: ADMIN.surfaceHover, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${pct}%`, borderRadius: 3, backgroundColor: ADMIN.accent }} />
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {/* ── Revenus 30 jours ── */}
      {sparkData.length > 1 && (
        <View style={{ paddingHorizontal: ADMIN.space.xl }}>
          <SectionLabel trailing="30 jours">Revenus</SectionLabel>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: ADMIN.space.md }}>
              <Text style={{ ...ADMIN.type.display, fontSize: 20, color: ADMIN.text }} numberOfLines={1}>{formatEUR(totalSparkRevenue)}</Text>
              <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted }} numberOfLines={1}>CA du mois : {formatEUR(stats.monthRevenue)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 56 }}>
              {sparkData.map((v, i) => (
                <View key={i} style={{
                  flex: 1, height: Math.max((v / maxSpark) * 52, v > 0 ? 3 : 1),
                  borderRadius: 2,
                  backgroundColor: i === sparkData.length - 1 ? ADMIN.accent : ADMIN.surfaceHover,
                }} />
              ))}
            </View>
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
