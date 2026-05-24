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

const BG     = "#0B0E14";
const CARD   = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT   = "#F8FAFC";
const MUTED  = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
type StatusFilter  = "all" | BookingStatus;

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  pending:   { label: "En attente", color: "#FBBF24", bg: "rgba(251,191,36,0.12)",  icon: "time-outline" },
  confirmed: { label: "Confirmée",  color: "#38BDF8", bg: "rgba(56,189,248,0.12)",  icon: "checkmark-circle-outline" },
  completed: { label: "Terminée",   color: "#4ADE80", bg: "rgba(74,222,128,0.12)",  icon: "checkmark-done-outline" },
  cancelled: { label: "Annulée",    color: "#F87171", bg: "rgba(248,113,113,0.12)", icon: "close-circle-outline" },
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: cfg.bg }}>
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
      backgroundColor: CARD,
      borderRadius: 18,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: cfg ? `${cfg.color}25` : BORDER,
    }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>#{booking.id}</Text>
          {booking.service_name ? (
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{booking.service_name}</Text>
          ) : null}
        </View>
        <StatusBadge status={booking.status} />
      </View>

      {/* Info rows */}
      <View style={{ gap: 5, marginBottom: 10 }}>
        {booking.client_name ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="person-outline" size={13} color={MUTED} />
            <Text style={{ fontSize: 12, color: TEXT }}>{booking.client_name}</Text>
          </View>
        ) : null}
        {booking.pro_name ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="briefcase-outline" size={13} color={MUTED} />
            <Text style={{ fontSize: 12, color: TEXT }}>{booking.pro_name}</Text>
          </View>
        ) : null}
      </View>

      {/* Footer: time + price */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER }}>
        <Ionicons name="time-outline" size={13} color={MUTED} />
        <Text style={{ fontSize: 12, color: MUTED, marginLeft: 6 }}>{time}</Text>
        <Text style={{ fontSize: 16, fontWeight: "900", color: "#4ADE80", marginLeft: "auto" as any }}>
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
                backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.28)",
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="checkmark-outline" size={13} color="#38BDF8" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#38BDF8" }}>Confirmer</Text>
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
                backgroundColor: "rgba(248,113,113,0.10)", borderWidth: 1, borderColor: "rgba(248,113,113,0.22)",
                alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="close-outline" size={13} color="#F87171" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#F87171" }}>Annuler</Text>
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
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Status filter strip */}
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
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
                  backgroundColor: active ? (cfg?.color ?? ACCENT) : CARD,
                  borderColor:     active ? (cfg?.color ?? ACCENT) : BORDER,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : MUTED }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: BG, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ height: 1, flex: 1, backgroundColor: BORDER }} />
                <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "capitalize", letterSpacing: 0.8 }}>
                  {section.title}
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: MUTED }}>{section.data.length}</Text>
                </View>
                <View style={{ height: 1, flex: 1, backgroundColor: BORDER }} />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="calendar-outline" size={32} color="rgba(255,255,255,0.15)" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 6 }}>Aucune réservation</Text>
              <Text style={{ fontSize: 13, color: MUTED }}>Rien à afficher pour ce filtre.</Text>
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
