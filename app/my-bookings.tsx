import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { clientApi, nailTechApi, type WaitingListEntry } from "@/lib/api";
import { Shadows } from "@/constants/shadows";
import { Colors } from "@/constants/colors";
import { ErrorMessage } from "@/components/ui/ErrorMessage";


interface Booking {
  id: number;
  pro_id: number;
  start_datetime: string;
  end_datetime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  price: number;
  prestation_name: string;
  duration_minutes: number;
  pro_first_name: string;
  pro_last_name: string;
  activity_name: string | null;
  profile_photo: string | null;
  cancellation_notice_hours: number;
}

type Tab = "upcoming" | "past" | "cancelled";
const TAB_LABELS: Record<Tab, string> = { upcoming: "À venir", past: "Passé", cancelled: "Annulé" };

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", weekday: "short" });
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// ── Reschedule Modal ──────────────────────────────────────────────────────────

function RescheduleModal({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ id: number; time: string } | null>(null);
  const [slots, setSlots] = useState<Array<{ id: number; time: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  const handleSelectDate = async (date: Date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSelectedDate(key);
    setSelectedSlot(null);
    setLoadingSlots(true);
    try {
      const data = await clientApi.getAvailableSlots(booking.pro_id, key);
      setSlots(data.success && Array.isArray(data.data) ? data.data.map((s: { id: number; time: string }) => ({ id: s.id, time: s.time })) : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;
    setIsSubmitting(true);
    try {
      const [h, m] = selectedSlot.time.split(":").map(Number);
      const start = new Date(`${selectedDate}T00:00:00`);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + booking.duration_minutes * 60_000);
      const data = await clientApi.rescheduleBooking(booking.id, {
        start_datetime: start.toISOString().slice(0, 19).replace("T", " "),
        end_datetime: end.toISOString().slice(0, 19).replace("T", " "),
        slot_id: selectedSlot.id,
      });
      if (!data.success) throw new Error(data?.message || "Erreur");
      onConfirm();
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "Impossible de reporter le RDV");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, maxHeight: "80%" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 20 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Reporter le RDV</Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{booking.prestation_name}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {next14.map((date) => {
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                const active = selectedDate === key;
                return (
                  <Pressable key={key} onPress={() => handleSelectDate(date)} style={{ width: 52, paddingVertical: 10, borderRadius: 14, alignItems: "center", backgroundColor: active ? Colors.primary : Colors.muted }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: active ? "rgba(255,255,255,0.8)" : Colors.mutedForeground, marginBottom: 2 }}>
                      {date.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3)}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: active ? Colors.white : Colors.foreground }}>{date.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {selectedDate && (
            <View style={{ marginBottom: 20, minHeight: 60 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.mutedForeground, marginBottom: 8 }}>Créneaux disponibles</Text>
              {loadingSlots ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : slots.length === 0 ? (
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center", paddingVertical: 12, backgroundColor: Colors.muted, borderRadius: 12 }}>Aucun créneau disponible ce jour</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {slots.map((slot) => {
                    const active = selectedSlot?.id === slot.id;
                    return (
                      <Pressable key={slot.id} onPress={() => setSelectedSlot(slot)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? Colors.primary : Colors.muted }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: active ? Colors.white : Colors.foreground }}>{slot.time}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {rescheduleError && <View style={{ marginBottom: 12 }}><ErrorMessage message={rescheduleError} /></View>}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} disabled={!selectedSlot || isSubmitting} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", opacity: !selectedSlot || isSubmitting ? 0.5 : 1 }}>
              {isSubmitting ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Confirmer</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  isUpcoming,
  onReschedule,
  onCancel,
}: {
  booking: Booking;
  isUpcoming: boolean;
  onReschedule?: (b: Booking) => void;
  onCancel?: (id: number) => void;
}) {
  const router = useRouter();
  const proName = booking.activity_name || `${booking.pro_first_name} ${booking.pro_last_name}`.trim() || "Professionnel";

  if (isUpcoming) {
    return (
      <Pressable
        onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
        style={{ backgroundColor: Colors.white, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: `${Colors.primary}33`, marginBottom: 12, ...Shadows.card }}
      >
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ position: "relative" }}>
            <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", backgroundColor: Colors.primaryLight }}>
              {booking.profile_photo ? (
                <Image source={{ uri: booking.profile_photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.primary }}>{proName[0]}</Text>
                </View>
              )}
            </View>
            <View style={{ position: "absolute", top: -3, right: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.white, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={10} color={Colors.white} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }} numberOfLines={1}>{proName}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
            </View>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 8 }} numberOfLines={1}>{booking.prestation_name}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.muted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Ionicons name="calendar-outline" size={11} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontWeight: "500", color: Colors.mutedForeground }}>{fmtDate(booking.start_datetime)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Ionicons name="time-outline" size={11} color={Colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.primary }}>{fmtTime(booking.start_datetime)}</Text>
              </View>
            </View>
          </View>
        </View>
        {onReschedule && onCancel && (
          <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.border }}>
            <Pressable onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })} style={{ flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderRightWidth: 1, borderRightColor: Colors.border }}>
              <Ionicons name="calendar-outline" size={14} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground }}>Détails</Text>
            </Pressable>
            <Pressable onPress={() => onReschedule(booking)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderRightWidth: 1, borderRightColor: Colors.border }}>
              <Ionicons name="calendar-clear-outline" size={14} color={Colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.primary }}>Reporter</Text>
            </Pressable>
            <Pressable onPress={() => onCancel(booking.id)} style={{ flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
              <Ionicons name="close-circle-outline" size={14} color={Colors.destructive} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.destructive }}>Annuler</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  }

  const isCompleted = booking.status === "completed";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
      style={{ backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, ...Shadows.card }}
    >
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", backgroundColor: Colors.muted, opacity: 0.75 }}>
          {booking.profile_photo ? (
            <Image source={{ uri: booking.profile_photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.primary }}>{proName[0]}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }} numberOfLines={1}>{proName}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: isCompleted ? Colors.successLight : Colors.destructiveLight }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: isCompleted ? Colors.successText : Colors.destructiveText }}>{isCompleted ? "✓ Terminé" : "✕ Annulé"}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 4 }} numberOfLines={1}>{booking.prestation_name} · {Number(booking.price).toFixed(2)}€</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="calendar-outline" size={10} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{fmtDate(booking.start_datetime)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="time-outline" size={10} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{fmtTime(booking.start_datetime)}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

// ── Waiting List ──────────────────────────────────────────────────────────────

function WaitingListSection() {
  const queryClient = useQueryClient();
  const { data: entries = [] } = useQuery<WaitingListEntry[]>({
    queryKey: ["client-waiting-list"],
    queryFn: async () => {
      const res = await nailTechApi.getMyWaitingList();
      return res.success ? (res.data ?? []) : [];
    },
    staleTime: 60_000,
  });

  const leaveMutation = useMutation({
    mutationFn: (proId: number) => nailTechApi.leaveWaitingList(proId),
    onMutate: (proId) => {
      queryClient.setQueryData<WaitingListEntry[]>(["client-waiting-list"], (prev = []) =>
        prev.filter((e) => e.pro_id !== proId)
      );
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ["client-waiting-list"] }),
  });

  if (entries.length === 0) return null;
  return (
    <View style={{ marginTop: 8, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Ionicons name="notifications-outline" size={15} color={Colors.warning} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>Listes d'attente</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: Colors.warningLight }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.warningText }}>{entries.length}</Text>
        </View>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, ...Shadows.card }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {entry.pro_photo ? (
              <Image source={{ uri: entry.pro_photo }} style={{ width: 40, height: 40 }} contentFit="cover" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.primary }}>{entry.pro_name.charAt(0)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>{entry.pro_name}</Text>
            {entry.prestation_name && <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{entry.prestation_name}</Text>}
            {entry.preferred_date && <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Souhaité : {new Date(entry.preferred_date).toLocaleDateString("fr-FR")}</Text>}
          </View>
          <Pressable onPress={() => leaveMutation.mutate(entry.pro_id)} disabled={leaveMutation.isPending} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-off-outline" size={14} color={Colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyBookingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  const { data: bookings = [], isLoading, refetch, isFetching } = useQuery<Booking[]>({
    queryKey: ["client-bookings"],
    queryFn: async () => {
      const res = await clientApi.getMyBookings();
      if (!res.success || !res.data) return [];
      return (res.data as Array<Record<string, unknown>>).map((b) => {
        const pro = (b.pro ?? {}) as Record<string, unknown>;
        const prest = (b.prestation ?? {}) as Record<string, unknown>;
        return {
          id: b.id as number,
          pro_id: (pro.id ?? b.pro_id) as number,
          start_datetime: b.start_datetime as string,
          end_datetime: b.end_datetime as string,
          status: b.status as Booking["status"],
          price: b.price as number,
          prestation_name: (prest.name ?? "Prestation") as string,
          duration_minutes: (prest.duration_minutes ?? 60) as number,
          pro_first_name: (pro.first_name ?? "") as string,
          pro_last_name: (pro.last_name ?? "") as string,
          activity_name: (pro.activity_name ?? null) as string | null,
          profile_photo: (pro.profile_photo ?? null) as string | null,
          cancellation_notice_hours: (pro.cancellation_notice_hours ?? 24) as number,
        };
      });
    },
    staleTime: 30_000,
  });

  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (id: number) => clientApi.cancelReservationWithPolicy(id),
    onSuccess: () => {
      setCancelTargetId(null);
      void queryClient.invalidateQueries({ queryKey: ["client-bookings"] });
    },
    onError: () => setCancelError("Impossible d'annuler ce rendez-vous"),
  });

  const handleCancel = useCallback((id: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCancelError(null);
    setCancelTargetId(id);
  }, []);

  const { upcoming, past, cancelled } = useMemo(() => {
    const safeBookings = Array.isArray(bookings) ? bookings : [];
    const now = new Date();
    return {
      upcoming: safeBookings.filter((b) => (b.status === "confirmed" || b.status === "pending") && new Date(b.start_datetime) > now),
      past: safeBookings.filter((b) => b.status === "completed" || (b.status !== "cancelled" && new Date(b.start_datetime) <= now)),
      cancelled: safeBookings.filter((b) => b.status === "cancelled"),
    };
  }, [bookings]);

  const activeList = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : cancelled;
  const hasOnlyPastBookings = upcoming.length === 0 && (past.length > 0 || cancelled.length > 0);

  const renderItem = useCallback(({ item }: { item: Booking }) => (
    <BookingCard
      booking={item}
      isUpcoming={activeTab === "upcoming"}
      onReschedule={activeTab === "upcoming" ? setRescheduleBooking : undefined}
      onCancel={activeTab === "upcoming" ? handleCancel : undefined}
    />
  ), [activeTab, handleCancel]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: Colors.foreground, marginBottom: 20 }}>
            Mes réservations
          </Text>
          {/* Segmented control */}
          <View style={{ flexDirection: "row", backgroundColor: Colors.muted, borderRadius: 14, padding: 4 }}>
            {(["upcoming", "past", "cancelled"] as Tab[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: activeTab === tab ? Colors.white : "transparent", shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: activeTab === tab ? 0.08 : 0, shadowRadius: 4, elevation: activeTab === tab ? 2 : 0 }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: activeTab === tab ? Colors.foreground : Colors.mutedForeground }}>
                  {TAB_LABELS[tab]}{tab === "upcoming" && upcoming.length > 0 ? ` (${upcoming.length})` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Promo banner */}
        {hasOnlyPastBookings && activeTab === "upcoming" && (
          <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <LinearGradient colors={[Colors.primaryLight, "#FFF4F9"]} style={{ padding: 20, borderWidth: 2, borderColor: `${Colors.primary}33`, borderRadius: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>Prête pour un nouveau soin ?</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 12, lineHeight: 18 }}>Retrouve nos expertes et réserve ta prochaine prestation !</Text>
              <Pressable onPress={() => router.push("/specialists")} style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                <Ionicons name="sparkles-outline" size={16} color={Colors.white} />
                <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 13 }}>Réserve dès maintenant</Text>
              </Pressable>
            </LinearGradient>
          </View>
        )}

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={activeList}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.primary} />}
            ListFooterComponent={activeTab === "upcoming" && bookings.length > 0 ? <WaitingListSection /> : null}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="calendar-outline" size={32} color={Colors.mutedForeground} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>
                  {activeTab === "upcoming" ? "Aucune réservation à venir" : activeTab === "past" ? "Aucun historique" : "Aucune annulation"}
                </Text>
                {activeTab === "upcoming" && (
                  <Pressable onPress={() => router.push("/specialists")} style={{ marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="sparkles-outline" size={16} color={Colors.white} />
                    <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 14 }}>Découvrir les expertes</Text>
                  </Pressable>
                )}
              </View>
            }
          />
        )}
      </View>

      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onConfirm={() => { setRescheduleBooking(null); void queryClient.invalidateQueries({ queryKey: ["client-bookings"] }); }}
        />
      )}

      {/* Cancel confirmation modal */}
      <Modal visible={cancelTargetId != null} transparent animationType="slide" onRequestClose={() => setCancelTargetId(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlayDark }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCancelTargetId(null)} />
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 20 }} />
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.destructiveLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 }}>
              <Ionicons name="close-circle-outline" size={28} color={Colors.destructive} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground, textAlign: "center", marginBottom: 8 }}>Annuler le rendez-vous ?</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 8 }}>
              Cette action est irréversible. Tu ne pourras pas récupérer ce créneau.
            </Text>
            {cancelError && <View style={{ marginBottom: 12 }}><ErrorMessage message={cancelError} /></View>}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => setCancelTargetId(null)}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Retour</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (cancelTargetId != null) cancelMutation.mutate(cancelTargetId); }}
                disabled={cancelMutation.isPending}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", opacity: cancelMutation.isPending ? 0.7 : 1 }}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Confirmer l'annulation</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
