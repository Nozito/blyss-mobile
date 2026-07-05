import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, Platform, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import { Link } from "expo-router";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useScrollToTop } from "@react-navigation/native";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG      = ADMIN.bg;
const CARD    = ADMIN.surface;
const BORDER  = ADMIN.border;
const TEXT1   = ADMIN.text;
const TEXT2   = ADMIN.textSub;
const TEXT3   = ADMIN.textMuted;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number; totalPros: number; totalClients: number;
  totalBookings: number; todayBookings: number;
  totalRevenue: number; monthRevenue: number; activeUsers: number;
  bookingsByStatus: Record<string, number>;
  changes: { clients: number | null; pros: number | null; revenue: number | null; bookings: number | null };
}
interface ActivityItem { type: string; title: string; description: string; time: string }
interface HealthStatus { status: "ok" | "degraded"; db: "ok" | "error" }

function n(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
}

// ── PulseDot ──────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.7, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.2, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, transform: [{ scale }], opacity }} />
    </View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, accent = Colors.admin, icon, rightContent }: {
  title: string; accent?: string;
  icon?: { ios: SFSymbol; android: React.ComponentProps<typeof Ionicons>["name"] };
  rightContent?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: accent }} />
        {icon && (
          Platform.OS === "ios"
            ? <SymbolView name={icon.ios} size={15} tintColor={accent} />
            : <Ionicons name={icon.android} size={15} color={accent} />
        )}
        <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT1, letterSpacing: 0.1 }}>{title}</Text>
      </View>
      {rightContent}
    </View>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{
      borderRadius: 22, padding: 18,
      backgroundColor: CARD,
      borderWidth: 1, borderColor: BORDER,
      shadowColor: Colors.black, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45, shadowRadius: 20, elevation: 5,
    }, style]}>
      {children}
    </View>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: "people-outline"   as const, symbol: "person.2"          as const, label: "Utilisateurs", route: "/(admin)/users",           color: Colors.pro },
  { icon: "calendar-outline" as const, symbol: "calendar"          as const, label: "Réservations", route: "/(admin)/bookings",         color: Colors.info },
  { icon: "pricetag-outline" as const, symbol: "tag"               as const, label: "Coupons",      route: "/(admin-tools)/coupons",    color: Colors.warning },
  { icon: "pulse-outline"    as const, symbol: "waveform"          as const, label: "Logs",          route: "/(admin-tools)/logs",       color: Colors.success },
];

// ── Activity config ───────────────────────────────────────────────────────────
const ACTIVITY_CFG: Record<string, { color: string; label: string; icon: string; gradient: [string, string] }> = {
  booking: { color: Colors.pro,     label: "RDV",        icon: "calendar",       gradient: [Colors.pro,     `${Colors.pro}BB`] },
  user:    { color: Colors.info,    label: "Inscription", icon: "person.badge.plus", gradient: [Colors.info,    `${Colors.info}BB`] },
  payment: { color: Colors.success, label: "Paiement",   icon: "eurosign.circle", gradient: [Colors.success, `${Colors.success}BB`] },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DashboardSkeleton({ top }: { top: number }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      scrollEnabled={false}
      contentContainerStyle={{ paddingTop: top + 20, paddingHorizontal: 16, gap: 14, paddingBottom: 120 }}
    >
      <SkeletonBox width="100%" height={230} borderRadius={28} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[0,1,2,3].map(i => <View key={i} style={{ flex: 1 }}><SkeletonBox width="100%" height={90} borderRadius={20} /></View>)}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><SkeletonBox width="100%" height={130} borderRadius={22} /></View>
        <View style={{ flex: 1 }}><SkeletonBox width="100%" height={130} borderRadius={22} /></View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><SkeletonBox width="100%" height={130} borderRadius={22} /></View>
        <View style={{ flex: 1 }}><SkeletonBox width="100%" height={130} borderRadius={22} /></View>
      </View>
      <SkeletonBox width="100%" height={100} borderRadius={22} />
      <SkeletonBox width="100%" height={200} borderRadius={22} />
      <SkeletonBox width="100%" height={180} borderRadius={22} />
      <SkeletonBox width="100%" height={260} borderRadius={22} />
    </ScrollView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
  const [refreshing, setRefreshing] = useState(false);
  const hasAnimated = useRef(false);

  const kpiAnims = useRef([0,1,2,3].map(() => ({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(20),
  }))).current;

  const qaScales = useRef(QUICK_ACTIONS.map(() => new Animated.Value(1))).current;
  const heroScale = useRef(new Animated.Value(1)).current;
  const heroOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(
      () => setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })),
      30_000
    );
    return () => clearInterval(id);
  }, []);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboardStats(),
    staleTime: 5 * 60_000, retry: false,
  });
  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.getHealth() as unknown as Promise<HealthStatus>,
    staleTime: 30_000, refetchInterval: 60_000, retry: false,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  // Normalise snake_case et camelCase selon ce que renvoie le backend
  const d         = (rawData?.data as any) ?? null;
  const raw       = d?.stats ?? null;
  const stats: Stats | null = raw ? {
    totalUsers:       raw.total_users       ?? raw.totalUsers       ?? 0,
    totalPros:        raw.total_pros        ?? raw.totalPros        ?? 0,
    totalClients:     raw.total_clients     ?? raw.totalClients     ?? 0,
    totalBookings:    raw.total_bookings    ?? raw.totalBookings    ?? 0,
    todayBookings:    raw.today_bookings    ?? raw.bookings_today   ?? raw.todayBookings ?? 0,
    totalRevenue:     raw.total_revenue     ?? raw.totalRevenue     ?? 0,
    monthRevenue:     raw.revenue_month     ?? raw.month_revenue    ?? raw.monthRevenue  ?? 0,
    activeUsers:      raw.active_users      ?? raw.activeUsers      ?? 0,
    bookingsByStatus: raw.bookings_by_status ?? raw.bookingsByStatus ?? {},
    changes: {
      clients:  raw.changes?.clients  ?? null,
      pros:     raw.changes?.pros     ?? null,
      revenue:  raw.changes?.revenue  ?? null,
      bookings: raw.changes?.bookings ?? null,
    },
  } : null;
  const activity  = (d?.recent_activity ?? d?.recentActivity ?? []) as ActivityItem[];
  const sparkData = (d?.revenue_history  ?? d?.revenueHistory  ?? []) as number[];
  const byStatus  = stats?.bookingsByStatus ?? {};
  const apiOk     = healthData?.status === "ok";
  const dbOk      = healthData?.db === "ok";

  const maxSpark  = useMemo(() => Math.max(1, ...sparkData), [sparkData]);
  const sparkMin  = useMemo(() => { const pos = sparkData.filter(v => v > 0); return pos.length > 0 ? Math.min(...pos) : 0; }, [sparkData]);
  const sparkAvg  = useMemo(() => sparkData.length > 0 ? sparkData.reduce((s, v) => s + v, 0) / sparkData.length : 0, [sparkData]);
  const totalSparkRevenue = useMemo(() => sparkData.reduce((s, v) => s + v, 0), [sparkData]);

  // Taux de complétion des RDV
  const completionRate = useMemo(() => {
    const total = Object.values(byStatus).reduce((s, v) => s + Number(v), 0);
    const completed = byStatus.completed ?? 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [byStatus]);

  // Taux d'annulation
  const cancellationRate = useMemo(() => {
    const total = Object.values(byStatus).reduce((s, v) => s + Number(v), 0);
    const cancelled = byStatus.cancelled ?? 0;
    return total > 0 ? Math.round((cancelled / total) * 100) : 0;
  }, [byStatus]);

  // Revenue par utilisateur actif
  const revenuePerUser = useMemo(() => {
    const active = stats?.activeUsers ?? 0;
    const rev = stats?.totalRevenue ?? 0;
    return active > 0 ? Math.round(rev / active) : 0;
  }, [stats]);

  useEffect(() => {
    if (!stats || hasAnimated.current) return;
    hasAnimated.current = true;

    // KPI stagger
    kpiAnims.forEach((anim, i) => {
      Animated.sequence([
        Animated.delay(100 + i * 100),
        Animated.parallel([
          Animated.timing(anim.opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(anim.translateY, { toValue: 0, damping: 15, stiffness: 150, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [stats]);

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  if (isLoading) return <DashboardSkeleton top={insets.top} />;
  if (!stats) return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: TEXT2, fontSize: 14 }}>Impossible de charger les données</Text>
      <AnimatedPressable onPress={onRefresh} style={{ marginTop: 12 }}>
        <Text style={{ color: Colors.admin, fontWeight: "700" }}>Réessayer</Text>
      </AnimatedPressable>
    </View>
  );

  const KPI_DATA = [
    { label: "Clients", sub: "Inscrits",      color: Colors.pro, symbol: "person.2.fill"        as const, icon: "person-outline"    as const, value: stats?.totalClients  ?? 0, changeKey: "clients"  as const },
    { label: "Pros",    sub: "Pros actifs",    color: Colors.admin, symbol: "briefcase.fill"    as const, icon: "briefcase-outline" as const, value: stats?.totalPros    ?? 0, changeKey: "pros"     as const },
    { label: "RDV",     sub: "Aujourd'hui",    color: Colors.info,  symbol: "calendar.badge.clock" as const, icon: "calendar-outline" as const, value: stats?.todayBookings ?? 0, changeKey: "bookings" as const },
    { label: "CA mois", sub: "Chiffre d'aff.", color: Colors.success, symbol: "eurosign.circle.fill" as const, icon: "cash-outline"   as const, value: stats?.monthRevenue ?? 0, changeKey: "revenue"  as const },
  ];

  const totalRDV = Object.values(byStatus).reduce((s, v) => s + Number(v), 0);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
    >

      {/* ══ HERO ═══════════════════════════════════════════════════════════════ */}
      <Animated.View style={{ opacity: heroOpacity, transform: [{ scale: heroScale }] }}>
        <LinearGradient
          colors={["#1C0D00", "#2E1600", "#180C00"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 28, overflow: "hidden",
            shadowColor: Colors.admin, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 30, elevation: 14 }}
        >
          {/* Glow orbs */}
          <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: `${Colors.admin}18` }} />
          <View style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: "#8B5CF618" }} />

          <BlurView tint="dark" intensity={10} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} />

          <View style={{ padding: 22, zIndex: 1 }}>
            {/* Top bar */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
                <Text style={{ color: TEXT1, fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" }}>
                  ⚙ Admin Panel
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {/* DB Status */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4,
                  borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                  <PulseDot color={dbOk ? Colors.success : Colors.destructiveLight} />
                  <Text style={{ color: TEXT2, fontSize: 10, fontWeight: "700" }}>DB</Text>
                </View>
                {/* API Status */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4,
                  borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                  <PulseDot color={apiOk ? Colors.success : Colors.destructiveLight} />
                  <Text style={{ color: TEXT2, fontSize: 10, fontWeight: "700" }}>API</Text>
                </View>
              </View>
            </View>

            {/* Greeting */}
            <Text style={{ fontSize: 32, fontWeight: "900", color: TEXT1, letterSpacing: -0.8, marginBottom: 4 }}>
              Bonjour, {user?.first_name} 👋
            </Text>
            <Text style={{ fontSize: 12, color: TEXT2, fontWeight: "500", marginBottom: 24, textTransform: "capitalize" }}>
              {today} · {clock}
            </Text>

            {/* Metrics row */}
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", paddingTop: 18 }}>
              {[
                { label: "Utilisateurs",    value: String(stats?.totalUsers ?? "—"),       accent: Colors.pro },
                { label: "RDV aujourd'hui", value: String(stats?.todayBookings ?? "—"),     accent: Colors.info },
                { label: "CA du mois",      value: `${(stats?.monthRevenue ?? 0).toLocaleString("fr-FR")} €`, accent: Colors.success },
              ].map(({ label, value, accent }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.10)", marginHorizontal: 4 }} />}
                  <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                    <View style={{ width: 28, height: 2, borderRadius: 1, backgroundColor: accent, marginBottom: 4 }} />
                    <Text style={{ fontSize: 22, fontWeight: "900", color: TEXT1, letterSpacing: -0.5 }}>{value}</Text>
                    <Text style={{ fontSize: 10, color: TEXT2, fontWeight: "600", textAlign: "center" }}>{label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ══ QUICK ACTIONS ══════════════════════════════════════════════════════ */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {QUICK_ACTIONS.map(({ icon, symbol, label, route, color }, qi) => {
          const badge = label === "Réservations" && (byStatus.pending ?? 0) > 0 ? byStatus.pending : null;
          return (
            <Animated.View key={route} style={{ flex: 1, transform: [{ scale: qaScales[qi] }] }}>
              <Link href={route as any} asChild>
              <Pressable
                onPressIn={() => Animated.spring(qaScales[qi], { toValue: 0.92, useNativeDriver: true, damping: 12, stiffness: 160 }).start()}
                onPressOut={() => Animated.spring(qaScales[qi], { toValue: 1,    useNativeDriver: true, damping: 12, stiffness: 160 }).start()}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
                style={{
                  borderRadius: 20, paddingVertical: 14,
                  borderWidth: 1, borderColor: BORDER,
                  backgroundColor: CARD,
                  alignItems: "center", gap: 8,
                  shadowColor: color, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
                }}
              >
                <View style={{ position: "relative" }}>
                  <LinearGradient
                    colors={[`${color}28`, `${color}10`]}
                    style={{ width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
                  >
                    {Platform.OS === "ios"
                      ? <SymbolView name={symbol} size={24} tintColor={color} />
                      : <Ionicons name={icon} size={22} color={color} />}
                  </LinearGradient>
                  {badge != null && (
                    <View style={{
                      position: "absolute", top: -4, right: -4,
                      minWidth: 18, height: 18, borderRadius: 9,
                      backgroundColor: Colors.admin,
                      alignItems: "center", justifyContent: "center",
                      paddingHorizontal: 4, borderWidth: 1.5, borderColor: BG,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.white }}>
                        {badge > 99 ? "99+" : String(badge)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT2 }}>{label}</Text>
              </Pressable>
              </Link>
            </Animated.View>
          );
        })}
      </View>

      {/* ══ KPI GRID 2×2 ═══════════════════════════════════════════════════════ */}
      <View style={{ gap: 10 }}>
        {[[0, 1], [2, 3]].map((pair, row) => (
          <View key={row} style={{ flexDirection: "row", gap: 10 }}>
            {pair.map((idx) => {
              const { label, sub, color, symbol, icon, value, changeKey } = KPI_DATA[idx];
              const change = stats?.changes?.[changeKey] ?? null;
              return (
                <Animated.View
                  key={label}
                  style={{ flex: 1, opacity: kpiAnims[idx].opacity, transform: [{ translateY: kpiAnims[idx].translateY }] }}
                >
                  <View style={{
                    borderRadius: 22, padding: 16,
                    backgroundColor: CARD,
                    borderWidth: 1, borderColor: BORDER,
                    shadowColor: color, shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12, shadowRadius: 14, elevation: 4,
                    overflow: "hidden",
                  }}>
                    {/* Subtle background glow */}
                    <View style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: `${color}0C` }} />

                    <LinearGradient
                      colors={[`${color}28`, `${color}0E`]}
                      style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 14 }}
                    >
                      {Platform.OS === "ios"
                        ? <SymbolView name={symbol} size={20} tintColor={color} />
                        : <Ionicons name={icon} size={19} color={color} />}
                    </LinearGradient>

                    <Text style={{ fontSize: 30, fontWeight: "900", color: TEXT1, letterSpacing: -0.8 }}>
                      {n(value).toLocaleString("fr-FR")}{label === "CA mois" ? " €" : ""}
                    </Text>

                    {change !== null && (
                      <View style={{
                        flexDirection: "row", alignItems: "center", gap: 3,
                        alignSelf: "flex-start", marginTop: 5, marginBottom: 3,
                        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
                        backgroundColor: change >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      }}>
                        <Ionicons
                          name={change >= 0 ? "trending-up" : "trending-down"}
                          size={10}
                          color={change >= 0 ? Colors.success : Colors.destructive}
                        />
                        <Text style={{ fontSize: 10, fontWeight: "800", color: change >= 0 ? Colors.success : Colors.destructive }}>
                          {change >= 0 ? `+${change}%` : `${change}%`}
                        </Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 11, color: TEXT3, marginTop: change !== null ? 0 : 6, fontWeight: "600" }}>{sub}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>

      {/* ══ PERFORMANCE METRICS (new) ══════════════════════════════════════════ */}
      <Card>
        <SectionHeader
          title="Performance"
          icon={{ ios: "chart.bar.xaxis", android: "bar-chart-outline" }}
          accent={Colors.pro}
        />
        <View style={{ gap: 14 }}>
          {/* Taux de complétion */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: TEXT2, fontWeight: "600" }}>Taux de complétion</Text>
              <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.success }}>{completionRate}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <LinearGradient
                colors={[Colors.success, Colors.successText]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: "100%", width: `${completionRate}%`, borderRadius: 4 }}
              />
            </View>
          </View>

          {/* Taux d'annulation */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: TEXT2, fontWeight: "600" }}>Taux d'annulation</Text>
              <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.destructive }}>{cancellationRate}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <LinearGradient
                colors={[Colors.destructive, "#B91C1C"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: "100%", width: `${cancellationRate}%`, borderRadius: 4 }}
              />
            </View>
          </View>

          {/* Revenu / utilisateur actif */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {Platform.OS === "ios"
                ? <SymbolView name="eurosign.circle" size={16} tintColor={Colors.warning} />
                : <Ionicons name="cash-outline" size={16} color={Colors.warning} />}
              <Text style={{ fontSize: 12, color: TEXT2, fontWeight: "600" }}>CA / utilisateur actif</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.warning }}>
              {revenuePerUser.toLocaleString("fr-FR")} €
            </Text>
          </View>
        </View>
      </Card>

      {/* ══ SYSTEM HEALTH (new) ════════════════════════════════════════════════ */}
      <Card>
        <SectionHeader
          title="Santé système"
          icon={{ ios: "server.rack", android: "hardware-chip-outline" }}
          accent={apiOk && dbOk ? Colors.success : Colors.destructiveLight}
          rightContent={
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
              backgroundColor: (apiOk && dbOk) ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
              borderWidth: 1, borderColor: (apiOk && dbOk) ? "rgba(34,197,94,0.3)" : "rgba(248,113,113,0.3)" }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: (apiOk && dbOk) ? Colors.success : Colors.destructiveLight }}>
                {(apiOk && dbOk) ? "Opérationnel" : "Dégradé"}
              </Text>
            </View>
          }
        />
        <View style={{ gap: 10 }}>
          {[
            { label: "API Server",   ok: apiOk, icon: "network",     iconA: "wifi-outline"           },
            { label: "Base de données", ok: dbOk,  icon: "cylinder.split.1x2", iconA: "server-outline" },
          ].map(({ label, ok, icon, iconA }) => (
            <View key={label} style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              padding: 14, borderRadius: 14,
              backgroundColor: ok ? "rgba(34,197,94,0.07)" : "rgba(248,113,113,0.07)",
              borderWidth: 1, borderColor: ok ? "rgba(34,197,94,0.18)" : "rgba(248,113,113,0.18)",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {Platform.OS === "ios"
                  ? <SymbolView name={icon as any} size={16} tintColor={ok ? Colors.success : Colors.destructiveLight} />
                  : <Ionicons name={iconA as any} size={16} color={ok ? Colors.success : Colors.destructiveLight} />}
                <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1 }}>{label}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <PulseDot color={ok ? Colors.success : Colors.destructiveLight} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: ok ? Colors.success : Colors.destructiveLight }}>
                  {ok ? "En ligne" : "Hors ligne"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {/* ══ STATS GLOBALES (new) ════════════════════════════════════════════════ */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { label: "Total RDV",   value: n(stats?.totalBookings).toLocaleString("fr-FR"), icon: "calendar.badge.checkmark" as const, iconA: "calendar-outline" as const, color: Colors.info },
          { label: "CA total",    value: `${n(stats?.totalRevenue).toLocaleString("fr-FR")} €`, icon: "chart.line.uptrend.xyaxis" as const, iconA: "trending-up-outline" as const, color: Colors.success },
          { label: "Actifs",      value: String(stats?.activeUsers ?? "—"),           icon: "person.crop.circle.badge.checkmark" as const, iconA: "checkmark-circle-outline" as const, color: Colors.warning },
        ].map(({ label, value, icon, iconA, color }) => (
          <View key={label} style={{ flex: 1 }}>
            <Card style={{ padding: 14, alignItems: "center", gap: 8 }}>
              <LinearGradient
                colors={[`${color}28`, `${color}0A`]}
                style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              >
                {Platform.OS === "ios"
                  ? <SymbolView name={icon} size={18} tintColor={color} />
                  : <Ionicons name={iconA} size={17} color={color} />}
              </LinearGradient>
              <Text style={{ fontSize: 18, fontWeight: "900", color: TEXT1, letterSpacing: -0.5 }}>{value}</Text>
              <Text style={{ fontSize: 10, color: TEXT3, fontWeight: "600", textAlign: "center" }}>{label}</Text>
            </Card>
          </View>
        ))}
      </View>

      {/* ══ REVENUE CHART ══════════════════════════════════════════════════════ */}
      {sparkData.length > 1 && (
        <Card>
          <SectionHeader
            title="Revenus 30 jours"
            icon={{ ios: "chart.bar.fill", android: "bar-chart-outline" }}
            accent={Colors.admin}
            rightContent={
              totalSparkRevenue > 0 ? (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                  backgroundColor: `${Colors.admin}18`, borderWidth: 1, borderColor: `${Colors.admin}35` }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.admin }}>
                    {totalSparkRevenue.toLocaleString("fr-FR")} €
                  </Text>
                </View>
              ) : null
            }
          />

          {/* Bars */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 100 }}>
            {sparkData.map((v, i) => {
              const barH  = Math.max((v / maxSpark) * 92, v > 0 ? 5 : 2);
              const isLast = i === sparkData.length - 1;
              return (
                <View key={i} style={{ flex: 1, alignItems: "center" }}>
                  {isLast && v > 0 && (
                    <View style={{ position: "absolute", bottom: barH + 5, alignItems: "center", zIndex: 1 }}>
                      <View style={{ backgroundColor: Colors.admin, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                        <Text style={{ fontSize: 7, color: Colors.white, fontWeight: "800" }}>
                          {v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)}€
                        </Text>
                      </View>
                      <View style={{ width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 4,
                        borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: Colors.admin }} />
                    </View>
                  )}
                  {v > 0 ? (
                    <LinearGradient
                      colors={[Colors.admin, `${Colors.admin}33`]}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={{ width: "100%", height: barH, borderRadius: 4 }}
                    />
                  ) : (
                    <View style={{ width: "100%", height: barH, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)" }} />
                  )}
                  {i % 5 === 0 && (
                    <Text style={{ fontSize: 7, color: TEXT3, marginTop: 2 }}>
                      {`J-${sparkData.length - 1 - i || "0"}`}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Footer stats */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 14,
            backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, paddingVertical: 10,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            {[
              { label: "Min", value: sparkMin > 0 ? `${sparkMin.toLocaleString("fr-FR")} €` : "—" },
              { label: "Moy", value: sparkAvg > 0 ? `${Math.round(sparkAvg).toLocaleString("fr-FR")} €` : "—" },
              { label: "Max", value: maxSpark > 1 ? `${maxSpark.toLocaleString("fr-FR")} €` : "—" },
            ].map(({ label, value }) => (
              <View key={label} style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 10, color: TEXT3, fontWeight: "600" }}>{label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "900", color: TEXT1, marginTop: 2 }}>{value}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* ══ BOOKINGS BY STATUS ══════════════════════════════════════════════════ */}
      {Object.keys(byStatus).length > 0 && (
        <Card>
          <SectionHeader
            title="Réservations par statut"
            icon={{ ios: "calendar.badge.clock", android: "calendar-outline" }}
            accent={Colors.admin}
            rightContent={
              <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3 }}>{totalRDV} total</Text>
            }
          />
          <View style={{ gap: 14 }}>
            {[
              { key: "pending",   label: "En attente", color: Colors.warning,     icon: "clock",          iconA: "time-outline" },
              { key: "confirmed", label: "Confirmées",  color: Colors.info,        icon: "checkmark.seal", iconA: "checkmark-circle-outline" },
              { key: "completed", label: "Terminées",   color: Colors.success,     icon: "checkmark.circle.fill", iconA: "checkmark-done-outline" },
              { key: "cancelled", label: "Annulées",    color: Colors.destructive, icon: "xmark.circle",   iconA: "close-circle-outline" },
            ].map(({ key, label, color, icon, iconA }) => {
              const count = byStatus[key] ?? 0;
              const pct   = totalRDV > 0 ? (count / totalRDV) * 100 : 0;
              return (
                <View key={key}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {Platform.OS === "ios"
                        ? <SymbolView name={icon as any} size={13} tintColor={color} />
                        : <Ionicons name={iconA as any} size={13} color={color} />}
                      <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT1 }}>{label}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: "900", color }}>{count}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${color}18` }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color }}>{pct.toFixed(0)}%</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <LinearGradient
                      colors={[color, `${color}88`]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 4 }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* ══ ACTIVITÉ RÉCENTE ═══════════════════════════════════════════════════ */}
      {activity.length > 0 && (
        <View>
          <SectionHeader
            title="Activité récente"
            icon={{ ios: "bolt.fill", android: "flash" }}
            accent={Colors.admin}
            rightContent={
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT3 }}>Dernières 24h</Text>
              </View>
            }
          />
          <View style={{ gap: 10 }}>
            {activity.slice(0, 5).map((item, i) => {
              const cfg = ACTIVITY_CFG[item.type] ?? ACTIVITY_CFG.booking;
              const initLetter = item.title[0]?.toUpperCase() ?? "?";
              return (
                <View key={i} style={{
                  borderRadius: 18, padding: 14,
                  backgroundColor: CARD,
                  borderWidth: 1, borderColor: BORDER,
                  shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3, shadowRadius: 12, elevation: 3,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {/* Avatar */}
                    <LinearGradient
                      colors={cfg.gradient}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{ width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <Text style={{ color: Colors.white, fontWeight: "900", fontSize: 17 }}>{initLetter}</Text>
                    </LinearGradient>

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                        <Text style={{ fontWeight: "800", fontSize: 13, color: TEXT1, flex: 1 }} numberOfLines={1}>{item.title}</Text>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: `${cfg.color}1E`, marginLeft: 8 }}>
                          <Text style={{ fontSize: 9, fontWeight: "900", color: cfg.color, letterSpacing: 0.3 }}>{cfg.label}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: TEXT2, marginBottom: 6 }} numberOfLines={1}>{item.description}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={10} color={TEXT3} />
                        <Text style={{ fontSize: 10, color: TEXT3, fontWeight: "600" }}>{item.time}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

    </ScrollView>
  );
}