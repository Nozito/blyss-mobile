import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { proApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

export default function ProFinanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["pro-finance-stats"],
    queryFn: () => proApi.getFinanceStats(),
  });

  const rawStats = data?.data as Record<string, unknown> | undefined;
  const n = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0);
  const stats = rawStats
    ? {
        today: n(rawStats["today"]),
        week: n(rawStats["week"]),
        month: n(rawStats["month"]),
        lastMonth: n(rawStats["lastMonth"]),
        objective: n(rawStats["objective"]),
        forecast: n(rawStats["forecast"]),
        trend: rawStats["trend"] as string | undefined,
        topServices: (rawStats["topServices"] as Array<{ name: string; revenue: unknown; count: number; percentage: unknown }> | undefined) ?? [],
      }
    : null;

  const statCards = stats
    ? [
        {
          label: "Aujourd'hui",
          value: `${stats.today.toFixed(2)} €`,
          icon: "sunny-outline" as const,
          color: Colors.secondary,
        },
        {
          label: "Cette semaine",
          value: `${stats.week.toFixed(2)} €`,
          icon: "calendar-outline" as const,
          color: Colors.primary,
        },
        {
          label: "Ce mois",
          value: `${stats.month.toFixed(2)} €`,
          icon: "bar-chart-outline" as const,
          color: Colors.primary,
        },
        {
          label: "Mois dernier",
          value: `${stats.lastMonth.toFixed(2)} €`,
          icon: "time-outline" as const,
          color: Colors.mutedForeground,
        },
      ]
    : [];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center gap-3 px-5 mb-6">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Finances
        </Text>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <View className="px-5 gap-4">
          {/* Objective */}
          {stats && (
            <View
              className="rounded-3xl p-5"
              style={{ backgroundColor: Colors.primary }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white/80 text-sm">Objectif mensuel</Text>
                <Badge variant="default" size="sm">
                  {stats.trend === "up" ? "↑ Hausse" : stats.trend === "down" ? "↓ Baisse" : "Stable"}
                </Badge>
              </View>
              <View className="flex-row items-end gap-2">
                <Text className="text-white text-4xl font-bold">
                  {stats.month.toFixed(0)} €
                </Text>
                <Text className="text-white/60 text-sm mb-1">
                  / {stats.objective.toFixed(0)} €
                </Text>
              </View>

              {/* Progress bar */}
              <View className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
                <View
                  className="h-full bg-white rounded-full"
                  style={{
                    width: `${Math.min((stats.month / Math.max(stats.objective, 1)) * 100, 100)}%`,
                  }}
                />
              </View>

              <Text className="text-white/60 text-xs mt-2">
                Prévision : {stats.forecast.toFixed(2)} €
              </Text>
            </View>
          )}

          {/* Stat grid */}
          <View className="flex-row flex-wrap gap-3">
            {statCards.map(({ label, value, icon, color }) => (
              <Card
                key={label}
                elevated
                className="flex-1"
                style={{ minWidth: "45%" }}
              >
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center mb-2"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Ionicons name={icon} size={16} color={color} />
                </View>
                <Text className="text-xl font-bold text-foreground">{value}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">{label}</Text>
              </Card>
            ))}
          </View>

          {/* Top services */}
          {stats && stats.topServices.length > 0 && (
            <View>
              <Text className="text-lg font-semibold text-foreground mb-3">
                Top prestations
              </Text>
              {stats.topServices.map((svc) => (
                <View key={svc.name} className="bg-card rounded-2xl p-4 mb-2">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-base font-semibold text-foreground flex-1 mr-2">
                      {svc.name}
                    </Text>
                    <Text className="text-base font-bold text-primary">
                      {n(svc.revenue).toFixed(2)} €
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-muted-foreground">
                      {svc.count} réservations
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {n(svc.percentage).toFixed(1)} % du CA
                    </Text>
                  </View>
                  <View className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${n(svc.percentage)}%`,
                        backgroundColor: Colors.primary,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
