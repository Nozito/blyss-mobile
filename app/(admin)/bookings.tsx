import React, { useState, useMemo } from "react";
import {
  View, Text, SectionList, Pressable, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/lib/api";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
type StatusFilter = "all" | BookingStatus;

type Booking = {
  id: number; status: string; start_datetime: string; price: number;
  client_name?: string; pro_name?: string; service_name?: string;
};

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: "En attente", color: "#FBBF24", bg: "rgba(251,191,36,0.12)",  icon: "time-outline" },
  confirmed: { label: "Confirmée",  color: "#38BDF8", bg: "rgba(56,189,248,0.12)",   icon: "checkmark-circle-outline" },
  completed: { label: "Terminée",   color: "#4ADE80", bg: "rgba(74,222,128,0.12)",   icon: "checkmark-done-outline" },
  cancelled: { label: "Annulée",    color: "#F87171", bg: "rgba(248,113,113,0.12)",  icon: "close-circle-outline" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as BookingStatus];
  if (!cfg) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: cfg.bg }}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings", statusFilter],
    queryFn: () => adminApi.getBookings({ limit: 100, status: statusFilter !== "all" ? statusFilter : undefined }),
    staleTime: 2 * 60_000,
  });

  const confirmMut = useMutation({
    mutationFn: (id: number) => adminApi.confirmBooking(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-bookings"] }),
    onError: () => Alert.alert("Erreur", "Impossible de confirmer."),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => adminApi.cancelBooking(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-bookings"] }),
    onError: () => Alert.alert("Erreur", "Impossible d'annuler."),
  });

  const bookings = (data?.data as Booking[] | undefined) ?? [];

  // Group by date for timeline
  const sections = useMemo(() => {
    const grouped: Record<string, Booking[]> = {};
    for (const b of bookings) {
      const dateKey = new Date(b.start_datetime).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(b);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [bookings]);

  const confirmAction = (b: Booking) =>
    Alert.alert("Confirmer", `Confirmer la réservation #${b.id} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", onPress: () => confirmMut.mutate(b.id) },
    ]);

  const cancelAction = (b: Booking) =>
    Alert.alert("Annuler", `Annuler la réservation #${b.id} ?`, [
      { text: "Non", style: "cancel" },
      { text: "Annuler", style: "destructive", onPress: () => cancelMut.mutate(b.id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>Réservations</Text>
        <Text style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>{bookings.length} réservation(s)</Text>

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(["all", "pending", "confirmed", "completed", "cancelled"] as StatusFilter[]).map((f) => {
            const cfg = f !== "all" ? STATUS_CFG[f] : null;
            const active = statusFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setStatusFilter(f)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? (cfg?.color ?? ACCENT) : CARD,
                  borderColor: active ? (cfg?.color ?? ACCENT) : BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : MUTED }}>
                  {f === "all" ? "Tous" : cfg?.label}
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
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
              <View style={{ height: 1, flex: 1, backgroundColor: BORDER }} />
              <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "capitalize", letterSpacing: 0.5 }}>
                {section.title}
              </Text>
              <View style={{ height: 1, flex: 1, backgroundColor: BORDER }} />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="calendar-outline" size={48} color="rgba(255,255,255,0.08)" />
              <Text style={{ fontSize: 14, color: MUTED, marginTop: 12 }}>Aucune réservation</Text>
            </View>
          }
          renderItem={({ item: b }) => {
            const cfg = STATUS_CFG[b.status as BookingStatus];
            const price = typeof b.price === "number" ? b.price : parseFloat(String(b.price ?? "0"));
            return (
              <View style={{ backgroundColor: CARD, borderRadius: 18, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: cfg?.bg ? `${cfg.color}25` : BORDER }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT }}>#{b.id}</Text>
                    {b.service_name && (
                      <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{b.service_name}</Text>
                    )}
                  </View>
                  <StatusBadge status={b.status} />
                </View>

                <View style={{ gap: 6, marginBottom: 12 }}>
                  {b.client_name && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="person-outline" size={13} color={MUTED} />
                      <Text style={{ fontSize: 12, color: TEXT }}>{b.client_name}</Text>
                    </View>
                  )}
                  {b.pro_name && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="briefcase-outline" size={13} color={MUTED} />
                      <Text style={{ fontSize: 12, color: TEXT }}>{b.pro_name}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="time-outline" size={13} color={MUTED} />
                    <Text style={{ fontSize: 12, color: MUTED }}>
                      {new Date(b.start_datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: "900", color: "#4ADE80", marginLeft: "auto" as any }}>
                      {price.toFixed(2)} €
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                {(b.status === "pending" || b.status === "confirmed") && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {b.status === "pending" && (
                      <Pressable
                        onPress={() => confirmAction(b)}
                        style={{ flex: 1, height: 36, borderRadius: 10, backgroundColor: "rgba(56,189,248,0.15)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                      >
                        <Ionicons name="checkmark-outline" size={14} color="#38BDF8" />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#38BDF8" }}>Confirmer</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => cancelAction(b)}
                      style={{ flex: 1, height: 36, borderRadius: 10, backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.25)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                    >
                      <Ionicons name="close-outline" size={14} color="#F87171" />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#F87171" }}>Annuler</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
