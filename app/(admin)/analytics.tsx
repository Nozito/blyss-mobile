import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Animated, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Polyline, Rect, Defs, LinearGradient as SvgGrad, Stop, Polygon } from "react-native-svg";
import { adminApi, AdminAnalytics } from "@/lib/api";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type Period = "week" | "month" | "year";

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

function Sparkline({ data, color = ACCENT, width = 300, height = 60 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });
  const poly = pts.join(" ");
  const fill = `${pad},${height - pad} ${poly} ${width - pad},${height - pad}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Polygon points={fill} fill="url(#g)" />
      <Polyline points={poly} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function BarChart({ data, color = ACCENT, width = 300, height = 80 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const barW = (width - (data.length - 1) * 4) / data.length;
  return (
    <Svg width={width} height={height}>
      {data.map((v, i) => {
        const barH = Math.max(4, (v / max) * (height - 8));
        return (
          <Rect
            key={i}
            x={i * (barW + 4)}
            y={height - barH}
            width={barW}
            height={barH}
            rx={3}
            fill={color}
            fillOpacity={0.7}
          />
        );
      })}
    </Svg>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 11, color: MUTED, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "900", color, marginBottom: 2 }}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </Text>
      {sub && <Text style={{ fontSize: 11, color: MUTED }}>{sub}</Text>}
    </View>
  );
}

export default function AdminAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.getAnalytics(),
    staleTime: 5 * 60_000,
  });

  const { data: revenueData } = useQuery({
    queryKey: ["admin-analytics-revenue", period],
    queryFn: () => adminApi.getRevenueAnalytics(period),
    staleTime: 5 * 60_000,
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-analytics-users", period],
    queryFn: () => adminApi.getUsersAnalytics(period),
    staleTime: 5 * 60_000,
  });

  const { data: bookingsData } = useQuery({
    queryKey: ["admin-analytics-bookings", period],
    queryFn: () => adminApi.getBookingsAnalytics(period),
    staleTime: 5 * 60_000,
  });

  const a = analytics?.data as AdminAnalytics | undefined;
  const revenuePoints = (revenueData?.data ?? []).map((r) => Number(r.revenue));
  const usersPoints = (usersData?.data ?? []).map((r) => Number(r.new_users));
  const bookingsPoints = (bookingsData?.data ?? []).map((r) => Number(r.total));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={TEXT} />
        </Pressable>
        <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>Analytics</Text>
      </View>

      {/* Period selector */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 22 }}>
        {(["week", "month", "year"] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, alignItems: "center",
              backgroundColor: period === p ? ACCENT : CARD,
              borderColor: period === p ? ACCENT : BORDER }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: period === p ? "#fff" : MUTED }}>
              {p === "week" ? "7j" : p === "month" ? "30j" : "1an"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Global KPIs */}
      {isLoading ? (
        <View style={{ gap: 12, marginBottom: 22 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton w="47%" h={80} radius={18} />
            <Skeleton w="47%" h={80} radius={18} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton w="47%" h={80} radius={18} />
            <Skeleton w="47%" h={80} radius={18} />
          </View>
        </View>
      ) : a && (
        <View style={{ gap: 10, marginBottom: 22 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard label="CA total" value={`${Number(a.revenue.total_revenue).toLocaleString("fr-FR")} €`} color={ACCENT} />
            <KPICard label="CA du mois" value={`${Number(a.revenue.month_revenue).toLocaleString("fr-FR")} €`} color="#4ADE80" />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard label="Utilisateurs" value={Number(a.users.total_users)} sub={`${a.users.new_last_30d} nouveaux 30j`} color="#A78BFA" />
            <KPICard label="Réservations" value={Number(a.bookings.total)} sub={`${a.bookings.completed} terminées`} color="#38BDF8" />
          </View>
        </View>
      )}

      {/* Revenue chart */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>Revenus</Text>
            <Text style={{ fontSize: 11, color: MUTED }}>{period === "week" ? "7 derniers jours" : period === "month" ? "30 derniers jours" : "12 derniers mois"}</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.12)" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: ACCENT }}>
              {revenuePoints.reduce((a, b) => a + b, 0).toLocaleString("fr-FR")} €
            </Text>
          </View>
        </View>
        {revenuePoints.length > 1
          ? <Sparkline data={revenuePoints} color={ACCENT} width={320} height={64} />
          : <View style={{ height: 64, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Données en cours de chargement…</Text>
            </View>}
      </View>

      {/* Users chart */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>Nouveaux utilisateurs</Text>
            <Text style={{ fontSize: 11, color: MUTED }}>Inscriptions sur la période</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(167,139,250,0.12)" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#A78BFA" }}>
              {usersPoints.reduce((a, b) => a + b, 0)} inscrits
            </Text>
          </View>
        </View>
        {usersPoints.length > 1
          ? <BarChart data={usersPoints} color="#A78BFA" width={320} height={80} />
          : <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Données en cours de chargement…</Text>
            </View>}
      </View>

      {/* Bookings chart */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>Réservations</Text>
            <Text style={{ fontSize: 11, color: MUTED }}>Volume sur la période</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(56,189,248,0.12)" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#38BDF8" }}>
              {bookingsPoints.reduce((a, b) => a + b, 0)} RDV
            </Text>
          </View>
        </View>
        {bookingsPoints.length > 1
          ? <Sparkline data={bookingsPoints} color="#38BDF8" width={320} height={64} />
          : <View style={{ height: 64, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Données en cours de chargement…</Text>
            </View>}
      </View>

      {/* Bookings breakdown */}
      {a && (
        <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, marginBottom: 14 }}>Répartition des statuts</Text>
          {[
            { label: "Confirmées", value: a.bookings.confirmed, color: "#38BDF8" },
            { label: "Terminées",  value: a.bookings.completed, color: "#4ADE80" },
            { label: "En attente", value: a.bookings.pending,   color: "#FBBF24" },
            { label: "Annulées",   value: a.bookings.cancelled, color: "#F87171" },
          ].map(({ label, value, color }) => {
            const pct = a.bookings.total > 0 ? (Number(value) / Number(a.bookings.total)) * 100 : 0;
            return (
              <View key={label} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: TEXT, fontWeight: "600" }}>{label}</Text>
                  <Text style={{ fontSize: 12, color, fontWeight: "700" }}>{value} ({pct.toFixed(0)}%)</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
