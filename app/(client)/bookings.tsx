import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { clientApi } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: number;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  start_datetime: string;
  prestation: { name: string; duration_minutes: number } | null;
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
  confirmed: { label: "Confirmé",   prefix: "✓ ", bg: "#E8F8F0", color: "#27AE60" },
  pending:   { label: "En attente", prefix: "",   bg: "#FFF8E1", color: "#F39C12" },
  cancelled: { label: "Annulé",     prefix: "✕ ", bg: "#FDECEA", color: "#E74C3C" },
  completed: { label: "Terminé",    prefix: "✓ ", bg: "#E8F8F0", color: "#27AE60" },
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
  const price = (booking as Record<string, unknown>).price
    ?? (booking.prestation as Record<string, unknown> | null)?.price
    ?? null;
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
          <Ionicons name="calendar-outline" size={13} color="#FE5D9D" />
          <Text style={styles.cardDate}>{formatDate(booking.start_datetime)}</Text>
          {formatTime(booking.start_datetime) ? (
            <>
              <Text style={{ fontSize: 12, color: "#CCC" }}>·</Text>
              <Ionicons name="time-outline" size={13} color="#FE5D9D" />
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
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="calendar" size={36} color="#E91E8C" />
      </View>
      <Text style={styles.emptyTitle}>Aucune réservation</Text>
      <Text style={styles.emptySubtitle}>
        Tes prochains rendez-vous beauté apparaîtront ici
      </Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => router.push("/(client)/specialists")}
      >
        <Text style={styles.ctaText}>Trouver une spécialiste</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => clientApi.getMyBookings(),
    staleTime: 30_000,
    enabled: isAuthenticated,
  });

  const bookings: Booking[] = Array.isArray(data?.data)
    ? (data.data as Booking[])
    : [];

  const upcomingBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "pending"
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled"
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes réservations</Text>
        <Text style={styles.headerSubtitle}>Retrouve tous tes rendez-vous ici</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Bannière CTA — toujours visible */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaBannerTitle}>Prête pour un nouveau soin ?</Text>
          <Text style={styles.ctaBannerSubtitle}>
            Retrouve nos expertes et réserve ta prochaine prestation en quelques clics.
          </Text>
          <TouchableOpacity
            style={styles.ctaBannerButton}
            onPress={() => router.push("/(client)/specialists")}
          >
            <Text style={styles.ctaText}>Réserve dès maintenant</Text>
          </TouchableOpacity>
        </View>

        {isLoading && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}

        {!isLoading && !isError && bookings.length === 0 && <EmptyState />}

        {!isLoading && upcomingBookings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>À venir ({upcomingBookings.length})</Text>
            {upcomingBookings.map((b, i) => (
              <BookingCard key={b.id} booking={b} index={i} />
            ))}
          </>
        )}

        {!isLoading && pastBookings.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, upcomingBookings.length > 0 && { marginTop: 8 }]}>
              Historique ({pastBookings.length})
            </Text>
            {pastBookings.map((b, i) => (
              <BookingCard key={b.id} booking={b} index={i} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF0F5" },

  header: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: "#FFF0F5" },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: "#6D6D78", marginTop: 4 },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

  ctaBanner: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    alignItems: "center",
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  ctaBannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFF0F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  ctaBannerTitle: { fontSize: 17, fontWeight: "800", color: "#09090B", marginBottom: 6, textAlign: "center" },
  ctaBannerSubtitle: { fontSize: 13, color: "#6D6D78", lineHeight: 19, marginBottom: 16, textAlign: "center" },
  ctaBannerButton: {
    backgroundColor: "#FE5D9D",
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: "center",
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#09090B", marginTop: 24, marginBottom: 12 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFE0EF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarText: { fontSize: 18, fontWeight: "700", color: "#FE5D9D" },
  cardProName: { fontSize: 15, fontWeight: "700", color: "#09090B", marginBottom: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  cardPrestation: { fontSize: 13, color: "#666", marginBottom: 4 },
  cardDateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardDate: { fontSize: 12, color: "#888", textTransform: "capitalize" },
  cardTime: { fontWeight: "600", color: "#09090B" },

  skeletonTitle: { height: 18, width: "55%", backgroundColor: "#F0E0E8", borderRadius: 8, marginBottom: 10 },
  skeletonLine:  { height: 14, width: "75%", backgroundColor: "#F5E8EE", borderRadius: 8, marginBottom: 8 },
  skeletonShort: { height: 13, width: "40%", backgroundColor: "#F5E8EE", borderRadius: 8 },

  emptyContainer: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#FFE0EF", alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#09090B", marginBottom: 8, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: "#6D6D78", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  ctaButton: { backgroundColor: "#FE5D9D", borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  ctaText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});
