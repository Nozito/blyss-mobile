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
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { TAB_BOTTOM_PADDING } from "@/constants/layout";
import { Colors } from "@/constants/colors";
import { reviewSchema } from "@/lib/validation";
import { safeBack } from "@/lib/navigation";

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
  const s0 = useRef(new Animated.Value(1)).current;
  const s1 = useRef(new Animated.Value(1)).current;
  const s2 = useRef(new Animated.Value(1)).current;
  const s3 = useRef(new Animated.Value(1)).current;
  const s4 = useRef(new Animated.Value(1)).current;
  const scales = [s0, s1, s2, s3, s4];
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
          <Pressable
            onPress={() => handlePress(i)}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1} étoile${i > 0 ? "s" : ""}`}
            accessibilityState={{ selected: i < value }}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name={i < value ? "star" : "star-outline"} size={36} color={i < value ? Colors.primary : Colors.disabled} />
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
  const [reviewError, setReviewError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => reviewsApi.create(String(proId), { rating, comment }),
    onSuccess: onClose,
    onError: () => setReviewError("Impossible d'envoyer l'avis. Réessaie."),
  });

  const handleSubmit = () => {
    setReviewError(null);
    const result = reviewSchema.safeParse({ rating, comment });
    if (!result.success) {
      setReviewError(result.error.errors[0]?.message ?? "Données invalides.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlayDark }}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Laisser un avis</Text>
          <Text style={styles.modalSubtitle}>Comment s'est passée ta séance ?</Text>
          <StarPicker value={rating} onChange={setRating} />
          <TextInput
            style={styles.modalInput}
            placeholder="Ton commentaire (optionnel)"
            placeholderTextColor={Colors.mutedForeground}
            multiline
            numberOfLines={4}
            maxLength={200}
            value={comment}
            onChangeText={(t) => { setComment(t); setReviewError(null); }}
          />
          {reviewError && <View style={{ marginBottom: 8 }}><ErrorMessage message={reviewError} /></View>}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <Pressable style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.modalSubmitBtn, (rating === 0 || mutation.isPending) && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={rating === 0 || mutation.isPending}
            >
              {mutation.isPending
                ? <ActivityIndicator color={Colors.white} size="small" />
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
  const [bookingError, setBookingError]     = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => clientApi.getBookingDetail(Number(id)),
    staleTime: 30_000,
    enabled: Boolean(id),
  });

  const handlePayBalance = async (reservationId: number) => {
    setBalanceLoading(true);
    setBookingError(null);
    try {
      const result = await stripePaymentsApi.createPaymentIntent({
        reservation_id: reservationId,
        type: "balance",
      });
      if (!result.success || !result.data) {
        setBookingError(result.error ?? "Impossible d'initier le paiement.");
        return;
      }
      setBalanceClientSecret(result.data.client_secret);
      setBalanceAmount(result.data.amount);
      setBalanceVisible(true);
    } catch {
      setBookingError("Impossible d'initier le paiement. Réessaie plus tard.");
    } finally {
      setBalanceLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des détails...</Text>
      </View>
    );
  }

  const booking = data?.data as BookingDetailData | undefined;

  if (isError || !booking) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.primary} />
        <Text style={styles.errorText}>Impossible de charger cette réservation.</Text>
        <Pressable style={styles.errorBtn} onPress={() => void refetch()}>
          <Text style={styles.errorBtnText}>Réessayer</Text>
        </Pressable>
        <Pressable style={styles.errorBtnSecondary} onPress={() => router.replace("/(client)/bookings")}>
          <Text style={styles.errorBtnSecondaryText}>Retour aux réservations</Text>
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
      return { label: "Acompte versé", color: Colors.info, bg: Colors.infoLight };
    return { label: "Paiement en attente", color: Colors.warning, bg: Colors.warningLight };
  })();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedIconButton onPress={() => safeBack(router)} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </AnimatedIconButton>
        <Text style={styles.headerTitle}>Détail réservation</Text>
        <View style={{ width: 40 }} />
      </View>

      {bookingError && (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <ErrorMessage message={bookingError} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + TAB_BOTTOM_PADDING }]}
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
                  <Ionicons name="location-outline" size={13} color={Colors.mutedForeground} />
                  <Text style={styles.proSub}>{city}</Text>
                </View>
              )}
            </View>
          </View>

          {booking.pro_phone && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                style={styles.contactBtn}
                onPress={() =>
                  Linking.canOpenURL(`tel:${booking.pro_phone}`)
                    .then((ok) => { if (ok) Linking.openURL(`tel:${booking.pro_phone}`); })
                    .catch(() => {})
                }
              >
                <Ionicons name="call-outline" size={16} color={Colors.primary} />
                <Text style={styles.contactBtnText}>Appeler</Text>
              </Pressable>
              <Pressable
                style={styles.contactBtn}
                onPress={() =>
                  Linking.canOpenURL(`sms:${booking.pro_phone}`)
                    .then((ok) => { if (ok) Linking.openURL(`sms:${booking.pro_phone}`); })
                    .catch(() => {})
                }
              >
                <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
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
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDate(booking.start_datetime)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
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
                  <Ionicons name="location-outline" size={20} color={Colors.primary} />
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
                ? <ActivityIndicator color={Colors.white} size="small" />
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlayDark }}
        >
          <View style={{ backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>Paiement du solde</Text>
              <Pressable onPress={() => setBalanceVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.foreground} />
              </Pressable>
            </View>
            <PaymentStep
              amount={balanceAmount}
              depositPercentage={0}
              prestationName={booking.prestation_name ?? undefined}
              clientSecret={balanceClientSecret}
              onSuccess={async () => {
                await refetch();
                setBalanceVisible(false);
              }}
              onError={(msg) => setBookingError(msg)}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ReviewModal visible={reviewVisible} proId={booking.pro_id} onClose={() => setReviewVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 0, paddingBottom: 12, backgroundColor: Colors.background,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.foreground },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  centered: { flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, color: Colors.mutedForeground, marginTop: 8 },
  errorText: { fontSize: 15, color: Colors.foreground, textAlign: "center", lineHeight: 22 },
  errorBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, minWidth: 160, alignItems: "center" },
  errorBtnText: { color: Colors.white, fontWeight: "700", fontSize: 14 },
  errorBtnSecondary: { marginTop: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 24, minWidth: 160, alignItems: "center" },
  errorBtnSecondaryText: { color: Colors.mutedForeground, fontWeight: "600", fontSize: 14 },

  statusBadge: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  statusBadgeText: { fontSize: 15, fontWeight: "700" },

  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },

  proAvatar: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  proAvatarInitial: { fontSize: 24, fontWeight: "800", color: Colors.primary },
  proName: { fontSize: 17, fontWeight: "800", color: Colors.foreground, marginBottom: 2 },
  proSub: { fontSize: 13, color: Colors.mutedForeground },

  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: `${Colors.primary}30`, borderRadius: 12,
    paddingVertical: 13, minHeight: 44, backgroundColor: Colors.primaryLight,
  },
  contactBtnText: { fontSize: 14, fontWeight: "600", color: Colors.primary },

  prestationName: { fontSize: 18, fontWeight: "800", color: Colors.foreground, marginBottom: 6 },
  prestationDesc: { fontSize: 13, color: Colors.mutedForeground, lineHeight: 19, marginBottom: 14 },

  infoRows: { gap: 12, marginTop: 8 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  infoIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  infoLabel: { fontSize: 11, color: Colors.mutedForeground, fontWeight: "600", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: "600", color: Colors.foreground },

  separator: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  totalLabel: { fontSize: 15, color: Colors.mutedForeground, fontWeight: "600" },
  totalPrice: { fontSize: 28, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 },

  paymentBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  paymentBadgeText: { fontSize: 12, fontWeight: "700" },

  payBtn: {
    marginTop: 14, backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 13, alignItems: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  payBtnText: { color: Colors.white, fontWeight: "700", fontSize: 15 },

  reviewBtn: {
    backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 15, alignItems: "center", marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  reviewBtnText: { color: Colors.white, fontWeight: "700", fontSize: 16 },

  modalSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: Colors.foreground, textAlign: "center", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: Colors.mutedForeground, textAlign: "center", marginBottom: 20 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12,
    marginTop: 20, fontSize: 14, color: Colors.foreground, minHeight: 90, textAlignVertical: "top",
  },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: Colors.mutedForeground },
  modalSubmitBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: 999, paddingVertical: 13, alignItems: "center" },
  modalSubmitText: { fontSize: 15, fontWeight: "700", color: Colors.white },
});
