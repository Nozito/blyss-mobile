import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Polyline, Rect, Defs, LinearGradient as SvgGrad, Stop, Polygon } from "react-native-svg";
import { adminApi, AdminAnalytics } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";

type Period = "week" | "month" | "year";

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: Colors.admin }} />
      <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.foreground }}>{title}</Text>
    </View>
  );
}

function Sparkline({ data, color, width = 300, height = 60 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max   = Math.max(...data, 1);
  const min   = Math.min(...data);
  const range = max - min || 1;
  const pad   = 4;
  const pts   = data.map((v, i) => {
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
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Polygon points={fill} fill="url(#g)" />
      <Polyline points={poly} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function BarChart({ data, color, width = 300, height = 80 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const max  = Math.max(...data, 1);
  const barW = (width - (data.length - 1) * 4) / data.length;
  return (
    <Svg width={width} height={height}>
      {data.map((v, i) => {
        const barH = Math.max(4, (v / max) * (height - 8));
        return (
          <Rect key={i} x={i * (barW + 4)} y={height - barH} width={barW} height={barH} rx={3} fill={color} fillOpacity={0.75} />
        );
      })}
    </Svg>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: A_BORDER,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
      <Text style={{ fontSize: 11, color: Colors.mutedForeground, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "900", color, marginBottom: 2 }}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </Text>
      {sub && <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{sub}</Text>}
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
  const revenuePoints  = (revenueData?.data  ?? []).map((r) => Number(r.revenue));
  const usersPoints    = (usersData?.data     ?? []).map((r) => Number(r.new_users));
  const bookingsPoints = (bookingsData?.data  ?? []).map((r) => Number(r.total));

  const PERIOD_LABELS: Record<Period, string> = { week: "7 derniers jours", month: "30 derniers jours", year: "12 derniers mois" };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: A_BG }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 24, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>Analytics</Text>
      </View>

      {/* Hero revenue card */}
      {a && (
        <LinearGradient
          colors={["#EA6000", "#F97316", "#FBAB6A"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 20, marginBottom: 16, overflow: "hidden" }}
        >
          <View style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.78)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>CA Total</Text>
          <Text style={{ fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: -1 }}>
            {Number(a.revenue.total_revenue).toLocaleString("fr-FR")} €
          </Text>
          <View style={{ flexDirection: "row", gap: 20, marginTop: 12 }}>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: "600" }}>Ce mois</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{Number(a.revenue.month_revenue).toLocaleString("fr-FR")} €</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: "600" }}>Utilisateurs</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{Number(a.users.total_users).toLocaleString("fr-FR")}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: "600" }}>Réservations</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{Number(a.bookings.total).toLocaleString("fr-FR")}</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Period selector */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
        {(["week", "month", "year"] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, alignItems: "center",
              backgroundColor: period === p ? Colors.admin : Colors.card,
              borderColor: period === p ? Colors.admin : A_BORDER }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: period === p ? Colors.white : Colors.mutedForeground }}>
              {p === "week" ? "7j" : p === "month" ? "30j" : "1an"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Global KPIs */}
      {isLoading ? (
        <View style={{ gap: 12, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><SkeletonBox width="100%" height={80} borderRadius={12} /></View>
            <View style={{ flex: 1 }}><SkeletonBox width="100%" height={80} borderRadius={12} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}><SkeletonBox width="100%" height={80} borderRadius={12} /></View>
            <View style={{ flex: 1 }}><SkeletonBox width="100%" height={80} borderRadius={12} /></View>
          </View>
        </View>
      ) : a && (
        <View style={{ gap: 10, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard label="CA total"   value={`${Number(a.revenue.total_revenue).toLocaleString("fr-FR")} €`} color={Colors.admin} />
            <KPICard label="CA du mois" value={`${Number(a.revenue.month_revenue).toLocaleString("fr-FR")} €`} color={Colors.success} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard label="Utilisateurs" value={Number(a.users.total_users)}   sub={`${a.users.new_last_30d} nouveaux 30j`}  color={Colors.pro} />
            <KPICard label="Réservations" value={Number(a.bookings.total)}       sub={`${a.bookings.completed} terminées`}     color={Colors.info} />
          </View>
        </View>
      )}

      {/* Revenue chart */}
      <View style={{ backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: A_BORDER, padding: 20, marginBottom: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
        <SectionTitle title="Revenus" />
        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 14, marginTop: -8 }}>{PERIOD_LABELS[period]}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${Colors.admin}15` }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.admin }}>
              {revenuePoints.reduce((a, b) => a + b, 0).toLocaleString("fr-FR")} €
            </Text>
          </View>
        </View>
        {revenuePoints.length > 1
          ? <Sparkline data={revenuePoints} color={Colors.admin} width={320} height={64} />
          : <View style={{ height: 64, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Données en cours de chargement…</Text>
            </View>}
      </View>

      {/* Users chart */}
      <View style={{ backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: A_BORDER, padding: 20, marginBottom: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
        <SectionTitle title="Nouveaux utilisateurs" />
        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 14, marginTop: -8 }}>Inscriptions sur la période</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${Colors.pro}15` }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.pro }}>
              {usersPoints.reduce((a, b) => a + b, 0)} inscrits
            </Text>
          </View>
        </View>
        {usersPoints.length > 1
          ? <BarChart data={usersPoints} color={Colors.pro} width={320} height={80} />
          : <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Données en cours de chargement…</Text>
            </View>}
      </View>

      {/* Bookings chart */}
      <View style={{ backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: A_BORDER, padding: 20, marginBottom: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
        <SectionTitle title="Réservations" />
        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 14, marginTop: -8 }}>Volume sur la période</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${Colors.info}15` }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.info }}>
              {bookingsPoints.reduce((a, b) => a + b, 0)} RDV
            </Text>
          </View>
        </View>
        {bookingsPoints.length > 1
          ? <Sparkline data={bookingsPoints} color={Colors.info} width={320} height={64} />
          : <View style={{ height: 64, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Données en cours de chargement…</Text>
            </View>}
      </View>

      {/* Bookings breakdown */}
      {a && (
        <View style={{ backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: A_BORDER, padding: 20, marginBottom: 16,
          shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
          <SectionTitle title="Répartition des statuts" />
          {[
            { label: "Confirmées", value: a.bookings.confirmed, color: Colors.info },
            { label: "Terminées",  value: a.bookings.completed, color: Colors.success },
            { label: "En attente", value: a.bookings.pending,   color: Colors.warning },
            { label: "Annulées",   value: a.bookings.cancelled, color: Colors.destructive },
          ].map(({ label, value, color }) => {
            const pct = a.bookings.total > 0 ? (Number(value) / Number(a.bookings.total)) * 100 : 0;
            return (
              <View key={label} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    <Text style={{ fontSize: 12, color: Colors.foreground, fontWeight: "600" }}>{label}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color, fontWeight: "700" }}>{value} ({pct.toFixed(0)}%)</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: A_BG }}>
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
