import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adminApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

export default function AdminAnalyticsScreen() {
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.getAnalytics(),
  });

  const analytics = data?.data as Record<string, unknown> | undefined;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-2xl font-bold text-foreground tracking-tight mb-6">
        Analytics
      </Text>

      {isLoading ? (
        <LoadingSpinner />
      ) : analytics ? (
        <View className="gap-4">
          {Object.entries(analytics).map(([key, value]) => (
            <Card key={key} elevated>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {key.replace(/_/g, " ")}
              </Text>
              <Text className="text-2xl font-bold text-foreground">
                {typeof value === "number" ? value.toLocaleString("fr-FR") : String(value)}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <Text className="text-muted-foreground text-center">Aucune donnée disponible</Text>
      )}
    </ScrollView>
  );
}
