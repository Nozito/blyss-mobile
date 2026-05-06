import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { clientApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Avatar } from "@/components/ui/Avatar";
import { Colors } from "@/constants/colors";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

const STATUS_CONFIG: Record<BookingStatus, { label: string; badge: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  pending: { label: "En attente", badge: "warning" },
  confirmed: { label: "Confirmé", badge: "success" },
  completed: { label: "Terminé", badge: "secondary" },
  cancelled: { label: "Annulé", badge: "destructive" },
  no_show: { label: "Absent", badge: "destructive" },
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => clientApi.getBookingDetail(Number(id)),
    enabled: Boolean(id),
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  const booking = data?.data as Record<string, unknown> | undefined;
  if (!booking) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Réservation introuvable</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">Retour</Text>
        </Pressable>
      </View>
    );
  }

  const status = (booking.status as BookingStatus) ?? "pending";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  const proName = (booking.pro_activity_name as string | null) ??
    `${booking.pro_first_name ?? ""} ${booking.pro_last_name ?? ""}`.trim();

  const photoUri = booking.pro_photo
    ? (booking.pro_photo as string).startsWith("http")
      ? (booking.pro_photo as string)
      : `${API_URL}${booking.pro_photo}`
    : undefined;

  const date = new Date(booking.start_datetime as string);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Détail
        </Text>
      </View>

      {/* Status card */}
      <Card elevated className="mb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Badge variant={config.badge}>{config.label}</Badge>
          <Text className="text-sm text-muted-foreground">#{String(booking.id)}</Text>
        </View>

        <View className="flex-row items-center gap-3 mb-4">
          <Avatar uri={photoUri} name={proName} size={52} />
          <View>
            <Text className="text-lg font-bold text-foreground">{proName}</Text>
            {Boolean(booking.pro_city) && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="location-outline" size={13} color={Colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground">
                  {booking.pro_city as string}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="gap-2">
          {Boolean(booking.prestation_name) && (
            <View className="flex-row items-center gap-2">
              <Ionicons name="sparkles-outline" size={16} color={Colors.mutedForeground} />
              <Text className="text-sm text-foreground">
                {booking.prestation_name as string}
              </Text>
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={16} color={Colors.mutedForeground} />
            <Text className="text-sm text-foreground capitalize">
              {date.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={16} color={Colors.mutedForeground} />
            <Text className="text-sm text-foreground">
              {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      </Card>

      {/* Payment card */}
      <Card elevated>
        <Text className="text-base font-semibold text-foreground mb-3">Paiement</Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Montant total</Text>
          <Text className="text-lg font-bold text-primary">
            {Number(booking.price ?? 0).toFixed(2)} €
          </Text>
        </View>
        {Boolean(booking.payment_status) && (
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-sm text-muted-foreground">Statut</Text>
            <Badge
              variant={
                booking.payment_status === "paid"
                  ? "success"
                  : booking.payment_status === "pending"
                  ? "warning"
                  : "default"
              }
              size="sm"
            >
              {String(booking.payment_status)}
            </Badge>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}
