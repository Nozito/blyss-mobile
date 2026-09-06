import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { clientApi, nailTechApi, specialistsApi, type WaitingListEntry } from "@/lib/api";
import { Shadows } from "@/constants/shadows";
import { useThemeColors } from "@/hooks/useThemeColors";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { resolveMediaUrl } from "@/lib/media";


interface Booking {
  id: number;
  pro_id: number;
  start_datetime: string;
  end_datetime: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  price: number;
  prestation_id: number | null;
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
const TABS: Tab[] = ["upcoming", "past", "cancelled"];

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", weekday: "short" });
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// Étiquette de proximité pour repérer d'un coup d'œil les RDV imminents
const fmtRelativeDay = (s: string): string | null => {
  const target = new Date(s);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days > 1 && days <= 6) return `Dans ${days} jours`;
  return null;
};

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
  const colors = useThemeColors();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ id: number; time: string; startISO?: string } | null>(null);
  const [slots, setSlots] = useState<Array<{ id: number; time: string; startISO?: string }>>([]);
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
      // Créneaux calculés par le moteur de dispo (les anciens slots précréés
      // sont vides pour toutes les pros basculées — la cliente ne voyait
      // alors jamais de créneau à reporter).
      if (booking.prestation_id == null) {
        setSlots([]);
        return;
      }
      const data = await specialistsApi.getPublicAvailability({
        proId: booking.pro_id,
        serviceIds: [booking.prestation_id],
        fromDate: key,
        toDate: key,
      });
      const daySlots = data.success && data.data
        ? (data.data.days.find((d) => d.date === key)?.slots ?? [])
        : [];
      setSlots(
        daySlots.map((s, i) => ({
          id: i,
          time: new Date(s.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          startISO: s.start,
        }))
      );
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
      let start: Date;
      if (selectedSlot.startISO) {
        start = new Date(selectedSlot.startISO);
      } else {
        const [h, m] = selectedSlot.time.split(":").map(Number);
        start = new Date(`${selectedDate}T00:00:00`);
        start.setHours(h, m, 0, 0);
      }
      const end = new Date(start.getTime() + booking.duration_minutes * 60_000);
      const data = await clientApi.rescheduleBooking(booking.id, {
        start_datetime: start.toISOString().slice(0, 19).replace("T", " "),
        end_datetime: end.toISOString().slice(0, 19).replace("T", " "),
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
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, maxHeight: "80%" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Reporter le RDV</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{booking.prestation_name}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {next14.map((date) => {
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                const active = selectedDate === key;
                return (
                  <AnimatedPressable key={key} onPress={() => handleSelectDate(date)} style={{ width: 52, paddingVertical: 10, borderRadius: 14, alignItems: "center", backgroundColor: active ? colors.primary : colors.muted }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground, marginBottom: 2 }}>
                      {date.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3)}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: active ? colors.onColor : colors.foreground }}>{date.getDate()}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </ScrollView>

          {selectedDate && (
            <View style={{ marginBottom: 20, minHeight: 60 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground, marginBottom: 8 }}>Créneaux disponibles</Text>
              {loadingSlots ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : slots.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center", paddingVertical: 12, backgroundColor: colors.muted, borderRadius: 12 }}>Aucun créneau disponible ce jour</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {slots.map((slot) => {
                    const active = selectedSlot?.id === slot.id;
                    return (
                      <AnimatedPressable key={slot.id} onPress={() => setSelectedSlot(slot)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: active ? colors.primary : colors.muted }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.onColor : colors.foreground }}>{slot.time}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {rescheduleError && <View style={{ marginBottom: 12 }}><ErrorMessage message={rescheduleError} /></View>}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <AnimatedPressable onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Annuler</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={handleConfirm} disabled={!selectedSlot || isSubmitting} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: !selectedSlot || isSubmitting ? 0.5 : 1 }}>
              {isSubmitting ? <ActivityIndicator size="small" color={colors.onColor} /> : <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Confirmer</Text>}
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
// One label per status, shown identically on every tab — a booking's state
// used to be legible on "Passé"/"Annulé" cards (a text badge) but only
// implied by a tiny colored dot on "À venir" cards, so upcoming reservations
// never actually said "Confirmé" or "En attente" anywhere on the card.
function getStatusBadge(status: Booking["status"], colors: ReturnType<typeof useThemeColors>) {
  switch (status) {
    case "pending":
      return { label: "En attente", color: colors.warningText, bg: colors.warningLight };
    case "confirmed":
      return { label: "Confirmé", color: colors.successText, bg: colors.successLight };
    case "completed":
      return { label: "Terminé", color: colors.successText, bg: colors.successLight };
    case "no_show":
      return { label: "Non honoré", color: colors.destructiveText, bg: colors.destructiveLight };
    case "cancelled":
      return { label: "Annulé", color: colors.destructiveText, bg: colors.destructiveLight };
  }
}

// ── Pro avatar ───────────────────────────────────────────────────────────────
// Shared by every card (and the waiting list) so the relative→absolute photo
// URL resolution happens exactly once: `profile_photo` isn't always stored
// as a full URL, and rendering the raw path directly (as this screen used to
// for every status) silently breaks the image for any row still on the old
// relative-path format — regardless of the booking's status.
function ProAvatar({ photo, initial, size, colors }: { photo: string | null | undefined; initial: string; size: number; colors: ReturnType<typeof useThemeColors> }) {
  const uri = resolveMediaUrl(photo);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, overflow: "hidden", backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Text style={{ fontSize: size * 0.37, fontWeight: "800", color: colors.primary }}>{initial}</Text>
      )}
    </View>
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
  const colors = useThemeColors();
  const proName = booking.activity_name || `${booking.pro_first_name} ${booking.pro_last_name}`.trim() || "Professionnel";
  const badge = getStatusBadge(booking.status, colors);
  const isCompleted = booking.status === "completed";

  if (isUpcoming) {
    const relativeDay = fmtRelativeDay(booking.start_datetime);
    return (
      <AnimatedPressable
        onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
        accessibilityLabel={`Réservation avec ${proName}, ${booking.prestation_name}, ${fmtDate(booking.start_datetime)} à ${fmtTime(booking.start_datetime)}, ${badge.label}`}
        style={{ backgroundColor: colors.white, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: `${colors.primary}33`, marginBottom: 12, ...Shadows.card }}
      >
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <ProAvatar photo={booking.profile_photo} initial={proName[0]} size={60} colors={colors} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2, gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, flexShrink: 1 }} numberOfLines={1}>{proName}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: badge.bg }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: badge.color }}>{badge.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, flexShrink: 1 }} numberOfLines={1}>{booking.prestation_name}</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>·</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>{Number(booking.price).toFixed(2)}€</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {relativeDay && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.onColor }}>{relativeDay}</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.muted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Ionicons name="calendar-outline" size={11} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontWeight: "500", color: colors.mutedForeground }}>{fmtDate(booking.start_datetime)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Ionicons name="time-outline" size={11} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>{fmtTime(booking.start_datetime)}</Text>
              </View>
            </View>
          </View>
        </View>
        {onReschedule && onCancel && (
          <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border }}>
            <AnimatedPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onReschedule(booking);
              }}
              accessibilityLabel="Reporter ce rendez-vous"
              style={{ flex: 1, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6, borderRightWidth: 1, borderRightColor: colors.border }}
            >
              <Ionicons name="calendar-clear-outline" size={15} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Reporter</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => onCancel(booking.id)}
              accessibilityLabel="Annuler ce rendez-vous"
              style={{ flex: 1, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <Ionicons name="close-circle-outline" size={15} color={colors.destructive} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.destructive }}>Annuler</Text>
            </AnimatedPressable>
          </View>
        )}
      </AnimatedPressable>
    );
  }

  const isCancelled = booking.status === "cancelled";
  return (
    <AnimatedPressable
      onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
      accessibilityLabel={`Réservation avec ${proName}, ${booking.prestation_name}, ${fmtDate(booking.start_datetime)}, ${badge.label}`}
      style={{
        backgroundColor: colors.white,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 8,
        opacity: isCancelled ? 0.85 : 1,
        ...Shadows.card,
      }}
    >
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ProAvatar photo={booking.profile_photo} initial={proName[0]} size={48} colors={colors} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{proName}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: badge.bg }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: badge.color }}>{badge.label}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4 }} numberOfLines={1}>{booking.prestation_name} · {Number(booking.price).toFixed(2)}€</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="calendar-outline" size={10} color={colors.mutedForeground} />
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{fmtDate(booking.start_datetime)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="time-outline" size={10} color={colors.mutedForeground} />
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{fmtTime(booking.start_datetime)}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </View>
      {isCompleted && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <AnimatedPressable
            onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: booking.pro_id } })}
            accessibilityLabel={`Craquer à nouveau pour ${proName}`}
            style={{ paddingVertical: 11, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Craquer à nouveau pour elle</Text>
          </AnimatedPressable>
        </View>
      )}
    </AnimatedPressable>
  );
}

// ── Waiting List ──────────────────────────────────────────────────────────────

function WaitingListSection() {
  const colors = useThemeColors();
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
    // apiCall() ne rejette jamais — sans ce throw, un échec métier laissait
    // l'entrée retirée optimistiquement de la liste sans jamais déclencher le
    // rollback ci-dessous, alors qu'elle existait toujours côté serveur.
    mutationFn: async (proId: number) => {
      const res = await nailTechApi.leaveWaitingList(proId);
      if (!res.success) throw new Error(res.error ?? "Impossible de quitter la liste d'attente");
      return res;
    },
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
        <Ionicons name="notifications-outline" size={15} color={colors.warning} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Listes d'attente</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: colors.warningLight }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: colors.warningText }}>{entries.length}</Text>
        </View>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: 8, ...Shadows.card }}>
          <ProAvatar photo={entry.pro_photo} initial={entry.pro_name.charAt(0)} size={40} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>{entry.pro_name}</Text>
            {entry.prestation_name && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{entry.prestation_name}</Text>}
            {entry.preferred_date && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Souhaité : {new Date(entry.preferred_date).toLocaleDateString("fr-FR")}</Text>}
          </View>
          <AnimatedIconButton onPress={() => leaveMutation.mutate(entry.pro_id)} disabled={leaveMutation.isPending} accessibilityLabel="Se désinscrire de la liste d'attente" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-off-outline" size={14} color={colors.mutedForeground} />
          </AnimatedIconButton>
        </View>
      ))}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyBookingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);

  // ── Tab fade + sliding indicator ──────────────────────────────────────────
  const listOpacity = useRef(new Animated.Value(1)).current;
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const segmentWidth = tabBarWidth > 0 ? (tabBarWidth - 8) / TABS.length : 0;

  useEffect(() => {
    if (!segmentWidth) return;
    Animated.spring(tabIndicatorX, {
      toValue: TABS.indexOf(activeTab) * segmentWidth,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [activeTab, segmentWidth, tabIndicatorX]);

  const handleTabChange = useCallback(
    (tab: Tab) => {
      if (tab === activeTab) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (reduceMotion) {
        setActiveTab(tab);
        return;
      }
      Animated.timing(listOpacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setActiveTab(tab);
        Animated.timing(listOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    },
    [activeTab, reduceMotion, listOpacity]
  );

  const { data: bookings = [], isLoading, isError, refetch, isFetching } = useQuery<Booking[]>({
    queryKey: ["client-bookings"],
    queryFn: async () => {
      const res = await clientApi.getMyBookings();
      // Un échec réel doit rester distinguable de "aucune réservation" — sinon
      // une cliente ayant de vrais rendez-vous à venir croit ne rien avoir réservé.
      if (!res.success) throw new Error(res.error ?? "Impossible de charger tes réservations");
      if (!res.data) return [];
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
          prestation_id: (prest.id ?? b.prestation_id ?? null) as number | null,
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
    // apiCall() ne rejette jamais — sans ce throw, un échec côté serveur
    // (délai de politique d'annulation dépassé, etc.) fermait quand même la
    // modale comme si l'annulation avait réussi : la cliente pouvait croire
    // avoir annulé un rendez-vous resté actif côté pro (risque de no-show).
    mutationFn: async (id: number) => {
      const res = await clientApi.cancelReservationWithPolicy(id);
      if (!res.success) throw new Error(res.error ?? "Impossible d'annuler ce rendez-vous");
      return res;
    },
    onSuccess: () => {
      setCancelTargetId(null);
      void queryClient.invalidateQueries({ queryKey: ["client-bookings"] });
    },
    onError: (e: unknown) => setCancelError(e instanceof Error ? e.message : "Impossible d'annuler ce rendez-vous"),
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

  const listHeader = (
    <View>
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.foreground, marginBottom: 20 }}>
        Mes réservations
      </Text>
      {/* Segmented control */}
      <View
        onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
        style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: 14, padding: 4 }}
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              left: 4,
              width: segmentWidth,
              borderRadius: 10,
              backgroundColor: colors.white,
              transform: [{ translateX: tabIndicatorX }],
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          />
        )}
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => handleTabChange(tab)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: activeTab === tab ? colors.foreground : colors.mutedForeground }}>
              {TAB_LABELS[tab]}{tab === "upcoming" && upcoming.length > 0 ? ` (${upcoming.length})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Promo banner */}
      {hasOnlyPastBookings && activeTab === "upcoming" && (
        <View style={{ marginTop: 12 }}>
          <LinearGradient colors={[colors.primaryLight, colors.background]} style={{ padding: 20, borderWidth: 2, borderColor: `${colors.primary}33`, borderRadius: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>Prête pour un nouveau soin ?</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 12, lineHeight: 18 }}>Retrouve nos expertes et réserve ta prochaine prestation !</Text>
            <AnimatedPressable onPress={() => router.push("/specialists")} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
              <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Réserve dès maintenant</Text>
            </AnimatedPressable>
          </LinearGradient>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
            {listHeader}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          </View>
        ) : isError ? (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
            {listHeader}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
              <ErrorMessage message="Impossible de charger tes réservations. Vérifie ta connexion." />
              <AnimatedPressable
                onPress={() => refetch()}
                style={{ backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
              >
                <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>Réessayer</Text>
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: listOpacity }}>
          <FlatList
            data={activeList}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />}
            removeClippedSubviews // BLYSS-FIX: 2.5
            maxToRenderPerBatch={8} // BLYSS-FIX: 2.5
            ListHeaderComponent={<View style={{ marginBottom: 12 }}>{listHeader}</View>}
            ListFooterComponent={activeTab === "upcoming" && (bookings?.length ?? 0) > 0 ? <WaitingListSection /> : null}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="calendar-outline" size={32} color={colors.mutedForeground} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
                  {activeTab === "upcoming" ? "Aucune réservation à venir" : activeTab === "past" ? "Aucun historique" : "Aucune annulation"}
                </Text>
                {activeTab === "upcoming" && (
                  <AnimatedPressable onPress={() => router.push("/specialists")} style={{ marginTop: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>Découvrir les expertes</Text>
                  </AnimatedPressable>
                )}
              </View>
            }
          />
          </Animated.View>
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
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlayDark }}>
          <Pressable style={{ flex: 1 }} onPress={() => setCancelTargetId(null)} />
          <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.destructiveLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 }}>
              <Ionicons name="close-circle-outline" size={28} color={colors.destructive} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: 8 }}>Annuler le rendez-vous ?</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 8 }}>
              Cette action est irréversible. Tu ne pourras pas récupérer ce créneau.
            </Text>
            {(() => {
              const list: Booking[] = Array.isArray(bookings) ? bookings : [];
              const target = list.find((b) => b.id === cancelTargetId);
              if (!target) return null;
              return (
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.warningText, textAlign: "center", marginBottom: 8 }}>
                  Annulation possible jusqu'à {target.cancellation_notice_hours}h avant le rendez-vous.
                </Text>
              );
            })()}
            {cancelError && <View style={{ marginBottom: 12 }}><ErrorMessage message={cancelError} /></View>}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <AnimatedPressable
                onPress={() => setCancelTargetId(null)}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Retour</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
                  if (cancelTargetId != null) cancelMutation.mutate(cancelTargetId);
                }}
                disabled={cancelMutation.isPending}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center", opacity: cancelMutation.isPending ? 0.7 : 1 }}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.onColor} />
                  : <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Confirmer l'annulation</Text>}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
