import React, { useRef, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Animated, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { proApi } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type ReportSummary = {
  id: number;
  periodType: "week" | "month";
  periodStart: string;
  periodEnd: string;
  revenue: number;
  previousRevenue: number;
  bookingsCount: number;
  avgBasket: number;
  viewedAt: string | null;
  createdAt: string;
};

type ReportDetail = ReportSummary & {
  topServices: Array<{ name: string; revenue: number; count: number; percentage: number }>;
};

function fmtRange(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const e = new Date(end).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${s} – ${e}`;
}

function ReportRow({ report }: { report: ReportSummary }) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const isUnviewed = !report.viewedAt;
  const variation = report.previousRevenue > 0
    ? Math.round(((report.revenue - report.previousRevenue) / report.previousRevenue) * 100)
    : null;

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail) {
      setLoadingDetail(true);
      try {
        const res = await proApi.getFinanceReport(report.id);
        if (res.success && res.data) setDetail(res.data as ReportDetail);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  return (
    <Pressable
      onPress={toggle}
      style={{ backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={report.periodType === "week" ? "calendar-outline" : "bar-chart-outline"} size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.foreground }}>
                {report.periodType === "week" ? "Rapport hebdomadaire" : "Rapport mensuel"}
              </Text>
              {isUnviewed && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
              )}
            </View>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
              {fmtRange(report.periodStart, report.periodEnd)}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 15, fontWeight: "900", color: colors.foreground }}>{report.revenue.toFixed(0)} €</Text>
          {variation !== null && (
            <Text style={{ fontSize: 10, fontWeight: "700", color: variation >= 0 ? "#34C759" : colors.destructive }}>
              {variation >= 0 ? "+" : ""}{variation}%
            </Text>
          )}
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
      </View>

      {expanded && (
        <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
          {loadingDetail ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : detail ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.foreground }}>{detail.bookingsCount}</Text>
                  <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Rendez-vous</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.foreground }}>{detail.avgBasket.toFixed(0)} €</Text>
                  <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Panier moyen</Text>
                </View>
              </View>

              {detail.topServices.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Top prestations
                  </Text>
                  {detail.topServices.map((svc) => (
                    <View key={svc.name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: colors.foreground, flex: 1 }} numberOfLines={1}>{svc.name}</Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{svc.revenue.toFixed(0)} €</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Impossible de charger le détail.</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function ProFinanceReportsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  const { data, isLoading } = useQuery({
    queryKey: ["pro-finance-reports"],
    queryFn: () => proApi.getFinanceReports(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isLoading || reduceMotion) return;
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [isLoading, reduceMotion, contentOpacity]);

  const reports = (data?.data as ReportSummary[] | undefined) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Rapports automatiques</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Générés chaque semaine et chaque mois</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : reports.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
            <Ionicons name="document-text-outline" size={48} color={colors.border} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Aucun rapport pour l'instant</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
              Ton premier rapport hebdomadaire arrivera dès la fin de la semaine
            </Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: contentOpacity, gap: 10 }}>
            {reports.map((r) => <ReportRow key={r.id} report={r} />)}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
