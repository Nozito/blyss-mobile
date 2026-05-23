import React, { useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, Animated,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Polyline, Defs, LinearGradient as SvgGradient, Stop, Polygon } from "react-native-svg";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ── Dark admin palette ────────────────────────────────────────────────────────
const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  totalUsers: number; totalPros: number; totalClients: number;
  totalBookings: number; todayBookings: number;
  totalRevenue: number; monthRevenue: number; activeUsers: number;
  bookingsByStatus: Record<string, number>;
  changes: { clients: number | null; pros: number | null; users: number | null; revenue: number | null; bookings: number | null };
}
interface ActivityItem { type: "booking" | "user" | "payment"; title: string; description: string; time: string }
interface HealthStatus { status: "ok" | "degraded"; db: "ok" | "error" }


// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, width = 280, height = 56 }: { data: number[]; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });
  const polyPts = pts.join(" ");
  const fillPts = `${pad},${height - pad} ${polyPts} ${width - pad},${height - pad}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ACCENT} stopOpacity="0.3" />
          <Stop offset="1" stopColor={ACCENT} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Polygon points={fillPts} fill="url(#sg)" />
      <Polyline points={polyPts} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w, h, radius = 10 }: { w: string | number; h: number; radius?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: radius, backgroundColor: "rgba(255,255,255,0.12)", opacity: anim }} />;
}

// ── Change badge ──────────────────────────────────────────────────────────────
function ChangeBadge({ val }: { val: number | null }) {
  if (val === null) return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)" }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: MUTED }}>Nouveau</Text>
    </View>
  );
  const up = val >= 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
      <Ionicons name={up ? "trending-up" : "trending-down"} size={11} color={up ? "#4ADE80" : "#F87171"} />
      <Text style={{ fontSize: 10, fontWeight: "700", color: up ? "#4ADE80" : "#F87171" }}>{val > 0 ? "+" : ""}{val}%</Text>
    </View>
  );
}

// ── KPI card (extracted to respect rules of hooks) ────────────────────────────
function KPICard({ title, value, change, icon, color, suffix = "" }: {
  title: string; value: number; change: number | null;
  icon: keyof typeof Ionicons.glyphMap; color: string; suffix?: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = React.useState(0);

  useEffect(() => {
    if (!value) return;
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 1100, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);

  return (
    <View style={{ width: "47%", borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, padding: 18, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${color}08` }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <ChangeBadge val={change} />
      </View>
      <Text style={{ fontSize: 30, fontWeight: "900", color: TEXT, letterSpacing: -1, marginBottom: 2 }}>
        {display.toLocaleString("fr-FR")}{suffix}
      </Text>
      <Text style={{ fontSize: 12, color: MUTED, fontWeight: "500" }}>{title}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboardStats() as Promise<{ success: boolean; stats: Stats; recentActivity: ActivityItem[]; revenueHistory?: number[] }>,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => adminApi.getHealth() as unknown as Promise<HealthStatus>,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const stats = data?.stats ?? null;
  const activity = data?.recentActivity ?? [];
  const sparkData = data?.revenueHistory ?? [];
  const byStatus = stats?.bookingsByStatus ?? {};
  const ch = stats?.changes ?? { clients: null, pros: null, users: null, revenue: null, bookings: null };
  const apiOk = healthData?.status === "ok";
  const dbOk = healthData?.db === "ok";

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const KPI_CARDS = [
    { title: "Clients", value: stats?.totalClients ?? 0, change: ch.clients, icon: "person-add-outline" as const, color: "#A78BFA" },
    { title: "Pros", value: stats?.totalPros ?? 0, change: ch.pros, icon: "briefcase-outline" as const, color: ACCENT },
    { title: "CA mois", value: stats?.monthRevenue ?? 0, change: ch.revenue, icon: "trending-up-outline" as const, color: "#4ADE80", prefix: "", suffix: "€" },
    { title: "RDV / jour", value: stats?.todayBookings ?? 0, change: ch.bookings, icon: "calendar-outline" as const, color: "#38BDF8" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero banner */}
      <LinearGradient
        colors={["rgba(249,115,22,0.18)", "rgba(249,115,22,0.04)", "transparent"]}
        style={{ borderRadius: 24, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", padding: 20, marginBottom: 24 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "800", color: ACCENT, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
              Admin · Blyss
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>
              Bonjour, {user?.first_name} 👋
            </Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 2, textTransform: "capitalize" }}>{dateStr}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: apiOk ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)" }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: apiOk ? "#4ADE80" : "#F87171" }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: apiOk ? "#4ADE80" : "#F87171" }}>
                {apiOk ? "Systèmes OK" : "Dégradé"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, backgroundColor: dbOk ? "rgba(56,189,248,0.12)" : "rgba(248,113,113,0.12)" }}>
              <Ionicons name="server-outline" size={11} color={dbOk ? "#38BDF8" : "#F87171"} />
              <Text style={{ fontSize: 10, fontWeight: "600", color: dbOk ? "#38BDF8" : "#F87171" }}>DB</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* KPI Cards */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        {isLoading
          ? [0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: "47%", borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 12 }}>
                <Skeleton w={40} h={40} radius={12} />
                <Skeleton w="60%" h={28} />
                <Skeleton w="80%" h={12} />
              </View>
            ))
          : KPI_CARDS.map((card) => (
              <KPICard key={card.title} title={card.title} value={card.value} change={card.change} icon={card.icon} color={card.color} suffix={card.suffix} />
            ))}
      </View>

      {/* Sparkline revenus */}
      {(sparkData.length > 1 || !isLoading) && (
        <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT }}>Revenus — 30 jours</Text>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {isLoading ? "—" : `${(stats?.monthRevenue ?? 0).toLocaleString("fr-FR")} €`}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(74,222,128,0.12)" }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#4ADE80" }}>
                {ch.revenue !== null ? `${ch.revenue >= 0 ? "+" : ""}${ch.revenue}% vs M-1` : "—"}
              </Text>
            </View>
          </View>
          {isLoading ? (
            <Skeleton w="100%" h={56} radius={8} />
          ) : sparkData.length > 1 ? (
            <Sparkline data={sparkData} width={280} height={56} />
          ) : (
            <View style={{ height: 56, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Données sparkline non disponibles</Text>
            </View>
          )}
        </View>
      )}

      {/* Activité récente */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(167,139,250,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="pulse-outline" size={18} color="#A78BFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>Activité récente</Text>
            <Text style={{ fontSize: 11, color: MUTED }}>Dernières 24h</Text>
          </View>
        </View>
        {isLoading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)" }}>
                <Skeleton w={38} h={38} radius={11} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton w="70%" h={12} />
                  <Skeleton w="50%" h={10} />
                </View>
              </View>
            ))}
          </View>
        ) : activity.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Ionicons name="sparkles-outline" size={32} color="rgba(255,255,255,0.1)" />
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 10 }}>Aucune activité récente</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {activity.slice(0, 8).map((item, i) => {
              const cfg = item.type === "booking"
                ? { color: "#A78BFA", bg: "rgba(167,139,250,0.12)", icon: "calendar-outline" as const }
                : item.type === "user"
                ? { color: "#38BDF8", bg: "rgba(56,189,248,0.12)", icon: "person-add-outline" as const }
                : { color: "#4ADE80", bg: "rgba(74,222,128,0.12)", icon: "cash-outline" as const };
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: cfg.bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: TEXT }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: MUTED }} numberOfLines={1}>{item.description}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>{item.time}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Réservations par statut */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 20 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, marginBottom: 14 }}>Réservations</Text>
        <View style={{ gap: 8 }}>
          {[
            { key: "pending", label: "En attente", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
            { key: "confirmed", label: "Confirmées", color: "#38BDF8", bg: "rgba(56,189,248,0.12)" },
            { key: "completed", label: "Terminées", color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
            { key: "cancelled", label: "Annulées", color: "#F87171", bg: "rgba(248,113,113,0.12)" },
          ].map(({ key, label, color, bg }) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, backgroundColor: bg }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color }}>{label}</Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color }}>{byStatus[key] ?? 0}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Accès rapide */}
      <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12, paddingHorizontal: 2 }}>
        Accès rapide
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { icon: "analytics-outline" as const, label: "Analytics", route: "/(admin)/analytics" },
          { icon: "pulse-outline" as const, label: "Logs", route: "/(admin)/logs" },
          { icon: "notifications-outline" as const, label: "Notifs", route: "/(admin)/notifications" },
          { icon: "pricetag-outline" as const, label: "Coupons", route: "/(admin)/coupons" },
        ].map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            style={{ flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 14, alignItems: "center", gap: 8, borderWidth: 1, borderColor: BORDER }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "rgba(249,115,22,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={item.icon} size={18} color={ACCENT} />
            </View>
            <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT, textAlign: "center" }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
