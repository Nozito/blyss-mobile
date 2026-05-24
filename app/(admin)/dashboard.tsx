import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  Animated, Easing, Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Polyline, Polygon, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!value) { setDisplay(0); return; }
    const start = Date.now(), duration = 800;
    const timer = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return (
    <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.foreground, letterSpacing: -1 }}>
      {display.toLocaleString("fr-FR")}{suffix}
    </Text>
  );
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.7, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
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

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, w = 100, h = 36 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (data.length < 2) return <View style={{ width: w, height: h }} />;
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const p = 3;
  const pts  = data.map((v, i) => `${p + (i / (data.length - 1)) * (w - p * 2)},${p + (1 - (v - min) / range) * (h - p * 2)}`).join(" ");
  const fill = `${p},${h - p} ${pts} ${w - p},${h - p}`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgGrad id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.22" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Polygon points={fill} fill="url(#sg)" />
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, change, color, suffix = "", sparkData, icon }: {
  label: string; value: number; change: number | null;
  color: string; suffix?: string; sparkData?: number[];
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountY       = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(mountY,       { toValue: 0, duration: 360, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);
  const up = change === null || change >= 0;
  return (
    <Animated.View style={{
      width: "47%", backgroundColor: Colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: Colors.border, padding: 14,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
      opacity: mountOpacity, transform: [{ translateY: mountY }],
    }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}15`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        {change !== null && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
            backgroundColor: up ? `${Colors.success}15` : `${Colors.destructive}12` }}>
            <Ionicons name={up ? "arrow-up" : "arrow-down"} size={9} color={up ? Colors.success : Colors.destructive} />
            <Text style={{ fontSize: 9, fontWeight: "800", color: up ? Colors.success : Colors.destructive }}>{Math.abs(change)}%</Text>
          </View>
        )}
      </View>
      <AnimatedNumber value={value} suffix={suffix} />
      <Text style={{ fontSize: 11, color: Colors.mutedForeground, fontWeight: "500", marginTop: 2 }}>{label}</Text>
      {sparkData && sparkData.length > 1 && (
        <View style={{ marginTop: 6 }}>
          <Sparkline data={sparkData} color={color} w={110} h={24} />
        </View>
      )}
    </Animated.View>
  );
}

// ── Quick links ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { icon: "analytics-outline"     as const, symbol: "chart.bar.xaxis" as const, label: "Analytics",     desc: "Métriques & revenus", route: "/(admin)/analytics",     color: Colors.pro },
  { icon: "notifications-outline" as const, symbol: "bell"            as const, label: "Notifications", desc: "Push ciblées",         route: "/(admin)/notifications", color: Colors.info },
  { icon: "pricetag-outline"      as const, symbol: "tag"             as const, label: "Coupons",       desc: "Codes promo",          route: "/(admin)/coupons",       color: Colors.success },
  { icon: "pulse-outline"         as const, symbol: "waveform"        as const, label: "Logs",          desc: "Événements système",   route: "/(admin)/logs",          color: Colors.admin },
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
  const [clock, setClock]           = useState(() => new Date().toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn:  () => adminApi.getDashboardStats() as Promise<{ success: boolean; stats: Stats; recentActivity: ActivityItem[]; revenueHistory?: number[] }>,
    staleTime: 5 * 60_000, retry: false,
  });
  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn:  () => adminApi.getHealth() as unknown as Promise<HealthStatus>,
    staleTime: 30_000, refetchInterval: 60_000, retry: false,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const stats     = data?.stats ?? null;
  const activity  = data?.recentActivity ?? [];
  const sparkData = data?.revenueHistory ?? [];
  const ch        = stats?.changes ?? { clients: null, pros: null, revenue: null, bookings: null };
  const apiOk     = healthData?.status === "ok";
  const dbOk      = healthData?.db === "ok";
  const byStatus  = stats?.bookingsByStatus ?? {};

  const KPI_CARDS = [
    { label: "Clients ce mois",  value: stats?.totalClients  ?? 0, change: ch.clients,  color: Colors.primary, suffix: "", icon: "people-outline"   as const },
    { label: "Pros actifs",      value: stats?.totalPros     ?? 0, change: ch.pros,     color: Colors.admin,   suffix: "", icon: "briefcase-outline" as const },
    { label: "CA du mois",       value: stats?.monthRevenue  ?? 0, change: ch.revenue,  color: Colors.success, suffix: "€", icon: "card-outline"    as const, sparkData },
    { label: "RDV aujourd'hui",  value: stats?.todayBookings ?? 0, change: ch.bookings, color: Colors.info,    suffix: "", icon: "calendar-outline"  as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* ── Compact sticky header ── */}
      <View style={{
        paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16,
        backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.foreground }}>
              Bonjour, {user?.first_name} 👋
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <PulseDot color={apiOk ? Colors.success : Colors.destructive} />
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{clock}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
              backgroundColor: `${Colors.admin}12`, borderWidth: 1, borderColor: `${Colors.admin}30` }}>
              <Text style={{ fontSize: 10, fontWeight: "900", color: Colors.admin, letterSpacing: 1 }}>● ADMIN</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Scroll content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
      >
        {/* KPI 2×2 */}
        {isLoading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: "47%", height: 100, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border }} />
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            {KPI_CARDS.map((card) => (
              <KPICard key={card.label} {...card} />
            ))}
          </View>
        )}

        {/* Statut système */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12,
          shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${Colors.info}15`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="hardware-chip-outline" size={15} color={Colors.info} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>Statut système</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "API",      ok: apiOk },
              { label: "Base DB",  ok: dbOk },
              { label: "Actifs",   ok: true, value: stats?.activeUsers?.toString() ?? "—" },
            ].map(({ label, ok, value }) => (
              <View key={label} style={{ flex: 1, backgroundColor: ok ? `${Colors.success}08` : `${Colors.destructive}08`,
                borderRadius: 12, padding: 10, borderWidth: 1,
                borderColor: ok ? `${Colors.success}25` : `${Colors.destructive}25`, alignItems: "center", gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <PulseDot color={ok ? Colors.success : Colors.destructive} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: ok ? Colors.success : Colors.destructive }}>
                    {value ?? (ok ? "OK" : "ERR")}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sparkline revenus */}
        {sparkData.length > 1 && (
          <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12,
            shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>Revenus — 30 jours</Text>
                <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2 }}>
                  {(stats?.monthRevenue ?? 0).toLocaleString("fr-FR")} € ce mois
                </Text>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: `${Colors.success}15` }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.success }}>
                  {ch.revenue !== null ? `${ch.revenue >= 0 ? "+" : ""}${ch.revenue}% vs M-1` : "Nouveau"}
                </Text>
              </View>
            </View>
            <Sparkline data={sparkData} color={Colors.admin} w={320} h={52} />
          </View>
        )}

        {/* Réservations par statut */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12,
          shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground, marginBottom: 12 }}>Réservations par statut</Text>
          <View style={{ gap: 10 }}>
            {[
              { key: "pending",   label: "En attente", color: Colors.warning },
              { key: "confirmed", label: "Confirmées",  color: Colors.info },
              { key: "completed", label: "Terminées",   color: Colors.success },
              { key: "cancelled", label: "Annulées",    color: Colors.destructive },
            ].map(({ key, label, color }) => {
              const count = byStatus[key] ?? 0;
              const total = Object.values(byStatus).reduce((s: number, v) => s + Number(v), 0);
              const pct   = total > 0 ? (count / total) * 100 : 0;
              return (
                <View key={key}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, fontWeight: "500" }}>{label}</Text>
                    <Text style={{ fontSize: 12, color, fontWeight: "700" }}>{count}</Text>
                  </View>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: Colors.muted }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: color, width: `${pct}%` }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Activité récente */}
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12,
          shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: `${Colors.pro}12`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="pulse-outline" size={15} color={Colors.pro} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>Activité récente</Text>
          </View>
          {activity.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Ionicons name="sparkles-outline" size={26} color={Colors.border} />
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 8 }}>Aucune activité récente</Text>
            </View>
          ) : (
            <View>
              {activity.slice(0, 6).map((item, i) => {
                const cfg = item.type === "booking"
                  ? { color: Colors.pro,     icon: "calendar-outline"   as const }
                  : item.type === "user"
                  ? { color: Colors.info,    icon: "person-add-outline" as const }
                  : { color: Colors.success, icon: "cash-outline"       as const };
                return (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: Colors.border }}>
                    <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${cfg.color}12`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>{item.title}</Text>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }} numberOfLines={1}>{item.description}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: Colors.mutedForeground, flexShrink: 0 }}>{item.time}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Accès rapide */}
        <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
          Accès rapide
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {QUICK_LINKS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push(item.route as any); }}
              style={({ pressed }) => [{
                width: "47%", backgroundColor: Colors.muted, borderRadius: 14,
                padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.border,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${item.color}15`, alignItems: "center", justifyContent: "center" }}>
                {Platform.OS === "ios"
                  ? <SymbolView name={item.symbol} size={18} tintColor={item.color} />
                  : <Ionicons name={item.icon} size={18} color={item.color} />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>{item.label}</Text>
              <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{item.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
