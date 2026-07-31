import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View, Text, SectionList, Pressable, ScrollView,
  ActivityIndicator, RefreshControl, Animated, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminBooking } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { useScrollToTop } from "@react-navigation/native";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

// ── Tokens ────────────────────────────────────────────────────────────────────
const BG      = ADMIN.bg;
const CARD    = ADMIN.surface;
const BORDER  = ADMIN.border;
const TEXT1   = ADMIN.text;
const TEXT2   = ADMIN.textSub;
const TEXT3   = ADMIN.textMuted;

// ── Types ─────────────────────────────────────────────────────────────────────
type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
type StatusFilter  = "all" | BookingStatus;

const STATUS_CFG: Record<BookingStatus, {
  label: string; color: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iosIcon: string;
  gradient: [string, string];
}> = {
  pending:   { label: "En attente", color: Colors.warning,     icon: "time-outline",             iosIcon: "clock",                  gradient: [Colors.warning,     `${Colors.warning}88`] },
  confirmed: { label: "Confirmée",  color: Colors.info,        icon: "checkmark-circle-outline", iosIcon: "checkmark.seal.fill",    gradient: [Colors.info,        `${Colors.info}88`] },
  completed: { label: "Terminée",   color: Colors.success,     icon: "checkmark-done-outline",   iosIcon: "checkmark.circle.fill",  gradient: [Colors.success,     `${Colors.success}88`] },
  cancelled: { label: "Annulée",    color: Colors.destructive, icon: "close-circle-outline",     iosIcon: "xmark.circle.fill",      gradient: [Colors.destructive, `${Colors.destructive}88`] },
};

const FILTERS: Array<{ key: StatusFilter; label: string; iosIcon: string; androidIcon: React.ComponentProps<typeof Ionicons>["name"] }> = [
  { key: "all",       label: "Tous",       iosIcon: "list.bullet",           androidIcon: "list-outline" },
  { key: "pending",   label: "En attente", iosIcon: "clock",                 androidIcon: "time-outline" },
  { key: "confirmed", label: "Confirmée",  iosIcon: "checkmark.seal",        androidIcon: "checkmark-circle-outline" },
  { key: "completed", label: "Terminée",   iosIcon: "checkmark.circle",      androidIcon: "checkmark-done-outline" },
  { key: "cancelled", label: "Annulée",    iosIcon: "xmark.circle",          androidIcon: "close-circle-outline" },
];

// ── Initiales avatar ──────────────────────────────────────────────────────────
function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <LinearGradient
      colors={[`${color}40`, `${color}18`]}
      style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <Text style={{ fontSize: 15, fontWeight: "900", color }}>{initials || "?"}</Text>
    </LinearGradient>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────
function BookingCard({
  booking,
  onConfirm,
  onCancel,
  onEdit,
}: {
  booking: AdminBooking;
  onConfirm: (b: AdminBooking) => void;
  onCancel:  (b: AdminBooking) => void;
  onEdit:    (b: AdminBooking) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const cfg         = STATUS_CFG[booking.status as BookingStatus];
  const statusColor = cfg?.color ?? Colors.admin;
  const price       = typeof booking.price === "number" ? booking.price : parseFloat(String(booking.price ?? "0"));
  const dt          = new Date(booking.start_datetime);
  const time        = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateLabel   = dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const clientName  = booking.client_name ?? `#${booking.id}`;

  const canConfirm = booking.status === "pending";
  const canCancel  = booking.status === "pending" || booking.status === "confirmed";

  const pressIn  = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, damping: 15, stiffness: 160 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 15, stiffness: 160 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 8 }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setExpanded((v) => !v);
        }}
        style={{
          borderRadius: 18,
          backgroundColor: CARD,
          borderWidth: 1,
          borderColor: expanded ? `${statusColor}35` : BORDER,
          overflow: "hidden",
          shadowColor: statusColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: expanded ? 0.18 : 0.06,
          shadowRadius: 14,
          elevation: 3,
        }}
      >
        {/* Accent bar gauche */}
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: statusColor, opacity: 0.7 }} />

        {/* Main row */}
        <View style={{ padding: 14, paddingLeft: 17 }}>
          {/* Ligne 1 : avatar + nom + badge statut */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 8 }}>
            <Avatar name={clientName} color={statusColor} />

            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "800", fontSize: 14, color: TEXT1, marginBottom: 3 }} numberOfLines={1}>
                {clientName}
              </Text>
              <Text style={{ fontSize: 11, color: TEXT2 }} numberOfLines={1}>
                {[booking.service_name, booking.pro_name].filter(Boolean).join(" · ")}
              </Text>
            </View>

            {/* Badge statut — rectangle arrondi proéminent */}
            {cfg && (
              <LinearGradient
                colors={[`${statusColor}28`, `${statusColor}14`]}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 11, paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1, borderColor: `${statusColor}40`,
                }}
              >
                {Platform.OS === "ios"
                  ? <SymbolView name={cfg.iosIcon as any} size={11} tintColor={statusColor} />
                  : <Ionicons name={cfg.icon} size={11} color={statusColor} />}
                <Text style={{ fontSize: 11, fontWeight: "800", color: statusColor, letterSpacing: 0.1 }}>
                  {cfg.label}
                </Text>
              </LinearGradient>
            )}
          </View>

          {/* Ligne 2 : date + prix + chevron */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 55 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4,
              backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 4 }}>
              <Ionicons name="calendar-outline" size={10} color={TEXT3} />
              <Text style={{ fontSize: 10, color: TEXT2, fontWeight: "600" }}>{dateLabel} · {time}</Text>
            </View>

            <View style={{ flex: 1 }} />

            <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.success, marginRight: (canConfirm || canCancel) ? 8 : 0 }}>
              {price > 0 ? `${price.toFixed(2).replace(".", ",")} €` : "—"}
            </Text>

            {(canConfirm || canCancel) && (
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={TEXT3}
              />
            )}
          </View>
        </View>

        {/* Expanded actions — une seule ligne */}
        {expanded && (
          <View style={{
            flexDirection: "row", gap: 7,
            paddingHorizontal: 14, paddingLeft: 17, paddingBottom: 13, paddingTop: 12,
            borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
          }}>
            {/* Modifier — toujours visible */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setExpanded(false);
                onEdit(booking);
              }}
              style={({ pressed }) => [{
                flex: 1, height: 42, borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.07)",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
                alignItems: "center", justifyContent: "center",
                flexDirection: "row", gap: 5,
                opacity: pressed ? 0.75 : 1,
              }]}
            >
              {Platform.OS === "ios"
                ? <SymbolView name="pencil" size={13} tintColor="rgba(255,255,255,0.7)" />
                : <Ionicons name="create-outline" size={13} color="rgba(255,255,255,0.7)" />}
              <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>Modifier</Text>
            </Pressable>

            {/* Confirmer — pending uniquement */}
            {canConfirm && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setExpanded(false);
                  onConfirm(booking);
                }}
                style={({ pressed }) => [{
                  flex: 1, height: 42, borderRadius: 12,
                  backgroundColor: `${Colors.info}20`,
                  borderWidth: 1, borderColor: `${Colors.info}45`,
                  alignItems: "center", justifyContent: "center",
                  flexDirection: "row", gap: 5,
                  opacity: pressed ? 0.75 : 1,
                }]}
              >
                {Platform.OS === "ios"
                  ? <SymbolView name="checkmark.circle.fill" size={13} tintColor={Colors.info} />
                  : <Ionicons name="checkmark-circle" size={13} color={Colors.info} />}
                <Text style={{ fontSize: 12, fontWeight: "800", color: Colors.info }}>Confirmer</Text>
              </Pressable>
            )}

            {/* Annuler — pending ou confirmed */}
            {canCancel && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setExpanded(false);
                  onCancel(booking);
                }}
                style={({ pressed }) => [{
                  flex: 1, height: 42, borderRadius: 12,
                  backgroundColor: "rgba(240,58,58,0.10)",
                  borderWidth: 1, borderColor: "rgba(240,58,58,0.25)",
                  alignItems: "center", justifyContent: "center",
                  flexDirection: "row", gap: 5,
                  opacity: pressed ? 0.75 : 1,
                }]}
              >
                {Platform.OS === "ios"
                  ? <SymbolView name="xmark.circle.fill" size={13} tintColor="#F03A3A" />
                  : <Ionicons name="close-circle-outline" size={13} color="#F03A3A" />}
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#F03A3A" }}>Annuler</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 4, paddingVertical: 10,
      backgroundColor: BG,
    }}>
      <Text style={{ fontSize: 11, fontWeight: "800", color: TEXT2,
        textTransform: "uppercase", letterSpacing: 1.2 }}>
        {title}
      </Text>
      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.07)" }}>
        <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3 }}>{count}</Text>
      </View>
    </View>
  );
}

// ── Stats bar (new) ────────────────────────────────────────────────────────────
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

  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
      {/* Revenue card */}
      <View style={{
        flex: 1.4, borderRadius: 16, padding: 14,
        backgroundColor: "rgba(34,197,94,0.08)",
        borderWidth: 1, borderColor: "rgba(34,197,94,0.20)",
      }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(34,197,94,0.7)", marginBottom: 4 }}>
          CA TOTAL
        </Text>
        <Text style={{ fontSize: 20, fontWeight: "900", color: Colors.success, letterSpacing: -0.5 }}>
          {revenue.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
        </Text>
      </View>

      {/* Status mini-cards */}
      <View style={{ flex: 2, flexDirection: "row", gap: 6 }}>
        {([
          { key: "pending",   color: Colors.warning },
          { key: "confirmed", color: Colors.info },
          { key: "completed", color: Colors.success },
        ] as const).map(({ key, color }) => (
          <View key={key} style={{ flex: 1, borderRadius: 14, padding: 10,
            backgroundColor: `${color}0D`, borderWidth: 1, borderColor: `${color}20`,
            alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color }}>{counts[key]}</Text>
            <Text style={{ fontSize: 9, color: `${color}AA`, fontWeight: "700", marginTop: 2, textAlign: "center" }}>
              {STATUS_CFG[key].label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminBookingsScreen() {
  const insets      = useSafeAreaInsets();
  const listRef     = useRef<SectionList>(null);
  useScrollToTop(listRef);
  const qc          = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing]     = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bookings", statusFilter],
    queryFn:  () => adminApi.getBookings({ limit: 100, status: statusFilter !== "all" ? statusFilter : undefined }),
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

  const sections = useMemo(() => {
    const grouped: Record<string, AdminBooking[]> = {};
    for (const b of bookings) {
      const key = new Date(b.start_datetime).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [bookings]);

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

  const handleEdit = () => { /* edition via écran dédié */ };

  // ── Header ─────────────────────────────────────────────────────────────────
  const ListHeader = useMemo(() => (
    <View style={{ paddingTop: insets.top, paddingBottom: 4 }}>
      {/* Title row */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
        <View>
          <Text style={{ fontSize: 30, fontWeight: "900", color: TEXT1, letterSpacing: -0.8 }}>
            Réservations
          </Text>
          {!isLoading && (
            <Text style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
              {bookings.length} réservation{bookings.length > 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {/* Refresh indicator */}
        {(confirmMut.isPending || cancelMut.isPending) && (
          <ActivityIndicator size="small" color={Colors.admin} />
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingVertical: 12 }}
      >
        {FILTERS.map((f) => {
          const cfg    = f.key !== "all" ? STATUS_CFG[f.key as BookingStatus] : null;
          const active = statusFilter === f.key;
          const color  = cfg?.color ?? Colors.admin;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setStatusFilter(f.key);
              }}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center", gap: 5,
                paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                backgroundColor: active ? `${color}20` : "rgba(255,255,255,0.05)",
                borderColor:     active ? `${color}45` : "rgba(255,255,255,0.09)",
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              {Platform.OS === "ios"
                ? <SymbolView name={f.iosIcon as any} size={12} tintColor={active ? color : "rgba(255,255,255,0.35)"} />
                : <Ionicons name={f.androidIcon} size={12} color={active ? color : "rgba(255,255,255,0.35)"} />}
              <Text style={{
                fontSize: 12, fontWeight: active ? "800" : "600",
                color: active ? color : "rgba(255,255,255,0.4)",
              }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Stats bar — only for "all" filter */}
      {statusFilter === "all" && !isLoading && bookings.length > 0 && (
        <StatsBar bookings={bookings} />
      )}
    </View>
  ), [bookings, statusFilter, isLoading, confirmMut.isPending, cancelMut.isPending]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {bookingError && (
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
          <ErrorMessage message={bookingError} />
        </View>
      )}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.admin} />
          <Text style={{ fontSize: 13, color: TEXT2 }}>Chargement…</Text>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.admin}
              colors={[Colors.admin]}
            />
          }
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.data.length} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80, gap: 16 }}>
              <LinearGradient
                colors={[`${Colors.admin}18`, `${Colors.admin}06`]}
                style={{ width: 80, height: 80, borderRadius: 24,
                  alignItems: "center", justifyContent: "center" }}
              >
                {Platform.OS === "ios"
                  ? <SymbolView name="calendar.badge.exclamationmark" size={34} tintColor={Colors.admin} />
                  : <Ionicons name="calendar-outline" size={34} color={Colors.admin} />}
              </LinearGradient>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT1 }}>
                  Aucune réservation
                </Text>
                <Text style={{ fontSize: 13, color: TEXT2, textAlign: "center" }}>
                  Rien à afficher pour ce filtre.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item: b }) => (
            <BookingCard booking={b} onConfirm={handleConfirm} onCancel={handleCancel} onEdit={handleEdit} />
          )}
        />
      )}
    </View>
  );
}