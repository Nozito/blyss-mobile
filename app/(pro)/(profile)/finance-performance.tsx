import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Animated } from "react-native";
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
import { hasPlanAtLeast } from "@/constants/plans";
import { useRevenueCat } from "@/contexts/RevenueCatContext";

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function ProFinancePerformanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const { activePlan, isReady: rcReady } = useRevenueCat();

  const { data, isLoading } = useQuery({
    queryKey: ["pro-finance-performance"],
    queryFn: () => proApi.getFinancePerformance(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isLoading || reduceMotion) return;
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [isLoading, reduceMotion, contentOpacity]);

  // Analyses de performance = Signature — même garde que finance-reports.tsx.
  useEffect(() => {
    if (!rcReady) return;
    if (!hasPlanAtLeast(activePlan, "signature")) {
      router.replace({ pathname: "/(pro)/(profile)/upgrade", params: { requiredPlan: "signature" } });
    }
  }, [rcReady, activePlan, router]);

  const perf = data?.data;
  const totalClients = perf ? perf.newClients + perf.returningClients : 0;
  const returningPct = perf && totalClients > 0 ? Math.round((perf.returningClients / totalClients) * 100) : 0;
  const maxRevenue = Math.max(1, ...(perf?.monthlyEvolution.map((m) => n(m.revenue)) ?? [1]));

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
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Analyses de performance</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>90 derniers jours</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !perf ? (
          <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
            <Ionicons name="analytics-outline" size={48} color={colors.border} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Aucune donnée</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>
              Les analyses apparaîtront une fois tes premières réservations effectuées
            </Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: contentOpacity, gap: 16 }}>
            {/* Meilleur jour / meilleure heure */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: colors.foreground }}>
                  {perf.bestDay ?? "—"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Meilleur jour</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: colors.foreground }}>
                  {perf.bestHour ?? "—"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Créneau le plus demandé</Text>
              </View>
            </View>

            {/* Panier moyen / remplissage */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(52,199,89,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Ionicons name="cash-outline" size={16} color="#34C759" />
                </View>
                <Text style={{ fontSize: 22, fontWeight: "900", color: colors.foreground, letterSpacing: -0.5 }}>
                  {perf.avgBasket.toFixed(0)} €
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Panier moyen</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(52,199,89,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Ionicons name="pie-chart-outline" size={16} color="#34C759" />
                </View>
                <Text style={{ fontSize: 22, fontWeight: "900", color: colors.foreground, letterSpacing: -0.5 }}>
                  {perf.fillRate}%
                </Text>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Taux de remplissage</Text>
              </View>
            </View>

            {/* Nouvelles vs fidèles */}
            <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.foreground, marginBottom: 14 }}>
                Clientes — nouvelles vs fidèles
              </Text>
              {totalClients > 0 ? (
                <>
                  <View style={{ height: 10, borderRadius: 5, overflow: "hidden", flexDirection: "row", backgroundColor: colors.muted }}>
                    <View style={{ width: `${returningPct}%`, backgroundColor: colors.primary }} />
                    <View style={{ flex: 1, backgroundColor: "#34C759" }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                      <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}>
                        {perf.returningClients} fidèles ({returningPct}%)
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34C759" }} />
                      <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}>
                        {perf.newClients} nouvelles ({100 - returningPct}%)
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Pas assez de données sur la période</Text>
              )}
            </View>

            {/* Évolution du CA */}
            <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.foreground, marginBottom: 16 }}>
                Évolution du CA — 6 derniers mois
              </Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, height: 110, paddingTop: 8 }}>
                {perf.monthlyEvolution.map((m, i) => {
                  const amt = n(m.revenue);
                  const isLast = i === perf.monthlyEvolution.length - 1;
                  const barH = Math.max((amt / maxRevenue) * 90, 6);
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <View style={{
                        width: "100%", height: barH, borderRadius: 6,
                        backgroundColor: isLast ? colors.primary : colors.muted,
                      }} />
                      <Text style={{ fontSize: 9, fontWeight: "700", color: isLast ? colors.primary : colors.mutedForeground }}>
                        {m.month}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}
