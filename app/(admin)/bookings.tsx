import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View, Text, SectionList, Pressable, TextInput, Modal,
  ActivityIndicator, RefreshControl, Platform, ScrollView, Share, Linking, StyleSheet,
} from "react-native";
import RNDateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useActionSheet } from "@/components/ui/ActionSheet";
import { adminApi, AdminBooking, AdminUser } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { useScrollToTop } from "@react-navigation/native";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { AdminIcon } from "@/components/admin/AdminIcon";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SectionLabel } from "@/components/admin/SectionLabel";
import { StatusBadge, type StatusTone } from "@/components/admin/StatusBadge";
import { ActionGrid, type ActionTileData } from "@/components/admin/ActionGrid";
import { Card } from "@/components/admin/Card";
import { useDebounce } from "@/hooks/useDebounce";

// ── Tokens ────────────────────────────────────────────────────────────────────
const BG      = ADMIN.bg;
const BORDER  = ADMIN.border;
const TEXT1   = ADMIN.text;
const TEXT2   = ADMIN.textSub;
const TEXT3   = ADMIN.textMuted;
const ACCENT  = ADMIN.accent;

// ── Types ─────────────────────────────────────────────────────────────────────
type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
type StatusFilter  = "all" | BookingStatus;

const STATUS_CFG: Record<BookingStatus, { label: string }> = {
  pending:   { label: "En attente" },
  confirmed: { label: "Confirmée" },
  completed: { label: "Terminée" },
  cancelled: { label: "Annulée" },
};

const STATUS_TONE: Record<BookingStatus, StatusTone> = {
  pending: "warning", confirmed: "info", completed: "success", cancelled: "danger",
};

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all",       label: "Tous" },
  { key: "pending",   label: "Attente" },
  { key: "confirmed", label: "Confirmée" },
  { key: "completed", label: "Terminée" },
  { key: "cancelled", label: "Annulée" },
];

// ── Avatar — a plain initial circle, same shape as the Users screen ──────────
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Text style={{ color: ADMIN.textSub, fontWeight: "700", fontSize: Math.round(size * 0.36) }}>{initials || "?"}</Text>
    </View>
  );
}

// ── Booking card — same shape as UserCard: avatar, title/subtitle, trailing
// badge + meta, swipe actions in the same bg-tint tone language. ────────────
function BookingCard({
  booking,
  onPress,
  onConfirm,
  onCancel,
  onLongPress,
}: {
  booking: AdminBooking;
  onPress: (b: AdminBooking) => void;
  onConfirm: (b: AdminBooking) => void;
  onCancel:  (b: AdminBooking) => void;
  onLongPress: (b: AdminBooking) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const cfg        = STATUS_CFG[booking.status as BookingStatus];
  const tone       = STATUS_TONE[booking.status as BookingStatus];
  const price      = typeof booking.price === "number" ? booking.price : parseFloat(String(booking.price ?? "0"));
  const dt         = new Date(booking.start_datetime);
  const time       = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateLabel  = dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const clientName = booking.client_name ?? `#${booking.id}`;
  const meta       = `${price > 0 ? `${price.toFixed(2).replace(".", ",")} €` : "—"} · ${dateLabel} ${time}`;

  const canConfirm = booking.status === "pending";
  const canCancel  = booking.status === "pending" || booking.status === "confirmed";

  const renderRightActions = () => (
    <View style={{ flexDirection: "row", marginBottom: ADMIN.space.md, borderTopRightRadius: ADMIN.cardRadius, borderBottomRightRadius: ADMIN.cardRadius, overflow: "hidden" }}>
      {canConfirm && (
        <Pressable onPress={() => { swipeRef.current?.close(); onConfirm(booking); }}
          style={{ width: 84, backgroundColor: ADMIN.infoBg, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Ionicons name="checkmark-circle-outline" size={20} color={ADMIN.info} />
          <Text style={{ color: ADMIN.info, fontSize: 11, fontWeight: "700" }}>Confirmer</Text>
        </Pressable>
      )}
      {canCancel && (
        <Pressable onPress={() => { swipeRef.current?.close(); onCancel(booking); }}
          style={{ width: 84, backgroundColor: ADMIN.dangerBg, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Ionicons name="close-circle-outline" size={20} color={ADMIN.danger} />
          <Text style={{ color: ADMIN.danger, fontSize: 11, fontWeight: "700" }}>Annuler</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <Swipeable ref={swipeRef}
      renderRightActions={(canConfirm || canCancel) ? renderRightActions : undefined}
      overshootRight={false} friction={2}>
      <AnimatedPressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(booking); }}
        onLongPress={() => onLongPress(booking)}
        style={{ marginBottom: ADMIN.space.md }}
      >
        <Card style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.md }}>
          <Avatar name={clientName} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ ...ADMIN.type.title, fontSize: 15, color: TEXT1 }} numberOfLines={1}>{clientName}</Text>
            <Text style={{ ...ADMIN.type.caption, color: TEXT2 }} numberOfLines={1}>
              {[booking.service_name, booking.pro_name].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 3 }}>
            {cfg && <StatusBadge label={cfg.label} tone={tone} />}
            <Text style={{ ...ADMIN.type.caption, color: TEXT3 }} numberOfLines={1}>{meta}</Text>
          </View>
        </Card>
      </AnimatedPressable>
    </Swipeable>
  );
}

// ── Detail row — label/value pair for the détails card. `Row` (used for list
// items elsewhere) stretches its title and trailing across the full width at
// matching bold weight, which for short label→value pairs reads as two
// disconnected headings with a canyon between them. This keeps the label
// muted and the value emphasized, so the pairing stays legible at a glance.
function DetailRow({ label, value, emphasize, showDivider = true }: {
  label: string; value: string; emphasize?: boolean; showDivider?: boolean;
}) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ADMIN.space.md,
      paddingHorizontal: ADMIN.space.lg, paddingVertical: ADMIN.space.md,
      borderBottomWidth: showDivider ? 1 : 0, borderBottomColor: ADMIN.border,
    }}>
      <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub }}>{label}</Text>
      <Text
        style={{ ...ADMIN.type.body, fontWeight: "700", color: emphasize ? ADMIN.success : ADMIN.text, fontSize: emphasize ? 16 : 14 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Booking detail sheet — same shape as UserDetailSheet: identity header,
// a details card, an action grid. ──────────────────────────────────────────
function BookingDetailSheet({
  booking, onClose, onConfirm, onCancel, confirmLoading, cancelLoading,
}: {
  booking: AdminBooking;
  onClose: () => void;
  onConfirm: (b: AdminBooking) => void;
  onCancel:  (b: AdminBooking) => void;
  confirmLoading: boolean;
  cancelLoading: boolean;
}) {
  const cfg        = STATUS_CFG[booking.status as BookingStatus];
  const tone       = STATUS_TONE[booking.status as BookingStatus];
  const price      = typeof booking.price === "number" ? booking.price : parseFloat(String(booking.price ?? "0"));
  const dt         = new Date(booking.start_datetime);
  const dateLabel  = dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const time       = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const clientName = booking.client_name ?? `#${booking.id}`;
  const canConfirm = booking.status === "pending";
  const canCancel  = booking.status === "pending" || booking.status === "confirmed";

  const handleShareEmail = async () => {
    if (!booking.client_email) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Share.share({ message: booking.client_email });
  };
  const handleCall = () => {
    if (!booking.client_phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Linking.openURL(`tel:${booking.client_phone}`).catch(() => {});
  };

  const tiles: ActionTileData[] = [
    ...(booking.client_email ? [{ key: "email", icon: "mail-outline" as const, tone: "neutral" as const, label: "Email", onPress: handleShareEmail }] : []),
    ...(booking.client_phone ? [{ key: "call", icon: "call-outline" as const, tone: "neutral" as const, label: "Appeler", onPress: handleCall }] : []),
    ...(canConfirm ? [{ key: "confirm", icon: "checkmark-circle-outline" as const, tone: "info" as const, label: "Confirmer", loading: confirmLoading, onPress: () => { onConfirm(booking); onClose(); } }] : []),
    ...(canCancel ? [{ key: "cancel", icon: "close-circle-outline" as const, tone: "danger" as const, label: "Annuler", loading: cancelLoading, onPress: () => { onCancel(booking); onClose(); } }] : []),
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: ADMIN.overlay }} onPress={onClose} />
        <View style={{ backgroundColor: ADMIN.surface, borderTopLeftRadius: ADMIN.sheetRadius, borderTopRightRadius: ADMIN.sheetRadius, maxHeight: "92%" }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: ADMIN.sheetHandle, alignSelf: "center", marginTop: ADMIN.space.md }} />
          <ScrollView contentContainerStyle={{ paddingBottom: ADMIN.space.xxl }} showsVerticalScrollIndicator={false}>
            {/* Identity */}
            <View style={{ paddingTop: ADMIN.space.sm, paddingBottom: ADMIN.space.xl, paddingHorizontal: ADMIN.space.xl, alignItems: "center", borderBottomWidth: 1, borderBottomColor: ADMIN.border }}>
              <View style={{ marginBottom: ADMIN.space.md }}>
                <Avatar name={clientName} size={56} />
              </View>
              <Text style={{ ...ADMIN.type.title, fontSize: 18, color: TEXT1, marginBottom: ADMIN.space.sm }} numberOfLines={1}>{clientName}</Text>
              {cfg && <StatusBadge label={cfg.label} tone={tone} />}
              <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={{ position: "absolute", top: 10, right: 20, width: 32, height: 32, borderRadius: 10, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={TEXT2} />
              </AnimatedIconButton>
            </View>

            {/* Détails */}
            <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.xl }}>
              <SectionLabel>Détails</SectionLabel>
              <Card style={{ padding: 0 }}>
                <DetailRow label="Prestation"    value={booking.service_name ?? "—"} />
                <DetailRow label="Professionnel" value={booking.pro_name ?? "—"} />
                <DetailRow label="Date"          value={dateLabel} />
                <DetailRow label="Heure"         value={time} />
                <DetailRow label="Prix"          value={price > 0 ? `${price.toFixed(2).replace(".", ",")} €` : "—"} emphasize showDivider={false} />
              </Card>
            </View>

            {/* Actions */}
            {tiles.length > 0 && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.xl }}>
                <SectionLabel>Actions</SectionLabel>
                <Card>
                  <ActionGrid tiles={tiles} />
                </Card>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Stats — one card, four facts, dividers not colored boxes ───────────────────
function StatsBar({ bookings }: { bookings: AdminBooking[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookings.forEach((b) => { if (c[b.status] !== undefined) c[b.status]++; });
    return c;
  }, [bookings]);

  const revenue = useMemo(() =>
    bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((s, b) => s + (typeof b.price === "number" ? b.price : parseFloat(String(b.price ?? "0"))), 0),
    [bookings]
  );

  // Single-word labels only — two words in a 4-column card wraps to a second line.
  const metrics = [
    { label: "CA",         value: `${revenue.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €` },
    { label: "Attente",    value: String(counts.pending) },
    { label: "Confirmées", value: String(counts.confirmed) },
    { label: "Terminées",  value: String(counts.completed) },
  ];

  return (
    <Card style={{ flexDirection: "row", marginBottom: 14 }}>
      {metrics.map((m, i) => (
        <React.Fragment key={m.label}>
          {i > 0 && <View style={{ width: 1, backgroundColor: BORDER, marginHorizontal: ADMIN.space.sm }} />}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ ...ADMIN.type.display, fontSize: 18, color: TEXT1 }} numberOfLines={1}>{m.value}</Text>
            <Text style={{ ...ADMIN.type.caption, color: TEXT3, marginTop: 2, textAlign: "center" }} numberOfLines={1}>{m.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </Card>
  );
}

// ── Advanced filters (date + client/pro) ──────────────────────────────────────
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ClientPicker({ selected, onSelect }: { selected: AdminUser | null; onSelect: (u: AdminUser | null) => void }) {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 320);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-users-search-bookings", debounced],
    queryFn:  () => adminApi.getUsers({ search: debounced, limit: 20 }),
    enabled:  debounced.length >= 2,
    staleTime: 30_000,
  });
  const results = (data?.data as AdminUser[] | undefined) ?? [];

  if (selected) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: ADMIN.surfaceHover, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ADMIN.accentBg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: ACCENT }}>
            {selected.first_name?.[0]?.toUpperCase()}{selected.last_name?.[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1 }}>{selected.first_name} {selected.last_name}</Text>
          <Text style={{ fontSize: 11, color: TEXT2 }} numberOfLines={1}>{selected.email}</Text>
        </View>
        <AnimatedIconButton onPress={() => onSelect(null)} accessibilityLabel="Retirer ce filtre">
          <Ionicons name="close-circle" size={20} color={TEXT3} />
        </AnimatedIconButton>
      </View>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: ADMIN.surfaceHover, borderRadius: 14, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, height: 46 }}>
        <Ionicons name="search-outline" size={16} color={TEXT3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Nom, prénom ou email…"
          placeholderTextColor={TEXT3}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, fontSize: 14, color: TEXT1 }}
        />
        {isFetching && <ActivityIndicator size="small" color={TEXT3} />}
      </View>
      {search.length < 2 && (
        <Text style={{ fontSize: 12, color: TEXT3, marginTop: 8 }}>Tape au moins 2 caractères pour chercher</Text>
      )}
      {results.length > 0 && (
        <View style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
          {results.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onSelect(u); }}
              style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: ADMIN.surfaceHover, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1, flex: 1 }} numberOfLines={1}>{u.first_name} {u.last_name}</Text>
              <Text style={{ fontSize: 11, color: TEXT3 }} numberOfLines={1}>{u.role}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function BookingFiltersModal({
  visible, date, client, onChangeDate, onChangeClient, onClose,
}: {
  visible: boolean;
  date: Date | null;
  client: AdminUser | null;
  onChangeDate: (d: Date | null) => void;
  onChangeClient: (u: AdminUser | null) => void;
  onClose: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (_e: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (picked) onChangeDate(picked);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: ADMIN.overlay }} onPress={onClose} />
        <View style={{ backgroundColor: ADMIN.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: ADMIN.borderStrong, alignSelf: "center", marginBottom: 20 }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: TEXT1 }}>Filtres avancés</Text>
            <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={TEXT2} />
            </AnimatedIconButton>
          </View>

          <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Date</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            <AnimatedPressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onChangeDate(new Date()); }}
              style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.surfaceHover, borderWidth: 1, borderColor: BORDER }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1 }}>Aujourd'hui</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => setShowPicker(true)}
              style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: date ? ADMIN.accentBg : ADMIN.surfaceHover, borderWidth: 1, borderColor: date ? ADMIN.accentBorder : BORDER }}
            >
              <Ionicons name="calendar-outline" size={14} color={date ? ACCENT : TEXT1} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: date ? ACCENT : TEXT1 }}>
                {date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "Choisir"}
              </Text>
            </AnimatedPressable>
            {date && (
              <AnimatedIconButton onPress={() => onChangeDate(null)} accessibilityLabel="Effacer le filtre de date" style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: ADMIN.surfaceHover, borderWidth: 1, borderColor: BORDER }}>
                <Ionicons name="close" size={16} color={TEXT2} />
              </AnimatedIconButton>
            )}
          </View>

          {showPicker && Platform.OS === "ios" && (
            <RNDateTimePicker mode="date" display="spinner" value={date ?? new Date()} onChange={handleDateChange} locale="fr-FR" style={{ marginBottom: 12 }} />
          )}
          {showPicker && Platform.OS === "android" && (
            <RNDateTimePicker mode="date" value={date ?? new Date()} onChange={handleDateChange} />
          )}

          <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Client ou pro</Text>
          <ClientPicker selected={client} onSelect={onChangeClient} />
        </View>
      </View>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminBookingsScreen() {
  const insets      = useSafeAreaInsets();
  const listRef     = useRef<SectionList>(null);
  useScrollToTop(listRef);
  const qc          = useQueryClient();
  const showActionSheet = useActionSheet();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch]             = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [refreshing, setRefreshing]     = useState(false);
  const [dateFilter, setDateFilter]     = useState<Date | null>(null);
  const [clientFilter, setClientFilter] = useState<AdminUser | null>(null);
  const [showFilters, setShowFilters]   = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const activeAdvancedFilters = (dateFilter ? 1 : 0) + (clientFilter ? 1 : 0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bookings", statusFilter, dateFilter ? toISODate(dateFilter) : null, clientFilter?.id ?? null],
    queryFn:  () => adminApi.getBookings({
      limit: 100,
      status: statusFilter !== "all" ? statusFilter : undefined,
      date: dateFilter ? toISODate(dateFilter) : undefined,
      user_id: clientFilter?.id,
    }),
    staleTime: 2 * 60_000,
  });

  const [bookingError, setBookingError] = useState<string | null>(null);

  const confirmMut = useMutation({
    mutationFn: (id: number) => adminApi.confirmBooking(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: () => setBookingError("Impossible de confirmer cette réservation."),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => adminApi.cancelBooking(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: () => setBookingError("Impossible d'annuler cette réservation."),
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const bookings = (data?.data as AdminBooking[] | undefined) ?? [];

  // Search is client-side over the fetched page — the bookings endpoint has no text-search param.
  const filteredBookings = useMemo(() => {
    if (!debouncedSearch) return bookings;
    const q = debouncedSearch.toLowerCase();
    return bookings.filter((b) =>
      [b.client_name, b.service_name, b.pro_name].some((f) => f?.toLowerCase().includes(q))
    );
  }, [bookings, debouncedSearch]);

  const sections = useMemo(() => {
    const grouped: Record<string, AdminBooking[]> = {};
    for (const b of filteredBookings) {
      const key = new Date(b.start_datetime).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [filteredBookings]);

  const handleConfirm = (b: AdminBooking) => {
    setBookingError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    confirmMut.mutate(b.id);
  };

  const handleCancel = (b: AdminBooking) => {
    setBookingError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    cancelMut.mutate(b.id);
  };

  // Long-press alternative to swipe — mirrors the Users context menu, and stays
  // reachable for VoiceOver/TalkBack users who can't perform the swipe gesture.
  const handleLongPress = useCallback((b: AdminBooking) => {
    const canConfirm = b.status === "pending";
    const canCancel  = b.status === "pending" || b.status === "confirmed";
    if (!canConfirm && !canCancel) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    const options = ["Fermer", ...(canConfirm ? ["Confirmer"] : []), ...(canCancel ? ["Annuler la réservation"] : [])];
    showActionSheet(
      {
        title: b.client_name ?? `Réservation #${b.id}`,
        options,
        cancelButtonIndex: 0,
        destructiveButtonIndex: canCancel ? options.length - 1 : undefined,
        userInterfaceStyle: "dark",
      },
      (idx) => {
        if (options[idx] === "Confirmer") handleConfirm(b);
        else if (options[idx] === "Annuler la réservation") handleCancel(b);
      }
    );
  }, [showActionSheet]);

  // ── Search + filters + stats — rendered as the SectionList header, so it
  // shares the list's own horizontal padding instead of adding its own.
  const ListHeader = useMemo(() => (
    <View style={{ paddingBottom: ADMIN.space.md }}>
      {/* Search — client-side, mirrors the Users search bar */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: ADMIN.surfaceHover, borderRadius: 12, height: 44, paddingHorizontal: 14, marginBottom: ADMIN.space.md }}>
        <Ionicons name="search-outline" size={16} color={TEXT3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Client, pro ou prestation…"
          placeholderTextColor={TEXT3}
          style={{ flex: 1, fontSize: 14, color: TEXT1 }}
          autoCorrect={false} spellCheck={false} returnKeyType="search"
          clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
        />
        {Platform.OS !== "ios" && search.length > 0 && (
          <AnimatedIconButton onPress={() => setSearch("")} accessibilityLabel="Effacer la recherche" hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={TEXT3} />
          </AnimatedIconButton>
        )}
      </View>

      {/* Segmented status tabs — same shape as the Users role tabs */}
      <View style={{ flexDirection: "row", backgroundColor: ADMIN.surfaceHover, borderRadius: 12, padding: 4, gap: 4, marginBottom: ADMIN.space.md }}>
        {FILTERS.map(({ key, label }) => {
          const active = statusFilter === key;
          return (
            <Pressable
              key={key}
              onPress={() => { setStatusFilter(key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center",
                backgroundColor: active ? ADMIN.accent : "transparent",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: active ? Colors.white : TEXT2 }} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Active advanced filter chips */}
      {(dateFilter || clientFilter) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {dateFilter && (
            <Pressable
              onPress={() => setDateFilter(null)}
              accessibilityLabel="Retirer le filtre de date"
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: ADMIN.accentBg, borderWidth: 1, borderColor: ADMIN.accentBorder }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: ACCENT }}>
                {dateFilter.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </Text>
              <Ionicons name="close" size={11} color={ACCENT} />
            </Pressable>
          )}
          {clientFilter && (
            <Pressable
              onPress={() => setClientFilter(null)}
              accessibilityLabel="Retirer le filtre de client ou pro"
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: ADMIN.accentBg, borderWidth: 1, borderColor: ADMIN.accentBorder }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: ACCENT }}>
                {clientFilter.first_name} {clientFilter.last_name}
              </Text>
              <Ionicons name="close" size={11} color={ACCENT} />
            </Pressable>
          )}
        </View>
      )}

      {/* Stats bar — only for "all" filter */}
      {statusFilter === "all" && !isLoading && filteredBookings.length > 0 && (
        <StatsBar bookings={filteredBookings} />
      )}
    </View>
  ), [search, filteredBookings, statusFilter, isLoading, activeAdvancedFilters, dateFilter, clientFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <AdminHeader
        title="Réservations"
        subtitle={!isLoading ? `${filteredBookings.length} réservation${filteredBookings.length > 1 ? "s" : ""}` : undefined}
        action={
          (confirmMut.isPending || cancelMut.isPending) ? (
            <ActivityIndicator size="small" color={ACCENT} />
          ) : (
            <AnimatedIconButton
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setShowFilters(true); }}
              accessibilityLabel={`Filtres avancés${activeAdvancedFilters > 0 ? ` (${activeAdvancedFilters} actifs)` : ""}`}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: activeAdvancedFilters > 0 ? ADMIN.accentBg : ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="options-outline" size={18} color={activeAdvancedFilters > 0 ? ACCENT : TEXT2} />
              {activeAdvancedFilters > 0 && (
                <View style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: Colors.white }}>{activeAdvancedFilters}</Text>
                </View>
              )}
            </AnimatedIconButton>
          )
        }
      />
      {bookingError && (
        <View style={{ paddingHorizontal: ADMIN.space.xl, marginBottom: ADMIN.space.md }}>
          <ErrorMessage message={bookingError} />
        </View>
      )}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ fontSize: 13, color: TEXT2 }}>Chargement…</Text>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: ADMIN.space.xl,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={{ backgroundColor: BG, paddingTop: ADMIN.space.md }}>
              <SectionLabel trailing={String(section.data.length)}>{section.title}</SectionLabel>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80, gap: 16 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 20, backgroundColor: ADMIN.surfaceHover,
                alignItems: "center", justifyContent: "center",
              }}>
                <AdminIcon ios="calendar.badge.exclamationmark" android="calendar-outline" size={30} color={TEXT3} />
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1 }}>
                  Aucune réservation
                </Text>
                <Text style={{ fontSize: 13, color: TEXT2, textAlign: "center" }}>
                  Rien à afficher pour ce filtre.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item: b }) => (
            <BookingCard booking={b} onPress={setSelectedBooking} onConfirm={handleConfirm} onCancel={handleCancel} onLongPress={handleLongPress} />
          )}
        />
      )}

      {selectedBooking && (
        <BookingDetailSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          confirmLoading={confirmMut.isPending}
          cancelLoading={cancelMut.isPending}
        />
      )}

      <BookingFiltersModal
        visible={showFilters}
        date={dateFilter}
        client={clientFilter}
        onChangeDate={setDateFilter}
        onChangeClient={setClientFilter}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
}