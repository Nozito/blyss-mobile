import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, useWindowDimensions,
  Animated,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Polyline, Rect, Defs, LinearGradient as SvgGrad, Stop, Polygon, Circle,
} from "react-native-svg";
import type { SFSymbol } from "sf-symbols-typescript";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminApi, AdminAnalytics } from "@/lib/api";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ADMIN } from "@/constants/adminTheme";
import { Colors, withAlpha } from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { AdminIcon } from "@/components/admin/AdminIcon";
import { syncAdminAnalyticsWidgets } from "@/lib/widgetSync";
import { formatEUR, formatNumberFR, formatPercentFR } from "@/lib/format";

const BG     = ADMIN.bg;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;
const ACCENT = ADMIN.accent;
const DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

type Period = "week" | "month" | "year" | "all";
const MONTHS_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

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
  data, color, width = 300, height = 80, dates, granularity = "day",
}: {
  data: number[]; color: string; width?: number; height?: number;
  dates?: string[]; granularity?: "day" | "month";
}) {
  if (!data.length) return null;
  const max  = Math.max(...data, 1);
  const barW = Math.max(2, (width - (data.length - 1) * 4) / data.length);
  const n = data.length;
  // Un label ~toutes les 60px pour rester lisible.
  const labelEvery = Math.max(1, Math.ceil((n * (barW + 4)) / (width / 6)));
  const labelFor = (i: number): string => {
    if (i % labelEvery !== 0 && i !== n - 1) return "";
    const d = dates?.[i] ? new Date(dates[i]) : null;
    if (!d || isNaN(d.getTime())) {
      return granularity === "day" && n === 7 ? (DAYS_SHORT[i % 7] ?? "") : String(i + 1);
    }
    return granularity === "month" ? (MONTHS_SHORT[d.getMonth()] ?? "") : String(d.getDate());
  };
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
          const label = labelFor(i);
          return (
            <View
              key={i}
              style={{ width: barW, marginRight: i < data.length - 1 ? 4 : 0, alignItems: "center" }}
            >
              <Text style={{ fontSize: 8, color: TEXT3, fontWeight: "600" }}>
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
  label, value, sub, color, symbol, androidIcon,
}: {
  label: string; value: string | number; sub?: string; color: string;
  symbol: SFSymbol; androidIcon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: ADMIN.surface,
      borderRadius: ADMIN.cardRadius,
      borderWidth: 1,
      borderColor: ADMIN.border,
      padding: 16,
    }}>
      <View style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: withAlpha(color, 0.14), alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <AdminIcon ios={symbol} android={androidIcon} size={16} color={color} />
      </View>
      <Text style={{ ...ADMIN.type.label, color: TEXT2, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ ...ADMIN.type.display, fontSize: 24, color: TEXT1, marginBottom: 2 }}>
        {typeof value === "number" ? formatNumberFR(value) : value}
      </Text>
      {sub && (
        <Text style={{ fontSize: 11, color: TEXT3 }}>{sub}</Text>
      )}
    </View>
  );
}

// ─── ChartHeader ──────────────────────────────────────────────────────────────

function ChartHeader({
  symbol, androidIcon, title, color, badge,
}: {
  symbol: SFSymbol; androidIcon: React.ComponentProps<typeof Ionicons>["name"];
  title: string; color: string; badge: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 4,
        backgroundColor: withAlpha(color, 0.14),
        alignItems: "center", justifyContent: "center",
      }}>
        <AdminIcon ios={symbol} android={androidIcon} size={16} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: TEXT1 }}>{title}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: TEXT2 }}>{badge}</Text>
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
        flex: 1, height: 36,
        alignItems: "center", justifyContent: "center",
        borderRadius: 4,
        backgroundColor: active ? ADMIN.accentBg : "transparent",
        transform: [{ scale }],
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: active ? "700" : "500",
          color: active ? ACCENT : TEXT2,
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
  const revenuePoints  = useMemo(() => (revenueData?.data  ?? []).map((r) => Number(r.revenue)),   [revenueData]);
  const usersPoints    = useMemo(() => (usersData?.data    ?? []).map((r) => Number(r.new_users)), [usersData]);
  const usersDates     = useMemo(() => (usersData?.data    ?? []).map((r) => r.period),            [usersData]);
  const bookingsPoints = useMemo(() => (bookingsData?.data ?? []).map((r) => Number(r.total)),     [bookingsData]);
  const granularity: "day" | "month" = period === "week" || period === "month" ? "day" : "month";

  const growth = a?.revenue?.growth;

  useEffect(() => {
    syncAdminAnalyticsWidgets(a);
  }, [a]);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const PERIOD_OPTS: { value: Period; label: string }[] = [
    { value: "week",  label: "7 j" },
    { value: "month", label: "30 j" },
    { value: "year",  label: "1 an" },
    { value: "all",   label: "Tout" },
  ];

  const CHART_STYLE = {
    backgroundColor: ADMIN.surface,
    borderRadius: ADMIN.cardRadius,
    borderWidth: 1,
    borderColor: ADMIN.border,
    padding: 18,
    marginBottom: 14,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={{ marginBottom: 20 }}>
        <AnimatedPressable
          onPress={() => safeBack(router)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 }}
        >
          <Ionicons name="chevron-back" size={18} color={ACCENT} />
          <Text style={{ ...ADMIN.type.label, fontSize: 12, color: ACCENT }}>Retour</Text>
        </AnimatedPressable>
        <Text style={{ fontSize: 30, fontWeight: "900", color: TEXT1, letterSpacing: -1.4, textTransform: "uppercase" }}>
          Analytics
        </Text>
        <Text style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>
          {today}
        </Text>
      </View>

      {/* ── Hero — CA total, aplat rose plein ── */}
      {a && (
        <View style={{ padding: 22, marginBottom: 14, backgroundColor: ADMIN.accent }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ ...ADMIN.type.label, color: ADMIN.accentSub }}>CA total (réservations)</Text>
            {growth != null && (
              <Text style={{ fontSize: 12, fontWeight: "900", color: ADMIN.accentInk }}>
                {growth >= 0 ? "↑" : "↓"} {formatPercentFR(Math.abs(growth), 1)}
              </Text>
            )}
          </View>

          <Text style={{ ...ADMIN.type.hero, fontSize: 46, lineHeight: 44, color: ADMIN.accentInk, marginBottom: 16 }} numberOfLines={1} adjustsFontSizeToFit>
            {formatNumberFR(a.revenue.total_revenue)}
            <Text style={{ fontSize: 18 }}> €</Text>
          </Text>

          <View style={{ flexDirection: "row", gap: ADMIN.space.xl, marginBottom: 16 }}>
            {[
              { k: "Ce mois", v: formatEUR(a.revenue.month_revenue) },
              { k: "Utilisateurs", v: formatNumberFR(a.users.total_users) },
              { k: "Réservations", v: formatNumberFR(a.bookings.total) },
            ].map((s) => (
              <View key={s.k}>
                <Text style={{ fontSize: 17, fontWeight: "900", letterSpacing: -0.6, color: ADMIN.accentInk }}>{s.v}</Text>
                <Text style={{ ...ADMIN.type.label, color: ADMIN.accentSub, marginTop: 3 }}>{s.k}</Text>
              </View>
            ))}
          </View>

          {revenuePoints.length >= 2 && (
            <Sparkline
              data={revenuePoints.slice(-7)}
              color={ADMIN.accentInk}
              width={chartWidth}
              height={40}
              noFill
              strokeWidth={1.5}
            />
          )}
        </View>
      )}

      {/* ── Period Selector ── */}
      <View style={{
        flexDirection: "row",
        backgroundColor: ADMIN.surfaceHover,
        borderRadius: 4,
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
              <SkeletonBox width="100%" height={100} borderRadius={ADMIN.cardRadius} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={ADMIN.cardRadius} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={ADMIN.cardRadius} />
            </View>
            <View style={{ flex: 1 }}>
              <SkeletonBox width="100%" height={100} borderRadius={ADMIN.cardRadius} />
            </View>
          </View>
        </View>
      ) : a && (
        <View style={{ gap: 10, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard
              label="CA total"
              value={formatEUR(a.revenue.total_revenue)}
              color={ACCENT}
              symbol="banknote"
              androidIcon="cash-outline"
            />
            <KPICard
              label="CA du mois"
              value={formatEUR(a.revenue.month_revenue)}
              color={Colors.success}
              symbol="checkmark.seal.fill"
              androidIcon="checkmark-circle-outline"
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <KPICard
              label="Utilisateurs"
              value={Number(a.users.total_users)}
              sub={`${a.users.new_last_30d} nouveaux 30j`}
              color={Colors.pro}
              symbol="person.fill"
              androidIcon="person-outline"
            />
            <KPICard
              label="Réservations"
              value={Number(a.bookings.total)}
              sub={`${a.bookings.completed} terminées`}
              color={Colors.info}
              symbol="calendar"
              androidIcon="calendar-outline"
            />
          </View>
        </View>
      )}

      {/* ── Revenue Chart ── */}
      <View style={CHART_STYLE}>
        <ChartHeader
          symbol="chart.line.uptrend.xyaxis"
          androidIcon="trending-up-outline"
          title="Revenus"
          color={ACCENT}
          badge={formatEUR(revenuePoints.reduce((s, v) => s + v, 0))}
        />
        {revenuePoints.length > 1 ? (
          <Sparkline data={revenuePoints} color={ACCENT} width={chartWidth} height={72} />
        ) : (
          <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: TEXT3 }}>
              Données en cours de chargement…
            </Text>
          </View>
        )}
      </View>

      {/* ── Users Chart ── */}
      <View style={CHART_STYLE}>
        <ChartHeader
          symbol="person.2.fill"
          androidIcon="people-outline"
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
            dates={usersDates}
            granularity={granularity}
          />
        ) : (
          <View style={{ height: 96, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: TEXT3 }}>
              Données en cours de chargement…
            </Text>
          </View>
        )}
      </View>

      {/* ── Bookings Chart ── */}
      <View style={CHART_STYLE}>
        <ChartHeader
          symbol="calendar.badge.clock"
          androidIcon="calendar-outline"
          title="Réservations"
          color={Colors.info}
          badge={`${bookingsPoints.reduce((s, v) => s + v, 0)} RDV`}
        />
        {bookingsPoints.length > 1 ? (
          <Sparkline data={bookingsPoints} color={Colors.info} width={chartWidth} height={72} />
        ) : (
          <View style={{ height: 72, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, color: TEXT3 }}>
              Données en cours de chargement…
            </Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}
