import React, { useState, useMemo, useCallback, Platform } from "react";
import {
  View, Text, SectionList, Pressable, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminBooking } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";

// ── Dark design tokens ────────────────────────────────────────────────────────
const A_BG     = ADMIN.bg;
const A_BORDER = ADMIN.border;

// ── Types (unchanged) ─────────────────────────────────────────────────────────
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

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({
  booking,
  onConfirm,
  onCancel,
}: {
  booking: AdminBooking;
  onConfirm: (b: AdminBooking) => void;
  onCancel:  (b: AdminBooking) => void;
}) {
  const cfg         = STATUS_CFG[booking.status as BookingStatus];
  const statusColor = cfg?.color ?? Colors.admin;
  const price       = typeof booking.price === "number" ? booking.price : parseFloat(String(booking.price ?? "0"));
  const time        = new Date(booking.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateLabel   = new Date(booking.start_datetime).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  const canConfirm = booking.status === "pending";
  const canCancel  = booking.status === "pending" || booking.status === "confirmed";

  return (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 20,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 4,
    }}>
      <View style={{ flexDirection: "row" }}>
        {/* Left color bar */}
        <View style={{ width: 4, alignSelf: "stretch", backgroundColor: statusColor }} />

        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {/* Icon avatar 48×48 */}
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: `${statusColor}20`,
              alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Ionicons name={cfg ? cfg.icon : "calendar-outline"} size={22} color={statusColor} />
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              {/* Row 1: name + status pill */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ fontWeight: "800", fontSize: 15, color: "#fff", flex: 1 }} numberOfLines={1}>
                  {booking.client_name ?? `#${booking.id}`}
                </Text>
                {cfg && (
                  <View style={{
                    flexDirection: "row", alignItems: "center", gap: 4,
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
                    backgroundColor: `${statusColor}18`,
                    borderWidth: 1, borderColor: `${statusColor}30`,
                  }}>
                    <Ionicons name={cfg.icon} size={11} color={statusColor} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>{cfg.label}</Text>
                  </View>
                )}
              </View>

              {/* Row 2: service · pro */}
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 8 }} numberOfLines={1}>
                {[booking.service_name, booking.pro_name].filter(Boolean).join(" · ")}
              </Text>

              {/* Row 3: date+time pill + price */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.45)" />
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                    {dateLabel} · {time}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#22C55E" }}>
                  {price.toFixed(2).replace(".", ",")} €
                </Text>
              </View>
            </View>
          </View>

          {/* Action buttons */}
          {(canConfirm || canCancel) && (
            <View style={{
              flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 14,
              borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
            }}>
              {canConfirm && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onConfirm(booking); }}
                  style={({ pressed }) => [{
                    flex: 1, height: 46, borderRadius: 16,
                    backgroundColor: "#3B82F6",
                    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
                    opacity: pressed ? 0.82 : 1,
                  }]}
                >
                  {Platform.OS === "ios"
                    ? <SymbolView name="checkmark.circle.fill" size={16} tintColor="#fff" />
                    : <Ionicons name="checkmark-circle" size={16} color="#fff" />}
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>Confirmer</Text>
                </Pressable>
              )}
              {canCancel && (
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onCancel(booking); }}
                  style={({ pressed }) => [{
                    flex: 1, height: 46, borderRadius: 16,
                    backgroundColor: "rgba(240,58,58,0.12)",
                    borderWidth: 1, borderColor: "rgba(240,58,58,0.25)",
                    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Ionicons name="close-outline" size={16} color="#F03A3A" />
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#F03A3A" }}>Annuler</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing]     = useState(false);

  // ── Queries (unchanged) ───────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bookings", statusFilter],
    queryFn:  () => adminApi.getBookings({ limit: 100, status: statusFilter !== "all" ? statusFilter : undefined }),
    staleTime: 2 * 60_000,
  });

  // ── Mutations (unchanged) ─────────────────────────────────────────────────
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

  // ── Data (unchanged grouping logic) ──────────────────────────────────────
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

  // ── List header — title + sticky filter bar ───────────────────────────────
  const listHeader = (
    <View style={{ backgroundColor: "rgba(10,10,15,0.9)", overflow: "hidden" }}>
      <BlurView tint="dark" intensity={70} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ paddingTop: insets.top + 16, paddingBottom: 12, paddingHorizontal: 16 }}>
        {/* Title */}
        <View style={{ paddingTop: 4, paddingBottom: 12 }}>
          <Text style={{ fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1 }}>
            Réservations
          </Text>
          {!isLoading && (
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
              {bookings.length} au total
            </Text>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => {
            const cfg    = f.key !== "all" ? STATUS_CFG[f.key as BookingStatus] : null;
            const active = statusFilter === f.key;
            const color  = cfg?.color ?? Colors.admin;
            const icon: React.ComponentProps<typeof Ionicons>["name"] = cfg?.icon ?? "list-outline";
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setStatusFilter(f.key);
                }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, borderWidth: 1,
                  backgroundColor: active ? `${color}25` : "rgba(255,255,255,0.06)",
                  borderColor:     active ? `${color}50` : "rgba(255,255,255,0.10)",
                }}
              >
                <Ionicons name={icon} size={13} color={active ? color : "rgba(255,255,255,0.5)"} />
                <Text style={{ fontSize: 12, fontWeight: active ? "800" : "600", color: active ? color : "rgba(255,255,255,0.5)" }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}

          {/* Total badge */}
          {!isLoading && (
            <View style={{
              paddingHorizontal: 12, paddingVertical: 9, borderRadius: 22,
              backgroundColor: `${Colors.admin}16`, borderWidth: 1, borderColor: `${Colors.admin}30`,
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: Colors.admin }}>{bookings.length}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: A_BG }}>
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.admin} />
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 12 }}>Chargement…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ backgroundColor: A_BG, paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F97316"
              colors={["#F97316"]}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: "rgba(10,10,15,0.95)", paddingVertical: 8, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>
                {section.title}  · {section.data.length}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <LinearGradient
                colors={["rgba(249,115,22,0.12)", "rgba(249,115,22,0.03)"]}
                style={{ width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 18 }}
              >
                <Ionicons name="calendar-outline" size={36} color="#F97316" />
              </LinearGradient>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 6 }}>Aucune réservation</Text>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Rien à afficher pour ce filtre.</Text>
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
