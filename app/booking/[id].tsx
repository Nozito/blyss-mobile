import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Linking,
  Animated,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { clientApi, reviewsApi, stripePaymentsApi } from "@/lib/api";
import { PaymentStep } from "@/components/screens/client/booking/PaymentStep";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BookingDetailData {
  id: number;
  start_datetime: string;
  end_datetime: string;
  status: "confirmed" | "pending" | "cancelled" | "completed" | "no_show";
  price: number;
  paid_online: boolean;
  payment_status: "unpaid" | "deposit_paid" | "fully_paid" | "paid_on_site" | "paid" | "pending";
  total_paid: number;
  deposit_amount: number;
  prestation_name: string | null;
  prestation_description: string | null;
  duration_minutes: number | null;
  pro_id: number;
  pro_first_name: string | null;
  pro_last_name: string | null;
  pro_activity_name: string | null;
  activity_name: string | null;
  pro_photo: string | null;
  profile_photo: string | null;
  pro_city: string | null;
  city: string | null;
  pro_phone: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function resolvePhoto(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

// ─── Animated Card ────────────────────────────────────────────────────────────
function FadeCard({ delay, style, children }: { delay: number; style?: object; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Star Picker ──────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scales = [0, 1, 2, 3, 4].map(() => useRef(new Animated.Value(1)).current);
  const handlePress = (i: number) => {
    onChange(i + 1);
    Animated.sequence([
      Animated.spring(scales[i], { toValue: 1.4, useNativeDriver: true, speed: 80, bounciness: 10 }),
      Animated.spring(scales[i], { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 0 }),
    ]).start();
  };
  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={{ transform: [{ scale: scales[i] }] }}>
          <Pressable onPress={() => handlePress(i)}>
            <Ionicons name={i < value ? "star" : "star-outline"} size={36} color={i < value ? "#FE5D9D" : "#D1D5DB"} />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ visible, proId, onClose }: { visible: boolean; proId: number; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const mutation = useMutation({
    mutationFn: () => reviewsApi.create(String(proId), { rating, comment }),
    onSuccess: onClose,
  });
  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Laisser un avis</Text>
          <Text style={styles.modalSubtitle}>Comment s'est passée ta séance ?</Text>
          <StarPicker value={rating} onChange={setRating} />
          <TextInput
            style={styles.modalInput}
            placeholder="Ton commentaire (optionnel)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
          />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.modalSubmitBtn, (rating === 0 || mutation.isPending) && { opacity: 0.6 }]}
              onPress={() => mutation.mutate()}
              disabled={rating === 0 || mutation.isPending}
            >
              {mutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.modalSubmitText}>Envoyer</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reviewVisible, setReviewVisible] = useState(false);
  const [balanceClientSecret, setBalanceClientSecret] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => clientApi.getBookingDetail(Number(id)),
    staleTime: 30_000,
    enabled: Boolean(id),
  });

  const handlePayBalance = async (reservationId: number) => {
    setBalanceLoading(true);
    try {
      const result = await stripePaymentsApi.createPaymentIntent({
        reservation_id: reservationId,
        type: "balance",
      });
      if (!result.success || !result.data) {
        Alert.alert("Erreur", result.error ?? "Impossible d'initier le paiement.");
        return;
      }
      setBalanceClientSecret(result.data.client_secret);
      setBalanceAmount(result.data.amount);
      setBalanceVisible(true);
    } catch {
      Alert.alert("Erreur", "Impossible d'initier le paiement. Réessaie plus tard.");
    } finally {
      setBalanceLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FE5D9D" />
        <Text style={styles.loadingText}>Chargement des détails...</Text>
      </View>
    );
  }

  const booking = data?.data as BookingDetailData | undefined;

  if (isError || !booking) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#FE5D9D" />
        <Text style={styles.errorText}>Impossible de charger cette réservation.</Text>
        <Pressable style={styles.errorBtn} onPress={() => router.replace("/(client)/bookings")}>
          <Text style={styles.errorBtnText}>Retour aux réservations</Text>
        </Pressable>
      </View>
    );
  }

  const rawProName = (booking.pro_activity_name ?? booking.activity_name)
    ?? `${booking.pro_first_name ?? ""} ${booking.pro_last_name ?? ""}`.trim();
  const proName = rawProName || "Spécialiste";
  const initial = proName[0]?.toUpperCase() ?? "P";
  const avatarUri = resolvePhoto(booking.pro_photo ?? booking.profile_photo);
  const city = booking.pro_city ?? booking.city;
  const remaining = Math.max(0, booking.price - (booking.total_paid ?? 0));

  const paymentBadge = (() => {
    const s = booking.payment_status;
    if (s === "fully_paid" || s === "paid")
      return { label: "✓ Payé en ligne", color: "#27AE60", bg: "#E8F8F0" };
    if (s === "paid_on_site")
      return { label: "✓ Payé sur place", color: "#27AE60", bg: "#E8F8F0" };
    if (s === "deposit_paid")
      return { label: "Acompte versé", color: "#3B82F6", bg: "#EFF6FF" };
    return { label: "Paiement en attente", color: "#F59E0B", bg: "#FEF3C7" };
  })();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedIconButton onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#09090B" />
        </AnimatedIconButton>
        <Text style={styles.headerTitle}>Détail réservation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Card Pro */}
        <FadeCard delay={100} style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={styles.proAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 64, height: 64 }} contentFit="cover" />
              ) : (
                <Text style={styles.proAvatarInitial}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proName} numberOfLines={1}>{proName}</Text>
              {Boolean(city) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="location-outline" size={13} color="#9CA3AF" />
                  <Text style={styles.proSub}>{city}</Text>
                </View>
              )}
            </View>
          </View>

          {booking.pro_phone && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${booking.pro_phone}`).catch(() => {})}>
                <Ionicons name="call-outline" size={16} color="#FE5D9D" />
                <Text style={styles.contactBtnText}>Appeler</Text>
              </Pressable>
              <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`sms:${booking.pro_phone}`).catch(() => {})}>
                <Ionicons name="chatbubble-outline" size={16} color="#FE5D9D" />
                <Text style={styles.contactBtnText}>SMS</Text>
              </Pressable>
            </View>
          )}
        </FadeCard>

        {/* Card Prestation */}
        <FadeCard delay={200} style={styles.card}>
          {booking.prestation_name && (
            <Text style={styles.prestationName}>{booking.prestation_name}</Text>
          )}
          {booking.prestation_description && (
            <Text style={styles.prestationDesc}>{booking.prestation_description}</Text>
          )}

          <View style={styles.infoRows}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar-outline" size={20} color="#FE5D9D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDate(booking.start_datetime)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time-outline" size={20} color="#FE5D9D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Horaire & Durée</Text>
                <Text style={styles.infoValue}>
                  {formatTime(booking.start_datetime)}
                  {booking.duration_minutes ? `  ·  ${formatDuration(booking.duration_minutes)}` : ""}
                </Text>
              </View>
            </View>

            {Boolean(city) && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="location-outline" size={20} color="#FE5D9D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Lieu</Text>
                  <Text style={styles.infoValue}>{city}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.separator} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalPrice}>{Number(booking.price ?? 0).toFixed(2)} €</Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <View style={[styles.paymentBadge, { backgroundColor: paymentBadge.bg }]}>
              <Text style={[styles.paymentBadgeText, { color: paymentBadge.color }]}>{paymentBadge.label}</Text>
            </View>
          </View>

          {booking.payment_status === "deposit_paid" && remaining > 0 && (
            <Pressable
              style={[styles.payBtn, balanceLoading && { opacity: 0.6 }]}
              onPress={() => void handlePayBalance(booking.id)}
              disabled={balanceLoading}
            >
              {balanceLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.payBtnText}>Payer le solde ({remaining.toFixed(2)} €)</Text>}
            </Pressable>
          )}
        </FadeCard>

        {/* Bouton avis */}
        {booking.status === "completed" && (
          <FadeCard delay={300}>
            <Pressable style={styles.reviewBtn} onPress={() => setReviewVisible(true)}>
              <Text style={styles.reviewBtnText}>⭐ Laisser un avis</Text>
            </Pressable>
          </FadeCard>
        )}
      </ScrollView>

      {/* Balance payment modal */}
      <Modal
        visible={balanceVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setBalanceVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={{ backgroundColor: "#FFF5F8", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#09090B" }}>Paiement du solde</Text>
              <Pressable onPress={() => setBalanceVisible(false)}>
                <Ionicons name="close" size={24} color="#09090B" />
              </Pressable>
            </View>
            <PaymentStep
              amount={balanceAmount}
              depositPercentage={0}
              prestationName={booking.prestation_name ?? undefined}
              clientSecret={balanceClientSecret}
              onSuccess={() => {
                setBalanceVisible(false);
                void refetch();
              }}
              onError={(msg) => Alert.alert("Erreur de paiement", msg)}
            />
          </View>
        </View>
      </Modal>

      <ReviewModal visible={reviewVisible} proId={booking.pro_id} onClose={() => setReviewVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF5F8" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFF5F8",
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#09090B" },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  centered: { flex: 1, backgroundColor: "#FFF5F8", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, color: "#6D6D78", marginTop: 8 },
  errorText: { fontSize: 15, color: "#09090B", textAlign: "center", lineHeight: 22 },
  errorBtn: { marginTop: 8, backgroundColor: "#FE5D9D", borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  errorBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  statusBadge: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  statusBadgeText: { fontSize: 15, fontWeight: "700" },

  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },

  proAvatar: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: "#FFE0EF", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  proAvatarInitial: { fontSize: 24, fontWeight: "800", color: "#FE5D9D" },
  proName: { fontSize: 17, fontWeight: "800", color: "#09090B", marginBottom: 2 },
  proSub: { fontSize: 13, color: "#9CA3AF" },

  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: "#FE5D9D30", borderRadius: 12,
    paddingVertical: 10, backgroundColor: "#FFF0F5",
  },
  contactBtnText: { fontSize: 14, fontWeight: "600", color: "#FE5D9D" },

  prestationName: { fontSize: 18, fontWeight: "800", color: "#09090B", marginBottom: 6 },
  prestationDesc: { fontSize: 13, color: "#6D6D78", lineHeight: 19, marginBottom: 14 },

  infoRows: { gap: 12, marginTop: 8 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  infoIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#FFF0F5", alignItems: "center", justifyContent: "center",
  },
  infoLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "600", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#09090B" },

  separator: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 16 },
  totalLabel: { fontSize: 15, color: "#6D6D78", fontWeight: "600" },
  totalPrice: { fontSize: 28, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 },

  paymentBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  paymentBadgeText: { fontSize: 12, fontWeight: "700" },

  payBtn: {
    marginTop: 14, backgroundColor: "#FE5D9D", borderRadius: 999, paddingVertical: 13, alignItems: "center",
    shadowColor: "#FE5D9D", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  reviewBtn: {
    backgroundColor: "#FE5D9D", borderRadius: 999, paddingVertical: 15, alignItems: "center", marginBottom: 12,
    shadowColor: "#FE5D9D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  reviewBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#09090B", textAlign: "center", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: "#6D6D78", textAlign: "center", marginBottom: 20 },
  modalInput: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12,
    marginTop: 20, fontSize: 14, color: "#09090B", minHeight: 90, textAlignVertical: "top",
  },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: "#6D6D78" },
  modalSubmitBtn: { flex: 1, backgroundColor: "#FE5D9D", borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  modalSubmitText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
