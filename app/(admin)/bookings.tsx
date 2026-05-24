import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, SectionList, Pressable, ScrollView,
  ActivityIndicator, Alert, RefreshControl, Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminBooking } from "@/lib/api";
import { Colors } from "@/constants/colors";

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
  const price = typeof booking.price === "number" ? booking.price : parseFloat(String(booking.price ?? "0"));
  const time  = new Date(booking.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const canConfirm = booking.status === "pending";
  const canCancel  = booking.status === "pending" || booking.status === "confirmed";

  return (
    <View style={{
      backgroundColor: Colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      borderLeftWidth: 3,
      borderLeftColor: cfg ? cfg.color : Colors.border,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.foreground }}>#{booking.id}</Text>
          {booking.service_name ? (
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>{booking.service_name}</Text>
          ) : null}
        </View>
        <StatusBadge status={booking.status} />
      </View>

      {/* Info rows */}
      <View style={{ gap: 5, marginBottom: 10 }}>
        {booking.client_name ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="person-outline" size={13} color={Colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: Colors.foreground }}>{booking.client_name}</Text>
          </View>
        ) : null}
        {booking.pro_name ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="briefcase-outline" size={13} color={Colors.mutedForeground} />
            <Text style={{ fontSize: 12, color: Colors.foreground }}>{booking.pro_name}</Text>
          </View>
        ) : null}
      </View>

      {/* Footer: time + price */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border }}>
        <Ionicons name="time-outline" size={13} color={Colors.mutedForeground} />
        <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginLeft: 6 }}>{time}</Text>
        <Text style={{ fontSize: 16, fontWeight: "900", color: Colors.success, marginLeft: "auto" as any }}>
          {price.toFixed(2)} €
        </Text>
      </View>

      {/* Action buttons */}
      {(canConfirm || canCancel) ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {canConfirm && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onConfirm(booking);
              }}
              style={({ pressed }) => [{
                flex: 1, height: 36, borderRadius: 10,
                backgroundColor: `${Colors.info}15`, borderWidth: 1, borderColor: `${Colors.info}35`,
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="checkmark-outline" size={13} color={Colors.info} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.info }}>Confirmer</Text>
            </Pressable>
          )}
          {canCancel && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onCancel(booking);
              }}
              style={({ pressed }) => [{
                flex: 1, height: 36, borderRadius: 10,
                backgroundColor: `${Colors.destructive}12`, borderWidth: 1, borderColor: `${Colors.destructive}28`,
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="close-outline" size={13} color={Colors.destructive} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.destructive }}>Annuler</Text>
            </Pressable>
          )}
        </View>
      ) : null}
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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Status filter strip */}
      <View style={{ paddingTop: insets.top + 10, paddingBottom: 10, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
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
                  backgroundColor: active ? (cfg?.color ?? Colors.admin) : Colors.muted,
                  borderColor:     active ? (cfg?.color ?? Colors.admin) : Colors.border,
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.admin}
              colors={[Colors.admin]}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: Colors.background, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ height: 1, flex: 1, backgroundColor: Colors.border }} />
                <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.mutedForeground, textTransform: "capitalize", letterSpacing: 0.8 }}>
                  {section.title}
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: Colors.muted, borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground }}>{section.data.length}</Text>
                </View>
                <View style={{ height: 1, flex: 1, backgroundColor: Colors.border }} />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={32} color={Colors.border} />
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
