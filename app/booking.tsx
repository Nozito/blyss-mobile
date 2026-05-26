import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { stripePaymentsApi, specialistsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  ServiceSelector,
  type Prestation,
  type ConditionItem,
} from "@/components/screens/client/booking/ServiceSelector";
import { DateTimeSelector, type Slot } from "@/components/screens/client/booking/DateTimeSelector";
import { BookingSummary } from "@/components/screens/client/booking/BookingSummary";
import { PaymentStep } from "@/components/screens/client/booking/PaymentStep";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

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

const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const calculateEndDateTime = (
  startDate: Date,
  startTime: string,
  durationMinutes: number
): Date => {
  const [hours, minutes] = startTime.split(":").map(Number);
  const start = new Date(startDate);
  start.setHours(hours, minutes, 0, 0);
  return new Date(start.getTime() + durationMinutes * 60_000);
};

const TOTAL_STEPS = 5;

export default function BookingScreen() {
  const router = useRouter();
  const { proId } = useLocalSearchParams<{ proId: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Step state
  const [step, setStep] = useState(1);

  // Data
  const [isLoading, setIsLoading] = useState(true);
  const [pro, setPro] = useState<Pro | null>(null);
  const [prestations, setPrestations] = useState<Prestation[]>([]);

  // Selections
  const [selectedPrestation, setSelectedPrestation] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_site" | null>(null);

  // Booking result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [depositPercentage, setDepositPercentage] = useState(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Slots
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch pro + prestations
  useEffect(() => {
    const fetchData = async () => {
      if (!proId || authLoading || !isAuthenticated) return;
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
        Alert.alert("Erreur", "Impossible de charger les informations. Veuillez réessayer.");
        router.replace("/(client)");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [proId, authLoading, isAuthenticated, router]);

  // Fetch available dates for current month (step 2)
  useEffect(() => {
    const fetchDates = async () => {
      if (!proId || step !== 2) return;
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
      }
    };
    void fetchDates();
  }, [proId, currentMonth, step]);

  // Fetch slots when date selected
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

  // Real-time slot refresh every 30s on step 2
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

  // Clear time when date changes
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedDate]);

  const selectedPrestationData = useMemo(
    () => prestations.find((p) => p.id === selectedPrestation),
    [selectedPrestation, prestations]
  );

  const canPayOnline = Boolean(pro?.stripe_onboarding_complete && pro?.accept_online_payment);

  // Auto-select on_site when online payment is unavailable
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
    if (step === 1) router.back();
    else if (step === 5 && paymentMethod === "on_site") setStep(3);
    else setStep((s) => s - 1);
  }, [step, paymentMethod, router]);

  const handleConfirmBooking = async () => {
    if (!selectedPrestation || !selectedDate || !selectedTime || !proId || !selectedPrestationData) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }
    setIsSubmitting(true);
    try {
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
        throw new Error((resaResult as { message?: string }).message || "Erreur lors de la réservation");
      }

      const resaData = resaResult.data as {
        id: number;
        deposit_percentage: number;
        deposit_amount: number;
      };
      setDepositPercentage(resaData.deposit_percentage);
      setDepositAmount(resaData.deposit_amount);

      if (paymentMethod === "on_site") {
        setStep(5);
        return;
      }

      // Create Stripe PaymentIntent for online payment
      const paymentType = resaData.deposit_percentage === 100 ? "full" : "deposit";
      const intentResult = await stripePaymentsApi.createPaymentIntent({
        reservation_id: resaData.id,
        type: paymentType,
      });

      if (!intentResult.success || !intentResult.data) {
        throw new Error(intentResult.error ?? "Erreur lors de la création du paiement");
      }

      setClientSecret(intentResult.data.client_secret);
      setDepositAmount(intentResult.data.amount);
      setStep(4);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erreur lors de la réservation.";
      Alert.alert("Erreur", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === 3) {
      void handleConfirmBooking();
      return;
    }
    setStep((s) => s + 1);
  };

  if (authLoading || isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color="#FE5D9D" />
          <Text style={{ fontSize: 13, color: "#6D6D78" }}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) return null;

  if (!pro || prestations.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#09090B", textAlign: "center" }}>
            Aucune prestation disponible
          </Text>
          <Pressable
            onPress={() => router.replace("/(client)")}
            style={{
              paddingHorizontal: 24,
              height: 48,
              borderRadius: 16,
              backgroundColor: "#FE5D9D",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Retour</Text>
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
          />
        ) : null;
      case 4:
        return (
          <PaymentStep
            amount={depositAmount ?? selectedPrestationData?.price ?? 0}
            depositPercentage={depositPercentage}
            prestationName={selectedPrestationData?.name}
            clientSecret={clientSecret}
            onSuccess={() => setStep(5)}
            onError={(msg) => Alert.alert("Erreur de paiement", msg)}
          />
        );
      case 5:
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 24 }}>
              {/* Success icon */}
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: "#FE5D9D",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#FE5D9D",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 20,
                  elevation: 8,
                }}
              >
                <Ionicons name="checkmark" size={48} color="#fff" />
              </View>

              <View style={{ alignItems: "center", gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: "#09090B" }}>
                    Réservation confirmée
                  </Text>
                  <Ionicons name="sparkles" size={22} color="#FE5D9D" />
                </View>
                <Text style={{ fontSize: 14, color: "#6D6D78", textAlign: "center", maxWidth: 280, lineHeight: 20 }}>
                  Tu recevras une confirmation et un rappel avant ton rendez‑vous
                </Text>
              </View>

              {/* Summary */}
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  padding: 20,
                  gap: 12,
                  width: "100%",
                  shadowColor: "#000",
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
                      <Text style={{ fontSize: 13, color: "#6D6D78" }}>{row.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: "500", color: "#09090B" }}>
                        {row.value}
                      </Text>
                    </View>
                    {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: "#EBE6E0" }} />}
                  </React.Fragment>
                ))}
              </View>

              {/* CTA */}
              <Pressable
                onPress={() => router.replace("/my-bookings")}
                style={{ width: "100%" }}
              >
                <LinearGradient
                  colors={["#FE5D9D", "rgba(254,93,157,0.9)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 56,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#FE5D9D",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* Header hidden on step 4 (reservation already created) and step 5 */}
        {step < 4 && (
          <View style={{ paddingTop: 12, paddingBottom: 16 }}>
            <AnimatedIconButton
              onPress={handleBack}
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#EBE6E0",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#09090B" />
            </AnimatedIconButton>

            {/* Progress bar */}
            <View style={{ height: 6, backgroundColor: "#EBE6E0", borderRadius: 3, overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: "#FE5D9D",
                  width: `${(step / TOTAL_STEPS) * 100}%`,
                }}
              />
            </View>
          </View>
        )}

        {/* Step content */}
        <View style={{ flex: 1 }}>{renderStep()}</View>

        {/* CTA — only on step 3 */}
        {step === 3 && (
          <View style={{ paddingVertical: 16 }}>
            <Pressable
              onPress={handleNext}
              disabled={!isStepValid() || isSubmitting}
              style={{ opacity: !isStepValid() || isSubmitting ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={["#FE5D9D", "rgba(254,93,157,0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 56,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#FE5D9D",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons
                      name={paymentMethod === "on_site" ? "checkmark-circle-outline" : "arrow-forward"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                      {paymentMethod === "on_site" ? "Confirmer" : "Continuer"}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
