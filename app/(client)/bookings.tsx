import React, { useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  Pressable,
  type ListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { clientApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: number;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  start_datetime: string;
  price?: number;
  prestation: { name: string; duration_minutes: number; price?: number } | null;
  pro: {
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    profile_photo: string | null;
    city: string | null;
  } | null;
}

// ─── Badge config ─────────────────────────────────────────────────────────────
const BADGE: Record<string, { label: string; prefix: string; bg: string; color: string }> = {
  confirmed: { label: "Confirmé",   prefix: "✓ ", bg: Colors.successLight,     color: Colors.successText },
  pending:   { label: "En attente", prefix: "",   bg: Colors.warningLight,     color: Colors.warningText },
  cancelled: { label: "Annulé",     prefix: "✕ ", bg: Colors.destructiveLight, color: Colors.destructiveText },
  completed: { label: "Terminé",    prefix: "✓ ", bg: Colors.successLight,     color: Colors.successText },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "long",
  }).toLowerCase();
}

function formatTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonShort} />
    </Animated.View>
  );
}

// ─── Booking Card ─────────────────────────────────────────────────────────────
function BookingCard({ booking, index }: { booking: Booking; index: number }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const fadeSlide = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeSlide, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const badge = BADGE[booking.status] ?? BADGE.pending;
  const rawName = `${booking.pro?.first_name ?? ""} ${booking.pro?.last_name ?? ""}`.trim();
  const proName = booking.pro?.name || rawName || "Spécialiste";
  const prestationName = booking.prestation?.name ?? "Prestation";
  const price = booking.price ?? booking.prestation?.price ?? null;
  const initial = proName[0]?.toUpperCase() ?? "S";

  return (
    <Animated.View style={{ opacity: fadeSlide, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()
        }
        onPress={() =>
          router.push({ pathname: "/booking/[id]", params: { id: String(booking.id) } })
        }
        style={styles.card}
      >
        {/* Row 1 : nom pro + badge statut */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={styles.cardAvatar}>
              <Text style={styles.cardAvatarText}>{initial}</Text>
            </View>
            <Text style={styles.cardProName} numberOfLines={1}>{proName}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {badge.prefix}{badge.label}
            </Text>
          </View>
        </View>

        {/* Row 2 : prestation + prix */}
        <Text style={styles.cardPrestation} numberOfLines={1}>
          {prestationName}{price != null ? `  ·  ${Number(price).toFixed(2)} €` : ""}
        </Text>

        {/* Row 3 : date et heure */}
        <View style={styles.cardDateRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
          <Text style={styles.cardDate}>{formatDate(booking.start_datetime)}</Text>
          {formatTime(booking.start_datetime) ? (
            <>
              <Text style={{ fontSize: 12, color: Colors.border }}>·</Text>
              <Ionicons name="time-outline" size={13} color={Colors.primary} />
              <Text style={styles.cardDate}>{formatTime(booking.start_datetime)}</Text>
            </>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  const router = useRouter();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIcon, { transform: [{ scale: pulse }] }]}>
        <Ionicons name="calendar" size={36} color={Colors.primary} />
      </Animated.View>
      <Text style={styles.emptyTitle}>Aucune réservation</Text>
      <Text style={styles.emptySubtitle}>
        Tes prochains rendez-vous beauté apparaîtront ici
      </Text>
      <AnimatedPressable
        style={styles.ctaButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.push("/specialists");
        }}
      >
        <Text style={styles.ctaText}>Trouver une spécialiste</Text>
      </AnimatedPressable>
    </View>
  );
}

// ─── Row model (flat list — properly virtualized) ────────────────────────────
type Row =
  | { kind: "skeleton"; key: string }
  | { kind: "empty"; key: string }
  | { kind: "promo"; key: string }
  | { kind: "section"; key: string; title: string; compact?: boolean }
  | { kind: "booking"; key: string; booking: Booking; index: number };

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const listRef = useRef(null);
  useScrollToTop(listRef);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-bookings"],
    queryFn: () => clientApi.getMyBookings(),
    staleTime: 30_000,
    enabled: isAuthenticated,
  });

  const bookings: Booking[] = Array.isArray(data?.data)
    ? (data.data as Booking[])
    : [];

  const { upcomingBookings, pastBookings } = useMemo(
    () => ({
      upcomingBookings: bookings.filter(
        (b) => b.status === "confirmed" || b.status === "pending"
      ),
      pastBookings: bookings.filter(
        (b) => b.status === "completed" || b.status === "cancelled"
      ),
    }),
    [bookings]
  );

  // Promo banner only makes sense once the client already has booking history —
  // otherwise it duplicates the EmptyState's own CTA on the same screen.
  const showPromoBanner = !isLoading && bookings.length > 0;

  const rows = useMemo<Row[]>(() => {
    if (isLoading) {
      return [0, 1, 2].map((i) => ({ kind: "skeleton" as const, key: `skeleton-${i}` }));
    }
    const list: Row[] = [];
    if (showPromoBanner) list.push({ kind: "promo", key: "promo" });
    if (!isError && bookings.length === 0) {
      list.push({ kind: "empty", key: "empty" });
      return list;
    }
    if (upcomingBookings.length > 0) {
      list.push({ kind: "section", key: "section-upcoming", title: `À venir (${upcomingBookings.length})` });
      upcomingBookings.forEach((b, i) => list.push({ kind: "booking", key: `up-${b.id}`, booking: b, index: i }));
    }
    if (pastBookings.length > 0) {
      list.push({
        kind: "section",
        key: "section-past",
        title: `Historique (${pastBookings.length})`,
        compact: upcomingBookings.length > 0,
      });
      pastBookings.forEach((b, i) => list.push({ kind: "booking", key: `past-${b.id}`, booking: b, index: i }));
    }
    return list;
  }, [isLoading, isError, bookings.length, showPromoBanner, upcomingBookings, pastBookings]);

  const handlePromoPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/specialists");
  }, [router]);

  const renderRow = useCallback<ListRenderItem<Row>>(
    ({ item }) => {
      switch (item.kind) {
        case "skeleton":
          return <SkeletonCard />;
        case "empty":
          return <EmptyState />;
        case "promo":
          return (
            <View style={styles.ctaBanner}>
              <Text style={styles.ctaBannerTitle}>Prête pour un nouveau soin ?</Text>
              <Text style={styles.ctaBannerSubtitle}>
                Retrouve nos expertes et réserve ta prochaine prestation en quelques clics.
              </Text>
              <AnimatedPressable style={styles.ctaBannerButton} onPress={handlePromoPress}>
                <Text style={styles.ctaText}>Réserve dès maintenant</Text>
              </AnimatedPressable>
            </View>
          );
        case "section":
          return (
            <Text style={[styles.sectionTitle, item.compact && { marginTop: 8 }]}>
              {item.title}
            </Text>
          );
        case "booking":
          return <BookingCard booking={item.booking} index={item.index} />;
      }
    },
    [handlePromoPress]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes réservations</Text>
        <Text style={styles.headerSubtitle}>Retrouve tous tes rendez-vous ici</Text>
      </View>

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={8}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.background },
  headerTitle: { fontSize: 26, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: Colors.mutedForeground, marginTop: 4 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

  ctaBanner: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  ctaBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ctaBannerTitle: { fontSize: 17, fontWeight: "800", color: Colors.foreground, marginBottom: 6, textAlign: "center" },
  ctaBannerSubtitle: { fontSize: 13, color: Colors.mutedForeground, lineHeight: 19, marginBottom: 16, textAlign: "center" },
  ctaBannerButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  sectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.foreground, marginTop: 24, marginBottom: 12 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarText: { fontSize: 18, fontWeight: "700", color: Colors.primary },
  cardProName: { fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardPrestation: { fontSize: 13, color: Colors.mutedForeground, marginBottom: 4 },
  cardDateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardDate: { fontSize: 12, color: Colors.mutedForeground, textTransform: "capitalize" },
  cardTime: { fontWeight: "600", color: Colors.foreground },

  skeletonTitle: { height: 18, width: "55%", backgroundColor: Colors.muted, borderRadius: 8, marginBottom: 10 },
  skeletonLine:  { height: 14, width: "75%", backgroundColor: Colors.muted, borderRadius: 8, marginBottom: 8 },
  skeletonShort: { height: 13, width: "40%", backgroundColor: Colors.muted, borderRadius: 8 },

  emptyContainer: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: Colors.foreground, marginBottom: 8, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: Colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  ctaButton: { backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  ctaText: { color: Colors.white, fontSize: 15, fontWeight: "700" },
});
