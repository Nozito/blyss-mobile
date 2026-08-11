import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { stripePaymentsApi, specialistsApi, messagesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  ServiceSelector,
  type Prestation,
  type ConditionItem,
} from "@/components/screens/client/booking/ServiceSelector";
import { DateTimeSelector, type Slot } from "@/components/screens/client/booking/DateTimeSelector";
import { BookingSummary } from "@/components/screens/client/booking/BookingSummary";
import { PaymentStep } from "@/components/screens/client/booking/PaymentStep";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useThemeColors } from "@/hooks/useThemeColors";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAppTransition } from "@/contexts/TransitionContext";
import { toLocalDateStr, calculateEndDateTime, canPayOnline as computeCanPayOnline, resolvePaymentType } from "@/lib/bookingUtils";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface Pro {
  id: number;
  first_name: string;
  last_name: string;
  activity_name: string | null;
  city: string | null;
  profile_photo: string | null;
  accept_online_payment: boolean;
  stripe_onboarding_complete: boolean;
  acceptance_conditions: ConditionItem[] | null;
}

const TOTAL_STEPS = 5;

// ── StepIndicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const anims = useRef(
    Array.from({ length: total }, (_, i) => new Animated.Value(i < current ? 1 : 0))
  ).current;

  useEffect(() => {
    const animations = anims.map((val, i) =>
      Animated.timing(val, {
        toValue: i < current ? 1 : 0,
        duration: reduceMotion ? 0 : 260,
        useNativeDriver: false,
      })
    );
    Animated.stagger(reduceMotion ? 0 : 40, animations).start();
  }, [current, anims, reduceMotion]);

  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {anims.map((val, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 99,
            backgroundColor: colors.border,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              height: "100%",
              borderRadius: 99,
              backgroundColor: colors.primary,
              width: val.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            }}
          />
        </View>
      ))}
    </View>
  );
}

// ── SuccessCheckmark ─────────────────────────────────────────────────────────
function SuccessCheckmark() {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.4)).current;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 8,
        transform: [{ scale }],
        opacity,
      }}
    >
      <Ionicons name="checkmark" size={48} color={colors.white} />
    </Animated.View>
  );
}

export default function BookingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { proId } = useLocalSearchParams<{ proId: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showTransition, hideTransition } = useAppTransition();

  const [step, setStep] = useState(1);
  const navigation = useNavigation();

  // Désactive le swipe-back natif iOS pendant le paiement (étape 4) : une
  // réservation existe déjà côté serveur à ce stade (non payée) — un swipe
  // hors du bouton retour dédié laisserait la cliente quitter l'écran sans
  // savoir qu'une réservation en attente traîne quelque part.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: step < 4 });
  }, [step, navigation]);

  const [isLoading, setIsLoading] = useState(true);
  const [pro, setPro] = useState<Pro | null>(null);
  const [prestations, setPrestations] = useState<Prestation[]>([]);

  const [selectedPrestation, setSelectedPrestation] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_site" | null>(null);
  const [contactingPro, setContactingPro] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositPercentage, setDepositPercentage] = useState(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // Réservation déjà créée côté serveur mais dont le paiement a échoué —
  // évite d'en recréer une seconde (et donc un doublon) si la cliente retape "Continuer".
  const [pendingReservationId, setPendingReservationId] = useState<number | null>(null);

  // Si la cliente change de prestation/date/heure après un échec de paiement,
  // la réservation en attente ne correspond plus à sa sélection actuelle —
  // sans ce reset, "Continuer" facturait/confirmait l'ancienne combinaison
  // (prestation/date d'origine) tout en affichant la nouvelle à l'écran.
  useEffect(() => {
    if (pendingReservationId == null) return;
    setPendingReservationId(null);
    setClientSecret(null);
  }, [selectedPrestation, selectedDate, selectedTime]);

  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [isLoadingDates, setIsLoadingDates] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading || !isAuthenticated) return;
      if (!proId) {
        // Lien/deep link cassé (proId manquant) — sans ce guard, isLoading
        // restait bloqué à `true` indéfiniment (spinner "Chargement..." sans
        // issue, obligeant à force-quitter l'app).
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [proRes, prestRes] = await Promise.all([
          specialistsApi.getProById(Number(proId)),
          specialistsApi.getServices(Number(proId)),
        ]);

        if (!proRes.success || !proRes.data) {
          router.replace("/(client)");
          return;
        }

        const proResult = proRes.data as Record<string, unknown>;
        if (proResult.acceptance_conditions && typeof proResult.acceptance_conditions === "string") {
          proResult.acceptance_conditions = JSON.parse(proResult.acceptance_conditions as string);
        }
        setPro({
          id: Number(proResult.id),
          first_name: String(proResult.first_name ?? ""),
          last_name: String(proResult.last_name ?? ""),
          activity_name: (proResult.activity_name as string | null) ?? null,
          city: (proResult.city as string | null) ?? null,
          profile_photo: (proResult.profile_photo as string | null) ?? null,
          accept_online_payment: Boolean(proResult.accept_online_payment),
          stripe_onboarding_complete: Boolean(proResult.stripe_onboarding_complete),
          acceptance_conditions: (proResult.acceptance_conditions as ConditionItem[] | null) ?? null,
        });

        if (prestRes.success && prestRes.data) {
          setPrestations(
            (prestRes.data as Array<Record<string, unknown>>)
              .filter((p) => p.active)
              .map((p) => ({
                id: p.id as number,
                name: p.name as string,
                description: (p.description as string | null) ?? null,
                price: Number(p.price),
                duration_minutes: Number(p.duration_minutes),
              }))
          );
        }
      } catch {
        setBookingError("Impossible de charger les informations. Vérifie ta connexion internet.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [proId, authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchDates = async () => {
      if (!proId || step !== 2) return;
      setIsLoadingDates(true);
      try {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
        const res = await fetch(`${API_URL}/api/slots/available-dates/${proId}/${year}-${month}`);
        const data = await res.json();
        if (data.success && data.data) {
          setAvailableDates(new Set<string>(Array.isArray(data.data) ? data.data.map(String) : []));
        } else {
          setAvailableDates(new Set());
        }
      } catch {
        setAvailableDates(new Set());
      } finally {
        setIsLoadingDates(false);
      }
    };
    void fetchDates();
  }, [proId, currentMonth, step]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDate || !proId) return;
      setIsLoadingSlots(true);
      try {
        const res = await fetch(
          `${API_URL}/api/slots/available/${proId}/${toLocalDateStr(selectedDate)}`
        );
        const data = await res.json();
        setAvailableSlots(data.success && data.data ? data.data : []);
      } catch {
        setAvailableSlots([]);
      } finally {
        setIsLoadingSlots(false);
      }
    };
    void fetchSlots();
  }, [selectedDate, proId]);

  useEffect(() => {
    if (step !== 2 || !selectedDate || !proId) return;
    const refresh = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/slots/available/${proId}/${toLocalDateStr(selectedDate)}`
        );
        const data = await res.json();
        if (data.success && data.data) setAvailableSlots(data.data);
      } catch {}
    };
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [step, selectedDate, proId]);

  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate]);

  const selectedPrestationData = useMemo(
    () => prestations.find((p) => p.id === selectedPrestation),
    [selectedPrestation, prestations]
  );

  const canPayOnline = computeCanPayOnline(
    Boolean(pro?.stripe_onboarding_complete),
    Boolean(pro?.accept_online_payment)
  );

  useEffect(() => {
    if (pro && !canPayOnline && paymentMethod === null) {
      setPaymentMethod("on_site");
    }
  }, [pro, canPayOnline]);

  const isStepValid = () => {
    if (step === 1) return selectedPrestation !== null;
    if (step === 2) return selectedDate !== null && selectedTime !== null;
    if (step === 3) return paymentMethod !== null;
    return true;
  };

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step === 1) safeBack(router);
    else if (step === 5 && paymentMethod === "on_site") setStep(3);
    else setStep((s) => s - 1);
  }, [step, paymentMethod, router]);

  const handleConfirmBooking = async () => {
    if (!selectedPrestation || !selectedDate || !selectedTime || !proId || !selectedPrestationData) {
      setBookingError("Veuillez remplir tous les champs.");
      return;
    }
    setBookingError(null);
    setIsSubmitting(true);
    try {
      let reservationId = pendingReservationId;
      let depositPct = depositPercentage;

      if (reservationId == null) {
        const selectedSlot = availableSlots.find((s) => s.time === selectedTime);
        const [h, m] = selectedTime.split(":").map(Number);
        const startDT = new Date(selectedDate);
        startDT.setHours(h, m, 0, 0);

        const resaResult = await stripePaymentsApi.createReservation({
          pro_id: Number(proId),
          prestation_id: selectedPrestation,
          start_datetime: startDT.toISOString(),
          end_datetime: calculateEndDateTime(
            selectedDate,
            selectedTime,
            selectedPrestationData.duration_minutes
          ).toISOString(),
          price: selectedPrestationData.price,
          slot_id: selectedSlot?.id,
          payment_method: paymentMethod ?? "on_site",
        });

        if (!resaResult.success || !resaResult.data) {
          throw new Error((resaResult as { error?: string }).error || "Erreur lors de la réservation");
        }

        const resaData = resaResult.data as {
          id: number;
          deposit_percentage: number;
          deposit_amount: number;
        };
        reservationId = resaData.id;
        depositPct = resaData.deposit_percentage;
        setPendingReservationId(resaData.id);
        setDepositPercentage(resaData.deposit_percentage);
        setDepositAmount(resaData.deposit_amount);
      }

      if (paymentMethod === "on_site") {
        setStep(5);
        return;
      }

      const paymentType = resolvePaymentType(depositPct);
      const intentResult = await stripePaymentsApi.createPaymentIntent({
        reservation_id: reservationId,
        type: paymentType,
      });

      if (!intentResult.success || !intentResult.data) {
        throw new Error(intentResult.error ?? "Erreur lors de la création du paiement");
      }

      setClientSecret(intentResult.data.client_secret);
      setDepositAmount(intentResult.data.amount);
      setStep(4);
    } catch (error: unknown) {
      setBookingError(error instanceof Error ? error.message : "Erreur lors de la réservation. Vérifie ta connexion internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (step === 3) {
      void handleConfirmBooking();
      return;
    }
    setStep((s) => s + 1);
  };

  if (authLoading || isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) return null;

  if (!pro || prestations.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, textAlign: "center" }}>
            Aucune prestation disponible
          </Text>
          <Pressable
            onPress={() => router.replace("/(client)")}
            style={{
              paddingHorizontal: 24,
              height: 48,
              borderRadius: 16,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.white, fontWeight: "600" }}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const proName = pro.activity_name || `${pro.first_name} ${pro.last_name}`;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <ServiceSelector
            prestations={prestations}
            selectedId={selectedPrestation}
            onSelect={(id) => {
              setSelectedPrestation(id);
              setTimeout(() => setStep(2), 120);
            }}
            proName={proName}
            proCity={pro.city}
            conditions={pro.acceptance_conditions}
          />
        );
      case 2:
        return (
          <DateTimeSelector
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            selectedTime={selectedTime}
            onSelectTime={(t) => {
              setSelectedTime(t);
              setTimeout(() => setStep(3), 120);
            }}
            availableDates={availableDates}
            isLoadingDates={isLoadingDates}
            availableSlots={availableSlots}
            isLoadingSlots={isLoadingSlots}
            onMonthChange={setCurrentMonth}
          />
        );
      case 3:
        return selectedDate && selectedTime && selectedPrestationData ? (
          <BookingSummary
            prestationName={selectedPrestationData.name}
            prestationPrice={selectedPrestationData.price}
            prestationDuration={selectedPrestationData.duration_minutes}
            proName={proName}
            proCity={pro.city}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            paymentMethod={paymentMethod}
            onSelectPayment={setPaymentMethod}
            canPayOnline={canPayOnline}
            contactingPro={contactingPro}
            onContactPro={async () => {
              if (contactingPro || !proId) return;
              setContactingPro(true);
              const res = await messagesApi.openThread(Number(proId));
              setContactingPro(false);
              if (res.success && res.data) {
                router.push({ pathname: "/message-thread/[id]", params: { id: String(res.data.id) } });
              }
            }}
          />
        ) : null;
      case 4:
        return (
          <PaymentStep
            amount={depositAmount ?? selectedPrestationData?.price ?? 0}
            depositPercentage={depositPercentage}
            prestationName={selectedPrestationData?.name}
            clientSecret={clientSecret}
            onSuccess={() => {
              const formattedDate = selectedDate?.toLocaleDateString("fr-FR", {
                weekday: "short", day: "numeric", month: "long",
              });
              showTransition();
              router.replace({
                pathname: "/booking/confirmation",
                params: {
                  specialistName: proName,
                  serviceName: selectedPrestationData?.name ?? "",
                  date: formattedDate ?? "",
                  time: selectedTime ?? "",
                  amount: depositAmount != null ? String(Number(depositAmount).toFixed(2).replace(".", ",")) : "",
                  dateISO: selectedDate ? toLocalDateStr(selectedDate) : "",
                  durationMinutes: selectedPrestationData?.duration_minutes != null
                    ? String(selectedPrestationData.duration_minutes)
                    : "",
                  proCity: pro.city ?? "",
                  proId: String(proId),
                },
              } as Parameters<typeof router.replace>[0]);
              hideTransition();
            }}
            onError={(msg) => {
              const readable = msg.toLowerCase().includes("declined") || msg.toLowerCase().includes("refusé")
                ? "Ta carte a été refusée. Vérifie tes informations."
                : msg.toLowerCase().includes("network") || msg.toLowerCase().includes("réseau")
                ? "Erreur de connexion. Votre carte n'a pas été débitée."
                : "Le paiement a échoué. Réessayez ou changez de moyen de paiement.";
              setBookingError(readable);
            }}
          />
        );
      case 5:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 24 }}>
              <SuccessCheckmark />

              <View style={{ alignItems: "center", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
                    Réservation confirmée
                  </Text>
                  <Ionicons name="sparkles" size={22} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", maxWidth: 280, lineHeight: 20 }}>
                  Tu recevras une confirmation et un rappel avant ton rendez‑vous
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  padding: 20,
                  gap: 12,
                  width: "100%",
                  shadowColor: colors.black,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                {[
                  { label: "Spécialiste", value: proName },
                  { label: "Prestation", value: selectedPrestationData?.name },
                  {
                    label: "Date",
                    value: selectedDate?.toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    }),
                  },
                  { label: "Horaire", value: selectedTime ?? undefined },
                  {
                    label: "Paiement",
                    value:
                      paymentMethod === "on_site"
                        ? "Sur place"
                        : depositPercentage < 100
                        ? `Acompte payé (${Number(depositAmount ?? 0).toFixed(2)}€)`
                        : "Payé en ligne",
                  },
                ].map((row, i, arr) => (
                  <React.Fragment key={row.label}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{row.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: colors.foreground }}>
                        {row.value}
                      </Text>
                    </View>
                    {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: colors.border }} />}
                  </React.Fragment>
                ))}
              </View>

              <Pressable
                onPress={() => router.replace("/(client)/bookings")}
                style={{ width: "100%" }}
              >
                <LinearGradient
                  colors={[colors.primary, `${colors.primary}E6`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 56,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text style={{ color: colors.white, fontWeight: "700", fontSize: 15 }}>
                    Voir mes réservations
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  if (!authLoading && !isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {step < 5 && (
          <View style={{ paddingTop: 0, paddingBottom: 16 }}>
            <AnimatedIconButton
              onPress={handleBack}
              accessibilityLabel="Retour"
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </AnimatedIconButton>

            <StepIndicator current={step} total={TOTAL_STEPS} />
          </View>
        )}

        <View style={{ flex: 1 }}>{renderStep()}</View>

        {bookingError && (
          <View style={{ paddingBottom: 8 }}>
            <ErrorMessage message={bookingError} />
          </View>
        )}

        {step === 3 && (
          <View style={{ paddingVertical: 16 }}>
            <AnimatedPressable
              onPress={handleNext}
              disabled={!isStepValid() || isSubmitting}
              style={{ opacity: !isStepValid() || isSubmitting ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={[colors.primary, `${colors.primary}E6`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 56,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons
                      name={paymentMethod === "on_site" ? "checkmark-circle-outline" : "arrow-forward"}
                      size={18}
                      color={colors.white}
                    />
                    <Text style={{ color: colors.white, fontWeight: "700", fontSize: 15 }}>
                      {paymentMethod === "on_site" ? "Confirmer" : "Continuer"}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </AnimatedPressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
