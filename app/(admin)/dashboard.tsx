import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  Animated, Easing,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Polyline, Polygon, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const BG      = "#0B0E14";
const SURFACE = "#131720";
const BORDER  = "rgba(255,255,255,0.07)";
const TEXT    = "#F8FAFC";
const MUTED   = "rgba(248,250,252,0.42)";
const ACCENT  = "#F97316";

// ── Animated KPI number ────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!value) { setDisplay(0); return; }
    const start    = Date.now();
    const duration = 900;
    const timer = setInterval(() => {
      const t     = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <Text style={{ fontSize: 32, fontWeight: "900", color: TEXT, letterSpacing: -1 }}>
      {display.toLocaleString("fr-FR")}{suffix}
    </Text>
  );
}

// ── Live pulse dot ─────────────────────────────────────────────────────────────
function PulseDot({ color = "#4ADE80" }: { color?: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.6, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, transform: [{ scale }], opacity }} />
    </View>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = ACCENT, w = 100, h = 36 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return <View style={{ width: w, height: h }} />;
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const p   = 3;
  const pts = data.map((v, i) => `${p + (i / (data.length - 1)) * (w - p * 2)},${p + (1 - (v - min) / range) * (h - p * 2)}`).join(" ");
  const fill = `${p},${h - p} ${pts} ${w - p},${h - p}`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGrad id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.4" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Polygon points={fill} fill="url(#sg)" />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({
  label, value, change, color, suffix = "", sparkData,
}: {
  label: string; value: number; change: number | null;
  color: string; suffix?: string; sparkData?: number[];
}) {
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountY       = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(mountY,       { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  const up = change === null || change >= 0;

  return (
    <Animated.View style={{
      width: "47%", backgroundColor: SURFACE, borderRadius: 20,
      borderWidth: 1, borderColor: BORDER, padding: 16, overflow: "hidden",
      opacity: mountOpacity, transform: [{ translateY: mountY }],
    }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${color}06` }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: MUTED, fontWeight: "600" }}>{label}</Text>
        {change !== null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
            backgroundColor: up ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)" }}>
            <Ionicons name={up ? "arrow-up" : "arrow-down"} size={9} color={up ? "#4ADE80" : "#F87171"} />
            <Text style={{ fontSize: 9, fontWeight: "800", color: up ? "#4ADE80" : "#F87171" }}>{Math.abs(change)}%</Text>
          </View>
        )}
      </View>
      <AnimatedNumber value={value} suffix={suffix} />
      {sparkData && sparkData.length > 1 && (
        <View style={{ marginTop: 8 }}>
          <Sparkline data={sparkData} color={color} w={120} h={32} />
        </View>
      )}
    </Animated.View>
  );
}

// ── Quick links ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { icon: "analytics-outline"    as const, label: "Analytics", route: "/(admin)/analytics",     color: "#A78BFA" },
  { icon: "notifications-outline" as const, label: "Push",     route: "/(admin)/notifications", color: "#38BDF8" },
  { icon: "pricetag-outline"     as const, label: "Coupons",   route: "/(admin)/coupons",       color: "#4ADE80" },
  { icon: "pulse-outline"        as const, label: "Logs",      route: "/(admin)/logs",          color: ACCENT },
];

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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [clock, setClock]       = useState(() => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn:  () => adminApi.getDashboardStats() as Promise<{ success: boolean; stats: Stats; recentActivity: ActivityItem[]; revenueHistory?: number[] }>,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn:  () => adminApi.getHealth() as unknown as Promise<HealthStatus>,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const stats    = data?.stats ?? null;
  const activity = data?.recentActivity ?? [];
  const sparkData = data?.revenueHistory ?? [];
  const ch       = stats?.changes ?? { clients: null, pros: null, revenue: null, bookings: null };
  const apiOk    = healthData?.status === "ok";
  const dbOk     = healthData?.db === "ok";

  const KPI_CARDS = [
    { label: "Clients",  value: stats?.totalClients  ?? 0, change: ch.clients,  color: "#FE5D9D", suffix: "" },
    { label: "Pros",     value: stats?.totalPros     ?? 0, change: ch.pros,     color: ACCENT,    suffix: "" },
    { label: "CA mois",  value: stats?.monthRevenue  ?? 0, change: ch.revenue,  color: "#4ADE80", suffix: "€" },
    { label: "RDV/jour", value: stats?.todayBookings ?? 0, change: ch.bookings, color: "#38BDF8", suffix: "" },
  ];

  const SYSTEM_STATUS = [
    { label: "API",     ok: apiOk, icon: "cloud-outline"          as const },
    { label: "Base DB", ok: dbOk,  icon: "server-outline"         as const },
    { label: "Actifs",  ok: true,  value: stats?.activeUsers?.toString() ?? "—", icon: "people-circle-outline" as const },
  ];

  const byStatus = stats?.bookingsByStatus ?? {};

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
    >
      {/* Live header strip */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>
            Bonjour, {user?.first_name} 👋
          </Text>
          <Text style={{ fontSize: 12, color: MUTED, marginTop: 2, textTransform: "capitalize" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SURFACE, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: BORDER }}>
            <PulseDot color="#4ADE80" />
            <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT, fontVariant: ["tabular-nums"] }}>{clock}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
            backgroundColor: apiOk ? "rgba(74,222,128,0.10)" : "rgba(248,113,113,0.10)" }}>
            <PulseDot color={apiOk ? "#4ADE80" : "#F87171"} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: apiOk ? "#4ADE80" : "#F87171" }}>
              {apiOk ? "Systèmes OK" : "Dégradé"}
            </Text>
          </View>
        </View>
      </View>

      {/* KPI Grid */}
      {isLoading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: "47%", height: 110, backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER }} />
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          {KPI_CARDS.map((card) => (
            <KPICard key={card.label} {...card} sparkData={card.label === "CA mois" ? sparkData : undefined} />
          ))}
        </View>
      )}

      {/* System status */}
      <View style={{ backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 18, marginBottom: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(56,189,248,0.12)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="hardware-chip-outline" size={16} color="#38BDF8" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>Statut système</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {SYSTEM_STATUS.map(({ label, ok, value, icon }) => (
            <View key={label} style={{ flex: 1, backgroundColor: ok ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
              borderRadius: 14, padding: 12, borderWidth: 1, borderColor: ok ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.2)", alignItems: "center", gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <PulseDot color={ok ? "#4ADE80" : "#F87171"} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: ok ? "#4ADE80" : "#F87171" }}>
                  {value ?? (ok ? "OK" : "ERR")}
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: MUTED, textAlign: "center" }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Sparkline card */}
      {sparkData.length > 1 && (
        <View style={{ backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 18, marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>Revenus — 30 jours</Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {(stats?.monthRevenue ?? 0).toLocaleString("fr-FR")} € ce mois
              </Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(74,222,128,0.12)" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#4ADE80" }}>
                {ch.revenue !== null ? `${ch.revenue >= 0 ? "+" : ""}${ch.revenue}% vs M-1` : "Nouveau"}
              </Text>
            </View>
          </View>
          <Sparkline data={sparkData} color={ACCENT} w={320} h={60} />
        </View>
      )}

      {/* Bookings by status */}
      <View style={{ backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 18, marginBottom: 18 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT, marginBottom: 14 }}>Réservations par statut</Text>
        <View style={{ gap: 8 }}>
          {[
            { key: "pending",   label: "En attente", color: "#FBBF24" },
            { key: "confirmed", label: "Confirmées",  color: "#38BDF8" },
            { key: "completed", label: "Terminées",   color: "#4ADE80" },
            { key: "cancelled", label: "Annulées",    color: "#F87171" },
          ].map(({ key, label, color }) => {
            const count = byStatus[key] ?? 0;
            const total = Object.values(byStatus).reduce((s: number, v) => s + Number(v), 0);
            const pct   = total > 0 ? (count / total) * 100 : 0;
            return (
              <View key={key}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: TEXT, fontWeight: "600" }}>{label}</Text>
                  <Text style={{ fontSize: 12, color, fontWeight: "800" }}>{count}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <View style={{ height: 5, borderRadius: 3, backgroundColor: color, width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recent activity */}
      <View style={{ backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 18, marginBottom: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(167,139,250,0.12)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="pulse-outline" size={16} color="#A78BFA" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT }}>Activité récente</Text>
        </View>
        {activity.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Ionicons name="sparkles-outline" size={28} color="rgba(255,255,255,0.08)" />
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Aucune activité récente</Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {activity.slice(0, 6).map((item, i) => {
              const cfg = item.type === "booking"
                ? { color: "#A78BFA", icon: "calendar-outline"    as const }
                : item.type === "user"
                ? { color: "#38BDF8", icon: "person-add-outline"  as const }
                : { color: "#4ADE80", icon: "cash-outline"        as const };
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BORDER }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${cfg.color}14`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ionicons name={cfg.icon} size={15} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: TEXT }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: MUTED }} numberOfLines={1}>{item.description}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>{item.time}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Quick access */}
      <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>
        Accès rapide
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {QUICK_LINKS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push(item.route as any);
            }}
            style={({ pressed }) => [{
              width: "47%", backgroundColor: SURFACE, borderRadius: 16,
              padding: 16, alignItems: "center", gap: 8,
              borderWidth: 1, borderColor: pressed ? `${item.color}30` : BORDER,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${item.color}14`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={item.icon} size={19} color={item.color} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
