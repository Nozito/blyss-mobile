import React from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

export default function AdminAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.getAnalytics(),
    staleTime: 5 * 60_000,
  });

  const analytics = data?.data as Record<string, unknown> | undefined;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={TEXT} />
        </Pressable>
        <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>Analytics</Text>
      </View>

      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : analytics ? (
        <View style={{ gap: 10 }}>
          {Object.entries(analytics).map(([key, value]) => (
            <View key={key} style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {key.replace(/_/g, " ")}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: ACCENT }}>
                {typeof value === "number" ? value.toLocaleString("fr-FR") : String(value)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <Ionicons name="analytics-outline" size={48} color="rgba(255,255,255,0.08)" />
          <Text style={{ fontSize: 14, color: MUTED, marginTop: 12 }}>Aucune donnée disponible</Text>
        </View>
      )}
    </ScrollView>
  );
}
