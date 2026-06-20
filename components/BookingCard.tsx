import React, { memo } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Badge } from "./ui/Badge";
import { Avatar } from "./ui/Avatar";
import { Colors } from "@/constants/colors";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

interface Booking {
  id: number;
  status: BookingStatus;
  start_datetime: string;
  end_datetime?: string;
  price: number;
  pro_first_name?: string;
  pro_last_name?: string;
  pro_activity_name?: string;
  pro_city?: string;
  pro_photo?: string | null;
  prestation_name?: string;
  payment_status?: string;
}

interface BookingCardProps {
  booking: Booking;
  onCancel?: (id: number) => void;
  showCancelButton?: boolean;
}

const statusConfig: Record<BookingStatus, { label: string; badge: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  pending: { label: "En attente", badge: "warning" },
  confirmed: { label: "Confirmé", badge: "success" },
  completed: { label: "Terminé", badge: "secondary" },
  cancelled: { label: "Annulé", badge: "destructive" },
  no_show: { label: "Absent", badge: "destructive" },
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export const BookingCard = memo(function BookingCard({ booking, onCancel, showCancelButton }: BookingCardProps) {
  const router = useRouter();
  const config = statusConfig[booking.status] ?? statusConfig.pending;

  const proName = booking.pro_activity_name ??
    `${booking.pro_first_name ?? ""} ${booking.pro_last_name ?? ""}`.trim();

  const photoUri = booking.pro_photo
    ? booking.pro_photo.startsWith("http")
      ? booking.pro_photo
      : `${API_URL}${booking.pro_photo}`
    : undefined;

  const date = new Date(booking.start_datetime);
  const dateStr = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const canCancel =
    showCancelButton &&
    (booking.status === "pending" || booking.status === "confirmed") &&
    new Date(booking.start_datetime) > new Date();

  return (
    <Pressable
      onPress={() => router.push(`/booking/${booking.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Réservation chez ${proName}, ${config.label}, ${dateStr} à ${timeStr}`}
      accessibilityHint="Voir le détail de la réservation"
      className="bg-card rounded-2xl p-4 mb-3"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="flex-row items-start gap-3">
        <Avatar uri={photoUri} name={proName} size={44} />

        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
              {proName}
            </Text>
            <Badge variant={config.badge} size="sm">
              {config.label}
            </Badge>
          </View>

          {booking.prestation_name && (
            <Text className="text-sm text-muted-foreground mt-0.5" numberOfLines={1}>
              {booking.prestation_name}
            </Text>
          )}

          <View className="flex-row items-center gap-3 mt-2">
            <View className="flex-row items-center gap-1">
              <Ionicons name="calendar-outline" size={13} color={Colors.mutedForeground} />
              <Text className="text-xs text-muted-foreground capitalize">{dateStr}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="time-outline" size={13} color={Colors.mutedForeground} />
              <Text className="text-xs text-muted-foreground">{timeStr}</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-sm font-semibold text-primary">
              {typeof booking.price === "number"
                ? booking.price.toFixed(2)
                : parseFloat(String(booking.price ?? "0")).toFixed(2)} €
            </Text>
            {canCancel && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onCancel?.(booking.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Annuler la réservation chez ${proName}`}
                className="rounded-xl border border-destructive/30 bg-destructive/5"
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text className="text-xs font-medium text-destructive">Annuler</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
});
