import React from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { messagesApi } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { resolveMediaUrl } from "@/lib/media";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Shadows } from "@/constants/shadows";

function formatThreadTime(dateString: string | null): string {
  if (!dateString) return "";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return new Date(dateString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "hier";
  if (days < 7) return `${days}j`;
  return new Date(dateString).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Liste des fils de discussion — partagée entre l'onglet client et pro
 * (voir app/(client)/notifications.tsx et app/(pro)/notifications.tsx). */
export function ThreadList() {
  const router = useRouter();
  const colors = useThemeColors();

  const { data, isLoading } = useQuery({
    queryKey: ["message-threads"],
    queryFn: () => messagesApi.listThreads(),
  });

  const threads = data?.data ?? [];

  if (isLoading) {
    return (
      <View style={{ paddingTop: 60, alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState
        icon="chatbubble-ellipses-outline"
        title="Aucun message"
        description="Tes conversations avec les professionnelles apparaîtront ici."
      />
    );
  }

  return (
    <FlatList
      data={threads}
      keyExtractor={(t) => String(t.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100, gap: 10 }}
      renderItem={({ item }) => {
        const photo = resolveMediaUrl(item.other_photo);
        const unread = item.unread_count > 0;
        return (
          <AnimatedPressable
            onPress={() => router.push({ pathname: "/message-thread/[id]", params: { id: String(item.id) } })}
            style={{
              flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: unread ? colors.primary : colors.border,
              ...Shadows.card,
            }}
          >
            <View>
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.mutedForeground }}>
                    {item.other_name.trim().charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              {unread && (
                <View style={{
                  position: "absolute", top: -2, right: -2,
                  minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
                  backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.card,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.onColor }}>
                    {item.unread_count > 9 ? "9+" : item.unread_count}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontSize: 14.5, fontWeight: unread ? "700" : "600", color: colors.foreground, flexShrink: 1 }} numberOfLines={1}>
                  {item.other_name}
                </Text>
                <Text style={{ fontSize: 11, color: unread ? colors.primary : colors.mutedForeground, fontWeight: unread ? "700" : "400", flexShrink: 0 }}>
                  {formatThreadTime(item.last_message_at)}
                </Text>
              </View>
              <Text
                style={{ fontSize: 12.5, color: unread ? colors.foreground : colors.mutedForeground, marginTop: 3 }}
                numberOfLines={1}
              >
                {item.last_message_preview || "Nouvelle conversation"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </AnimatedPressable>
        );
      }}
    />
  );
}
