import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, useWindowDimensions,
  Animated, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Polyline, Rect, Defs, LinearGradient as SvgGrad, Stop, Polygon, Circle,
} from "react-native-svg";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminApi, AdminAnalytics } from "@/lib/api";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ADMIN } from "@/constants/adminTheme";
import { Colors } from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

const A_BG     = ADMIN.bg;
const A_BORDER = ADMIN.border;
const DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

type Period = "week" | "month" | "year";

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data, color, width = 300, height = 60, noFill = false, strokeWidth = 2.5,
}: {
  data: number[]; color: string; width?: number; height?: number;
  noFill?: boolean; strokeWidth?: number;
}) {
  if (data.length < 2) return null;
  const max   = Math.max(...data, 1);
  const min   = Math.min(...data);
  const range = max - min || 1;
  const pad   = 4;
  const pts   = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / range) * (height - pad * 2),
  }));
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const fill = `${pad},${height - pad} ${poly} ${width - pad},${height - pad}`;
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id={`sg_${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.18" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      {!noFill && (
        <Polygon
          points={fill}
          fill={`url(#sg_${color.replace(/[^a-z0-9]/gi, "")})`}
        />
      )}
      <Polyline
        points={poly}
        fill="none"
        stroke={color}
        strokeWidth={String(strokeWidth)}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {!noFill && <Circle cx={last.x} cy={last.y} r={4} fill={color} />}
    </Svg>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

function BarChart({
  data, color, width = 300, height = 80, isWeek = false,
}: {
  data: number[]; color: string; width?: number; height?: number; isWeek?: boolean;
}) {
  if (!data.length) return null;
  const max  = Math.max(...data, 1);
  const barW = Math.max(2, (width - (data.length - 1) * 4) / data.length);
  return (
    <View>
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
              rx={4}
              fill={color}
              fillOpacity={0.85}
            />
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", paddingTop: 4, paddingBottom: 8 }}>
        {data.map((_, i) => {
          const label = isWeek
            ? (DAYS_SHORT[i % 7] ?? String(i + 1))
            : (data.length <= 31 ? String(i + 1) : "");
          return (
            <View
              key={i}
              style={{ width: barW, marginRight: i < data.length - 1 ? 4 : 0, alignItems: "center" }}
            >
              <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── KPICard ──────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, color, symbol,
}: {
  label: string; value: string | number; sub?: string; color: string;
  symbol: string;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      padding: 18,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
        <SymbolView name={symbol as any} size={20} tintColor={`${color}85`} />
      </View>
      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 26, fontWeight: "900", color, marginBottom: 2 }}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </Text>
      {sub && (
        <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{sub}</Text>
      )}
    </View>
  );
}

// ─── ChartHeader ──────────────────────────────────────────────────────────────

function ChartHeader({
  symbol, title, color, badge,
}: {
  symbol: string; title: string; color: string; badge: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: `${color}18`,
        alignItems: "center", justifyContent: "center",
      }}>
        <SymbolView name={symbol as any} size={18} tintColor={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: "900", color: Colors.white }}>{title}</Text>
      <View style={{
        backgroundColor: `${color}15`,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color }}>{badge}</Text>
      </View>
    </View>
  );
}

// ─── PeriodPill ───────────────────────────────────────────────────────────────

function PeriodPill({
  label, active, onPress,
}: {
  label: string; active: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex: 1 }}
    >
      <Animated.View style={{
        flex: 1, height: 40,
        alignItems: "center", justifyContent: "center",
        borderRadius: 14,
        backgroundColor: active ? "rgba(249,115,22,0.25)" : "transparent",
        transform: [{ scale }],
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: active ? "800" : "600",
          color: active ? Colors.admin : "rgba(255,255,255,0.4)",
        }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const [period, setPeriod] = useState<Period>("month");

  const chartWidth = windowWidth - 32 - 32;

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

  const growth = (a as any)?.revenue?.growth as number | null | undefined;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const PERIOD_OPTS: { value: Period; label: string }[] = [
    { value: "week",  label: "7 jours" },
    { value: "month", label: "30 jours" },
    { value: "year",  label: "1 an" },
  ];

  const CHART_STYLE = {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
    marginBottom: 16,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: A_BG }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={{ marginBottom: 22 }}>
        <AnimatedPressable
          onPress={() => safeBack(router)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 }}
        >
          {Platform.OS === "ios"
            ? <SymbolView name="chevron.left" size={16} tintColor={ADMIN.accent} />
            : <Ionicons name="chevron-back" size={18} color={ADMIN.accent} />}
          <Text style={{ fontSize: 15, fontWeight: "700", color: ADMIN.accent }}>Retour</Text>
        </AnimatedPressable>
        <Text style={{ fontSize: 34, fontWeight: "900", color: Colors.white, letterSpacing: -1 }}>
          Analytics
        </Text>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
          {today}
        </Text>
      </View>

      {/* ── Hero Revenue Card ── */}
      {a && (
        <LinearGradient
          colors={["#0F0800", "#1C0F00", "#0F0800"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 28, padding: 24, marginBottom: 16, overflow: "hidden" }}
        >
          {/* Orbs décoratifs */}
          <View style={{
            position: "absolute", top: -40, right: -40,
            width: 160, height: 160, borderRadius: 80,
            backgroundColor: "rgba(249,115,22,0.06)",
          }} />
          <View style={{
            position: "absolute", bottom: -20, left: -20,
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: "rgba(249,115,22,0.04)",
          }} />
          <View style={{
            position: "absolute", top: "40%", left: "30%",
            width: 200, height: 200, borderRadius: 100,
            backgroundColor: "rgba(249,115,22,0.03)",
          }} />

          {/* Label + badge croissance */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text style={{
              fontSize: 10, fontWeight: "700",
              color: "rgba(249,115,22,0.6)",
              textTransform: "uppercase", letterSpacing: 2,
            }}>
              CA TOTAL
            </Text>
            {growth != null && (
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                backgroundColor: "rgba(249,115,22,0.15)",
              }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.admin }}>
                  {growth >= 0 ? "↑" : "↓"} {Math.abs(growth).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {/* Valeur totale */}
          <Text style={{
            fontSize: 52, fontWeight: "900", color: Colors.white, letterSpacing: -2, marginBottom: 16,
          }}>
            {Number(a.revenue.total_revenue).toLocaleString("fr-FR")} €
          </Text>

          {/* Grille 3 colonnes */}
          <View style={{
            flexDirection: "row", marginBottom: 16,
            borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)",
            paddingTop: 14,
          }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginBottom: 4 }}>
                CE MOIS
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.white }}>
                {Number(a.revenue.month_revenue).toLocaleString("fr-FR")} €
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.10)" }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginBottom: 4 }}>
                UTILISATEURS
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.white }}>
                {Number(a.users.total_users).toLocaleString("fr-FR")}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.10)" }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginBottom: 4 }}>
                RÉSERVATIONS
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.white }}>
                {Number(a.bookings.total).toLocaleString("fr-FR")}
              </Text>
            </View>
          </View>

          {/* Mini sparkline */}
          {revenuePoints.length >= 2 && (
            <Sparkline
              data={revenuePoints.slice(-7)}
              color="rgba(249,115,22,0.4)"
              width={chartWidth}
              height={40}
              noFill
              strokeWidth={1.5}
            />
          )}
        </LinearGradient>
      )}

      {/* ── Period Selector ── */}
      <View style={{
        flexDirection: "row",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        padding: 4,
        marginBottom: 20,
      }}>
        {PERIOD_OPTS.map(({ value, label }) => (
          <PeriodPill
            key={value}
            label={label}
            active={period === value}
            onPress={() => setPeriod(value)}
          />
        ))}
      </View>

      {/* ── KPI Cards 2×2 ── */}
      {isLoading ? (
        <View style={{ gap: 10, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={22} style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={22} style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={22} style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={22} style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
            </View>
          </View>
        </View>
      ) : a && (
        <View style={{ gap: 10, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard
              label="CA total"
              value={`${Number(a.revenue.total_revenue).toLocaleString("fr-FR")} €`}
              color={Colors.admin}
              symbol="banknote"
            />
            <KPICard
              label="CA du mois"
              value={`${Number(a.revenue.month_revenue).toLocaleString("fr-FR")} €`}
              color={Colors.success}
              symbol="checkmark.seal.fill"
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard
              label="Utilisateurs"
              value={Number(a.users.total_users)}
              sub={`${a.users.new_last_30d} nouveaux 30j`}
              color={Colors.pro}
              symbol="person.fill"
            />
            <KPICard
              label="Réservations"
              value={Number(a.bookings.total)}
              sub={`${a.bookings.completed} terminées`}
              color={Colors.info}
              symbol="calendar"
            />
          </View>
        </View>
      )}

      {/* ── Revenue Chart ── */}
      <View style={CHART_STYLE}>
        <ChartHeader
          symbol="chart.line.uptrend.xyaxis"
          title="Revenus"
          color={Colors.admin}
          badge={`${revenuePoints.reduce((s, v) => s + v, 0).toLocaleString("fr-FR")} €`}
        />
        {revenuePoints.length > 1 ? (
          <Sparkline data={revenuePoints} color={Colors.admin} width={chartWidth} height={72} />
        ) : (
          <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Données en cours de chargement…
            </Text>
          </View>
        )}
      </View>

      {/* ── Users Chart ── */}
      <View style={CHART_STYLE}>
        <ChartHeader
          symbol="person.2.fill"
          title="Nouveaux utilisateurs"
          color={Colors.pro}
          badge={`${usersPoints.reduce((s, v) => s + v, 0)} inscrits`}
        />
        {usersPoints.length > 1 ? (
          <BarChart
            data={usersPoints}
            color={Colors.pro}
            width={chartWidth}
            height={80}
            isWeek={period === "week"}
          />
        ) : (
          <View style={{ height: 96, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Données en cours de chargement…
            </Text>
          </View>
        )}
      </View>

      {/* ── Bookings Chart ── */}
      <View style={CHART_STYLE}>
        <ChartHeader
          symbol="calendar.badge.clock"
          title="Réservations"
          color={Colors.info}
          badge={`${bookingsPoints.reduce((s, v) => s + v, 0)} RDV`}
        />
        {bookingsPoints.length > 1 ? (
          <Sparkline data={bookingsPoints} color={Colors.info} width={chartWidth} height={72} />
        ) : (
          <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Données en cours de chargement…
            </Text>
          </View>
        )}
      </View>

      {/* ── Bookings Breakdown ── */}
      {a && (
        <View style={CHART_STYLE}>
          <ChartHeader
            symbol="chart.pie.fill"
            title="Répartition des statuts"
            color={Colors.warning}
            badge={`${Number(a.bookings.total)} total`}
          />
          {[
            { label: "Confirmées", value: a.bookings.confirmed, color: Colors.info },
            { label: "Terminées",  value: a.bookings.completed, color: Colors.success },
            { label: "En attente", value: a.bookings.pending,   color: Colors.warning },
            { label: "Annulées",   value: a.bookings.cancelled, color: "#F03A3A" },
          ].map(({ label, value, color }) => {
            const pct = a.bookings.total > 0
              ? (Number(value) / Number(a.bookings.total)) * 100
              : 0;
            return (
              <View key={label} style={{ marginBottom: 14 }}>
                <View style={{
                  flexDirection: "row", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 6,
                }}>
                  <Text style={{ fontSize: 13, color: Colors.white, fontWeight: "600" }}>{label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 13, color, fontWeight: "700" }}>
                      {Number(value).toLocaleString("fr-FR")}
                    </Text>
                    <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                      {pct.toFixed(0)}%
                    </Text>
                  </View>
                </View>
                <View style={{
                  height: 10, borderRadius: 5,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}>
                  <LinearGradient
                    colors={[color, `${color}80`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ height: 10, borderRadius: 5, width: `${pct}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
