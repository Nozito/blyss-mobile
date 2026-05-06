import React from "react";
import { View, Text, FlatList, Pressable, Switch } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { proApi, notificationsApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";
import type { ProNotificationSettings } from "@/lib/api";

const SETTING_LABELS: Record<keyof ProNotificationSettings, string> = {
  new_reservation: "Nouvelle réservation",
  cancel_change: "Annulation ou modification",
  daily_reminder: "Rappel journalier",
  client_message: "Message cliente",
  payment_alert: "Alerte paiement",
  activity_summary: "Résumé d'activité",
};

export default function ProNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: notifData, isLoading: loadingNotifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getAll(),
  });

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["pro-notification-settings"],
    queryFn: () => proApi.getNotificationSettings(),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (s: Partial<ProNotificationSettings>) => proApi.updateNotificationSettings(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-notification-settings"] }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = (notifData?.data as Array<{ id: number; message: string; is_read: boolean; created_at: string }> | undefined) ?? [];
  const settings = settingsData?.data;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-4">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Notifications
        </Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        ListHeaderComponent={
          settings ? (
            <View className="px-5 mb-4">
              <Text className="text-base font-semibold text-foreground mb-3">
                Préférences
              </Text>
              <Card>
                {(Object.keys(settings) as Array<keyof ProNotificationSettings>).map((key, idx, arr) => (
                  <View
                    key={key}
                    className={[
                      "flex-row items-center justify-between py-3",
                      idx < arr.length - 1 ? "border-b border-border" : "",
                    ].join(" ")}
                  >
                    <Text className="text-sm text-foreground flex-1 mr-3">
                      {SETTING_LABELS[key]}
                    </Text>
                    <Switch
                      value={Boolean(settings[key])}
                      onValueChange={(v) => updateSettingsMutation.mutate({ [key]: v })}
                      trackColor={{ true: Colors.primary, false: Colors.border }}
                      thumbColor="white"
                    />
                  </View>
                ))}
              </Card>
              <Text className="text-base font-semibold text-foreground mt-5 mb-3">
                Historique
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loadingNotifs ? (
            <LoadingSpinner />
          ) : (
            <View className="items-center py-8">
              <Ionicons name="notifications-outline" size={48} color={Colors.border} />
              <Text className="text-foreground font-semibold text-lg mt-4">
                Aucune notification
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => !item.is_read && markReadMutation.mutate(String(item.id))}
            className={[
              "flex-row items-start gap-3 px-5 py-4 border-b border-border",
              !item.is_read ? "bg-primary/5" : "",
            ].join(" ")}
          >
            {!item.is_read && (
              <View className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            )}
            <View className={!item.is_read ? "flex-1" : "flex-1 pl-4"}>
              <Text className="text-sm text-foreground leading-5">{item.message}</Text>
              <Text className="text-xs text-muted-foreground mt-1">
                {new Date(item.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
