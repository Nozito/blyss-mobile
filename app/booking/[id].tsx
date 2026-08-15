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
import { clientApi, reviewsApi, stripePaymentsApi, messagesApi } from "@/lib/api";
import { PaymentStep } from "@/components/screens/client/booking/PaymentStep";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors } from "@/hooks/useThemeColors";
import { reviewSchema } from "@/lib/validation";
import { safeBack } from "@/lib/navigation";
import { resolveMediaUrl } from "@/lib/media";
import { formatDuration } from "@/lib/dateUtils";
import { computeRemainingBalance } from "@/lib/bookingUtils";

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
  /** Only present when this booking's status is 'confirmed' or 'completed' —
   * the pro's exact address stays private otherwise, even from this client. */
  address_line?: string | null;
  postal_code?: string | null;
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
  const colors = useThemeColors();
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
            <Ionicons name={i < value ? "star" : "star-outline"} size={36} color={i < value ? colors.primary : colors.disabled} />
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ visible, proId, onClose }: { visible: boolean; proId: number; onClose: () => void }) {
  const colors = useThemeColors();
  const styles = useStyles(colors);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await reviewsApi.create(String(proId), { rating, comment });
      if (!res.success) throw new Error(res.error ?? "Impossible d'envoyer l'avis");
      return res;
    },
    onSuccess: onClose,
    onError: (e: unknown) => setReviewError(e instanceof Error ? e.message : "Impossible d'envoyer l'avis. Réessaie."),
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
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlayDark }}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Laisser un avis</Text>
          <Text style={styles.modalSubtitle}>Comment s'est passée ta séance ?</Text>
          <StarPicker value={rating} onChange={setRating} />
          <TextInput
            style={styles.modalInput}
            placeholder="Ton commentaire (optionnel)"
            placeholderTextColor={colors.mutedForeground}
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
                ? <ActivityIndicator color={colors.onColor} size="small" />
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
  const colors = useThemeColors();
  const styles = useStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [reviewVisible, setReviewVisible] = useState(false);
  const [balanceClientSecret, setBalanceClientSecret] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [bookingError, setBookingError]     = useState<string | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [contactingPro, setContactingPro] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => clientApi.getBookingDetail(Number(id)),
    staleTime: 30_000,
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: number) => clientApi.cancelReservationWithPolicy(reservationId),
    onSuccess: async (res) => {
      if (!res.success) {
        setBookingError(res.error ?? "Impossible d'annuler cette réservation.");
        return;
      }
      setCancelConfirmVisible(false);
      await refetch();
    },
    onError: () => setBookingError("Impossible d'annuler cette réservation. Réessaie plus tard."),
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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des détails...</Text>
      </View>
    );
  }

  const booking = data?.data as BookingDetailData | undefined;

  if (isError || !booking) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.primary} />
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
  const avatarUri = resolveMediaUrl(booking.pro_photo ?? booking.profile_photo);
  const city = booking.pro_city ?? booking.city;
  const remaining = computeRemainingBalance(booking.price, booking.total_paid ?? 0);

  const paymentBadge = (() => {
    const s = booking.payment_status;
    if (s === "fully_paid" || s === "paid")
      return { label: "✓ Payé en ligne", color: colors.successText, bg: colors.successLight };
    if (s === "paid_on_site")
      return { label: "✓ Payé sur place", color: colors.successText, bg: colors.successLight };
    if (s === "deposit_paid")
      return { label: "Acompte versé", color: colors.info, bg: colors.infoLight };
    // "unpaid" couvre deux cas très différents : un paiement en ligne qui
    // aurait dû aboutir mais ne l'a pas (vraiment "en attente", à surveiller)
    // et une réservation "payer sur place" où rien n'est dû avant le
    // rendez-vous (état normal, pas un souci) — le badge orange laissait
    // penser au client que quelque chose clochait dans ce second cas.
    if (!booking.paid_online)
      return { label: "À régler sur place", color: colors.info, bg: colors.infoLight };
    return { label: "Paiement en attente", color: colors.warning, bg: colors.warningLight };
  })();

  const statusBadge = (() => {
    switch (booking.status) {
      case "confirmed":
        return { label: "✓ Confirmé", color: colors.successText, bg: colors.successLight };
      case "pending":
        return { label: "En attente de confirmation", color: colors.warning, bg: colors.warningLight };
      case "cancelled":
        return { label: "✕ Annulé", color: colors.destructive, bg: colors.destructiveLight };
      case "completed":
        return { label: "✓ Terminé", color: colors.successText, bg: colors.successLight };
      case "no_show":
        return { label: "Non honoré", color: colors.destructive, bg: colors.destructiveLight };
      default:
        return null;
    }
  })();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedIconButton onPress={() => safeBack(router)} style={styles.headerBack} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
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
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
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
              {statusBadge && (
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg, alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 3 }]}>
                  <Text style={[styles.statusBadgeText, { color: statusBadge.color, fontSize: 11 }]}>{statusBadge.label}</Text>
                </View>
              )}
              {Boolean(city) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
                  <Text style={styles.proSub}>{city}</Text>
                </View>
              )}
              {Boolean(booking.address_line) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="pin-outline" size={13} color={colors.mutedForeground} />
                  <Text style={styles.proSub} numberOfLines={1}>
                    {booking.address_line}{booking.postal_code ? `, ${booking.postal_code}` : ""}
                  </Text>
                </View>
              )}
              {!booking.address_line && booking.status === "pending" && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="lock-closed-outline" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.proSub, { fontSize: 11.5 }]}>
                    L'adresse exacte sera communiquée une fois la réservation confirmée
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            {Boolean(booking.address_line) && (
              <Pressable
                style={[styles.contactBtn, styles.contactBtnSolo]}
                onPress={() => {
                  const query = encodeURIComponent(
                    `${booking.address_line}, ${booking.postal_code ?? ""} ${city ?? ""}`.trim()
                  );
                  const url = Platform.select({
                    ios: `maps:0,0?q=${query}`,
                    android: `geo:0,0?q=${query}`,
                    default: `https://maps.google.com/?q=${query}`,
                  });
                  Linking.openURL(url!).catch(() => {});
                }}
              >
                <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                <Text style={styles.contactBtnText}>Voir l'itinéraire</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.contactBtn, styles.contactBtnSolo, { opacity: contactingPro ? 0.6 : 1 }]}
              disabled={contactingPro}
              onPress={async () => {
                if (contactingPro) return;
                setContactingPro(true);
                const res = await messagesApi.openThread(booking.pro_id, booking.id);
                setContactingPro(false);
                if (res.success && res.data) {
                  router.push({ pathname: "/message-thread/[id]", params: { id: String(res.data.id) } });
                } else {
                  showToast(res.error ?? "Impossible d'ouvrir la conversation", "error");
                }
              }}
            >
              {contactingPro
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />}
              <Text style={styles.contactBtnText}>Message</Text>
            </Pressable>
          </View>
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
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDate(booking.start_datetime)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
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
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
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
                ? <ActivityIndicator color={colors.onColor} size="small" />
                : <Text style={styles.payBtnText}>Payer le solde ({remaining.toFixed(2)} €)</Text>}
            </Pressable>
          )}
        </FadeCard>

        {/* Bouton avis */}
        {booking.status === "completed" && (
          <FadeCard delay={300}>
            <Pressable style={[styles.reviewBtn, { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }]} onPress={() => setReviewVisible(true)}>
              <Ionicons name="star" size={16} color={colors.onColor} />
              <Text style={styles.reviewBtnText}>Laisser un avis</Text>
            </Pressable>
          </FadeCard>
        )}

        {/* Annulation — uniquement pour une réservation à venir non encore honorée */}
        {(booking.status === "confirmed" || booking.status === "pending") && (
          <FadeCard delay={300}>
            <Pressable
              style={styles.cancelBookingBtn}
              onPress={() => setCancelConfirmVisible(true)}
            >
              <Text style={styles.cancelBookingBtnText}>Annuler ma réservation</Text>
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
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlayDark }}
        >
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Paiement du solde</Text>
              <Pressable onPress={() => setBalanceVisible(false)} accessibilityRole="button" accessibilityLabel="Fermer">
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <PaymentStep
              amount={balanceAmount}
              depositPercentage={0}
              isBalancePayment
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

      {/* Confirmation d'annulation */}
      <Modal
        visible={cancelConfirmVisible}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setCancelConfirmVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlayDark }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 8 }}>
              Annuler cette réservation ?
            </Text>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 20, marginBottom: 20 }}>
              {proName} sera notifié·e de l'annulation. Selon les conditions d'annulation de la pro, un remboursement partiel ou total de l'acompte peut s'appliquer.
            </Text>
            <Pressable
              style={{ height: 50, borderRadius: 14, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center", opacity: cancelMutation.isPending ? 0.7 : 1, marginBottom: 10 }}
              onPress={() => cancelMutation.mutate(booking.id)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? <ActivityIndicator color={colors.onColor} size="small" />
                : <Text style={{ color: colors.onColor, fontSize: 15, fontWeight: "700" }}>Confirmer l'annulation</Text>}
            </Pressable>
            <Pressable
              style={{ height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
              onPress={() => setCancelConfirmVisible(false)}
              disabled={cancelMutation.isPending}
            >
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>Garder ma réservation</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function useStyles(colors: Record<string, string>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 0, paddingBottom: 12, backgroundColor: colors.background,
    },
    headerBack: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card,
      alignItems: "center", justifyContent: "center",
      shadowColor: colors.black, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },

    scroll: { paddingHorizontal: 16, paddingTop: 8 },

    centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
    loadingText: { fontSize: 14, color: colors.mutedForeground, marginTop: 8 },
    errorText: { fontSize: 15, color: colors.foreground, textAlign: "center", lineHeight: 22 },
    errorBtn: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, minWidth: 160, alignItems: "center" },
    errorBtnText: { color: colors.onColor, fontWeight: "700", fontSize: 14 },
    errorBtnSecondary: { marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 24, minWidth: 160, alignItems: "center" },
    errorBtnSecondaryText: { color: colors.mutedForeground, fontWeight: "600", fontSize: 14 },

    statusBadge: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
    statusBadgeText: { fontSize: 15, fontWeight: "700" },

    card: {
      backgroundColor: colors.card, borderRadius: 20, padding: 18, marginBottom: 16,
      shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },

    proAvatar: {
      width: 64, height: 64, borderRadius: 16,
      backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    proAvatarInitial: { fontSize: 24, fontWeight: "800", color: colors.primary },
    proName: { fontSize: 17, fontWeight: "800", color: colors.foreground, marginBottom: 2 },
    proSub: { fontSize: 13, color: colors.mutedForeground },

    contactBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderWidth: 1, borderColor: `${colors.primary}30`, borderRadius: 12,
      paddingVertical: 13, minHeight: 44, backgroundColor: colors.primaryLight,
    },
    // Taille au contenu plutôt qu'étiré sur toute la largeur (flex:1 de
    // contactBtn n'a de sens que quand ces boutons se partagent une rangée
    // à eux seuls) — utilisé quand ils cohabitent avec d'autres éléments.
    contactBtnSolo: { flex: 0, paddingHorizontal: 16 },
    contactBtnText: { fontSize: 14, fontWeight: "600", color: colors.primary },

    prestationName: { fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 6 },
    prestationDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 19, marginBottom: 14 },

    infoRows: { gap: 12, marginTop: 8 },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    infoIcon: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
    },
    infoLabel: { fontSize: 11, color: colors.mutedForeground, fontWeight: "600", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
    infoValue: { fontSize: 14, fontWeight: "600", color: colors.foreground },

    separator: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
    totalLabel: { fontSize: 15, color: colors.mutedForeground, fontWeight: "600" },
    totalPrice: { fontSize: 28, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },

    paymentBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
    paymentBadgeText: { fontSize: 12, fontWeight: "700" },

    payBtn: {
      marginTop: 14, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 13, alignItems: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
    },
    payBtnText: { color: colors.onColor, fontWeight: "700", fontSize: 15 },

    reviewBtn: {
      backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 15, alignItems: "center", marginBottom: 12,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    reviewBtnText: { color: colors.onColor, fontWeight: "700", fontSize: 16 },

    cancelBookingBtn: {
      backgroundColor: "transparent", borderRadius: 999, borderWidth: 1, borderColor: colors.destructive,
      paddingVertical: 14, alignItems: "center", marginBottom: 12,
    },
    cancelBookingBtnText: { color: colors.destructive, fontWeight: "700", fontSize: 15 },

    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginBottom: 20 },
    modalInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
      marginTop: 20, fontSize: 14, color: colors.foreground, minHeight: 90, textAlignVertical: "top",
    },
    modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 13, alignItems: "center" },
    modalCancelText: { fontSize: 15, fontWeight: "600", color: colors.mutedForeground },
    modalSubmitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 13, alignItems: "center" },
    modalSubmitText: { fontSize: 15, fontWeight: "700", color: colors.onColor },
  });
}
