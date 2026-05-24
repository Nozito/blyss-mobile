import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, SectionList, Pressable, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminBooking } from "@/lib/api";
import { Colors } from "@/constants/colors";

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
type StatusFilter  = "all" | BookingStatus;

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  pending:   { label: "En attente", color: Colors.warning,     icon: "time-outline" },
  confirmed: { label: "Confirmée",  color: Colors.info,        icon: "checkmark-circle-outline" },
  completed: { label: "Terminée",   color: Colors.success,     icon: "checkmark-done-outline" },
  cancelled: { label: "Annulée",    color: Colors.destructive, icon: "close-circle-outline" },
};

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all",       label: "Tous" },
  { key: "pending",   label: "En attente" },
  { key: "confirmed", label: "Confirmée" },
  { key: "completed", label: "Terminée" },
  { key: "cancelled", label: "Annulée" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as BookingStatus];
  if (!cfg) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${cfg.color}18` }}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

function BookingCard({
  booking,
  onConfirm,
  onCancel,
}: {
  booking: AdminBooking;
  onConfirm: (b: AdminBooking) => void;
  onCancel:  (b: AdminBooking) => void;
}) {
  const cfg   = STATUS_CFG[booking.status as BookingStatus];
  const statusColor = cfg?.color ?? Colors.admin;
  const price = typeof booking.price === "number" ? booking.price : parseFloat(String(booking.price ?? "0"));
  const time  = new Date(booking.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const canConfirm = booking.status === "pending";
  const canCancel  = booking.status === "pending" || booking.status === "confirmed";

  return (
    <View style={{
      backgroundColor: `${statusColor}07`,
      borderRadius: 18,
      padding: 18,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: `${statusColor}18`,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* Icon avatar 56×56 */}
        <View style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: `${statusColor}15`,
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Ionicons name={cfg ? cfg.icon : "calendar-outline"} size={26} color={statusColor} />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontWeight: "800", fontSize: 15, color: Colors.foreground, flex: 1 }} numberOfLines={1}>
              {booking.client_name ?? `#${booking.id}`}
            </Text>
            <StatusBadge status={booking.status} />
          </View>

          <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 8, fontWeight: "500" }} numberOfLines={1}>
            {[booking.service_name, booking.pro_name].filter(Boolean).join(" · ")}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="time-outline" size={12} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 11, color: Colors.mutedForeground, fontWeight: "600" }}>{time}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Ionicons name="cash-outline" size={14} color={Colors.success} />
              <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.success }}>
                {price.toFixed(2).replace(".", ",")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      {(canConfirm || canCancel) && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: `${statusColor}18` }}>
          {canConfirm && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onConfirm(booking); }}
              style={({ pressed }) => [{
                flex: 1, height: 42, borderRadius: 13,
                backgroundColor: `${Colors.info}15`, borderWidth: 1, borderColor: `${Colors.info}35`,
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="checkmark-outline" size={14} color={Colors.info} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.info }}>Confirmer</Text>
            </Pressable>
          )}
          {canCancel && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onCancel(booking); }}
              style={({ pressed }) => [{
                flex: 1, height: 42, borderRadius: 13,
                backgroundColor: `${Colors.destructive}12`, borderWidth: 1, borderColor: `${Colors.destructive}28`,
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="close-outline" size={14} color={Colors.destructive} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.destructive }}>Annuler</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing]     = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bookings", statusFilter],
    queryFn:  () => adminApi.getBookings({ limit: 100, status: statusFilter !== "all" ? statusFilter : undefined }),
    staleTime: 2 * 60_000,
  });

  const confirmMut = useMutation({
    mutationFn: (id: number) => adminApi.confirmBooking(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: () => Alert.alert("Erreur", "Impossible de confirmer."),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => adminApi.cancelBooking(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: () => Alert.alert("Erreur", "Impossible d'annuler."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const bookings = (data?.data as AdminBooking[] | undefined) ?? [];

  const sections = useMemo(() => {
    const grouped: Record<string, AdminBooking[]> = {};
    for (const b of bookings) {
      const key = new Date(b.start_datetime).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [bookings]);

  const handleConfirm = (b: AdminBooking) =>
    Alert.alert("Confirmer", `Confirmer la réservation #${b.id} ?`, [
      { text: "Annuler",   style: "cancel" },
      { text: "Confirmer", onPress: () => confirmMut.mutate(b.id) },
    ]);

  const handleCancel = (b: AdminBooking) =>
    Alert.alert("Annuler la réservation", `Annuler #${b.id}${b.client_name ? ` — ${b.client_name}` : ""} ?`, [
      { text: "Non",     style: "cancel" },
      { text: "Annuler", style: "destructive", onPress: () => cancelMut.mutate(b.id) },
    ]);

  const listHeader = (
    <View style={{ backgroundColor: A_BG, paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => {
          const cfg    = f.key !== "all" ? STATUS_CFG[f.key as BookingStatus] : null;
          const active = statusFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setStatusFilter(f.key);
              }}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                backgroundColor: active ? (cfg?.color ?? Colors.admin) : A_BG,
                borderColor:     active ? (cfg?.color ?? Colors.admin) : A_BORDER,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? Colors.white : Colors.mutedForeground }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: A_BG }}>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.admin} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.admin}
              colors={[Colors.admin]}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: A_BG, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ height: 1, flex: 1, backgroundColor: A_BORDER }} />
                <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.mutedForeground, textTransform: "capitalize", letterSpacing: 0.8 }}>
                  {section.title}
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground }}>{section.data.length}</Text>
                </View>
                <View style={{ height: 1, flex: 1, backgroundColor: A_BORDER }} />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={32} color={A_BORDER} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>Aucune réservation</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Rien à afficher pour ce filtre.</Text>
            </View>
          }
          renderItem={({ item: b }) => (
            <BookingCard booking={b} onConfirm={handleConfirm} onCancel={handleCancel} />
          )}
        />
      )}
    </View>
  );
}
