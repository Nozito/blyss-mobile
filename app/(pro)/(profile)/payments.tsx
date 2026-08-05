import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Animated,
  ActivityIndicator,
  AppState,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { proApi, stripeApi } from "@/lib/api";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

// ── Deposit options ───────────────────────────────────────────────────────────
const DEPOSIT_OPTIONS = [
  { value: 0,   label: "0%",    description: "Aucun acompte" },
  { value: 25,  label: "25%",   description: "Acompte partiel" },
  { value: 50,  label: "50%",   description: "Demi-acompte" },
  { value: 100, label: "100%",  description: "Paiement complet" },
] as const;

type DepositValue = 0 | 25 | 50 | 100;

export default function ProPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  const [acceptOnline, setAcceptOnline] = useState(false);
  const [depositPct, setDepositPct] = useState<DepositValue>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isUpdatingDeposit, setIsUpdatingDeposit] = useState(false);
  const [payError, setPayError]   = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  // BLYSS-FIX: 3.3 — unified with pro-profile cache (same /api/users endpoint)
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["pro-profile"],
    queryFn: () => proApi.getProfile(),
  });

  // Stripe Connect account status
  const { data: stripeData, isLoading: stripeLoading, refetch: refetchStripe } = useQuery({
    queryKey: ["pro-stripe-account"],
    queryFn: () => stripeApi.getAccount(),
    staleTime: 30_000,
  });

  const stripeAccount = stripeData?.data;
  const isStripeConnected = stripeAccount?.onboarding_complete ?? false;

  // Refetch Stripe status when app comes back to foreground (after browser onboarding)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refetchStripe();
      }
    });
    return () => sub.remove();
  }, [refetchStripe]);

  // Populate form from fetched settings
  useEffect(() => {
    const d = (settingsData as any)?.data;
    if (d) {
      setAcceptOnline(d.accept_online ?? Boolean(d.accept_online_payment));
    }
  }, [settingsData]);

  // Populate deposit % from Stripe account
  useEffect(() => {
    if (stripeAccount?.deposit_percentage != null) {
      const v = stripeAccount.deposit_percentage as number;
      if (v === 0 || v === 25 || v === 50 || v === 100) {
        setDepositPct(v as DepositValue);
      }
    }
  }, [stripeAccount]);

  const handleStripeOnboard = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsOnboarding(true);
    setPayError(null);
    try {
      const res = await stripeApi.onboard();
      if (res.success && res.data?.url) {
        await Linking.openURL(res.data.url);
      } else {
        setPayError("Impossible de démarrer l'activation Stripe. Réessaie dans un moment.");
      }
    } catch {
      setPayError("Une erreur est survenue. Réessaie dans un moment.");
    } finally {
      setIsOnboarding(false);
    }
  }, []);

  const handleDepositChange = async (value: DepositValue) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDepositPct(value);
    setPayError(null);
    setIsUpdatingDeposit(true);
    try {
      await stripeApi.updateDeposit(value);
      void qc.invalidateQueries({ queryKey: ["pro-stripe-account"] });
    } catch {
      setPayError("Impossible de mettre à jour l'acompte.");
    } finally {
      setIsUpdatingDeposit(false);
    }
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPayError(null);
    setPaySuccess(false);
    if (acceptOnline && !isStripeConnected) {
      setPayError("Active d'abord Stripe Connect pour accepter les paiements en ligne.");
      return;
    }
    setIsSaving(true);
    try {
      await proApi.updatePaymentSettings({ accept_online: acceptOnline });
      void qc.invalidateQueries({ queryKey: ["pro-profile"] }); // BLYSS-FIX: 3.3
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPaySuccess(true);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPayError("Impossible de mettre à jour les paramètres.");
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = settingsLoading || stripeLoading;

  useEffect(() => {
    if (isLoading || reduceMotion) return;
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [isLoading, reduceMotion, contentOpacity]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
            Encaissements
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginLeft: 52 }}>
          Stripe Connect · Paiements en ligne
        </Text>
      </View>

      {/* ── Stripe Connect status ── */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{
          fontSize: 11, fontWeight: "700", color: Colors.mutedForeground,
          textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
        }}>
          Compte Stripe Connect
        </Text>
        <View style={{
          backgroundColor: Colors.card, borderRadius: 20, padding: 18,
          borderWidth: 1,
          borderColor: isStripeConnected ? `${Colors.success}40` : `${Colors.warning}40`,
          shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: isStripeConnected ? `${Colors.success}15` : `${Colors.warning}15`,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons
                name={isStripeConnected ? "checkmark-circle" : "alert-circle-outline"}
                size={26}
                color={isStripeConnected ? Colors.success : Colors.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.foreground, marginBottom: 3 }}>
                {isStripeConnected ? "Compte activé" : "Activation requise"}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, lineHeight: 17 }}>
                {isStripeConnected
                  ? `Virements activés${stripeAccount?.charges_enabled ? " · Paiements OK" : ""}`
                  : "Complète l'onboarding Stripe pour encaisser en ligne"}
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
              backgroundColor: isStripeConnected ? Colors.successLight : "#FFFBEB",
              borderWidth: 1,
              borderColor: isStripeConnected ? Colors.successBorder : "#FDE68A",
            }}>
              <Text style={{
                fontSize: 11, fontWeight: "700",
                color: isStripeConnected ? Colors.successTextDark : "#92400E",
              }}>
                {isStripeConnected ? "Actif" : "Inactif"}
              </Text>
            </View>
          </View>

          {!isStripeConnected && (
            <AnimatedPressable
              onPress={handleStripeOnboard}
              disabled={isOnboarding}
              style={{
                marginTop: 16, height: 48, borderRadius: 14,
                backgroundColor: Colors.primary,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: isOnboarding ? 0.7 : 1,
              }}
            >
              {isOnboarding ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="open-outline" size={16} color={Colors.white} />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>
                    Activer Stripe Connect
                  </Text>
                </>
              )}
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* ── Acompte (visible uniquement si Stripe actif) ── */}
      {isStripeConnected && (
        <View style={{ marginBottom: 16 }}>
          <Text style={{
            fontSize: 11, fontWeight: "700", color: Colors.mutedForeground,
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
          }}>
            Acompte à la réservation
          </Text>
          <View style={{
            backgroundColor: Colors.card, borderRadius: 20, padding: 18,
            borderWidth: 1, borderColor: Colors.border,
            shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
          }}>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 14, lineHeight: 18 }}>
              Pourcentage du prix encaissé à la réservation. Le solde est réglé le jour du rendez-vous.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {DEPOSIT_OPTIONS.map(({ value, label }) => {
                const selected = depositPct === value;
                return (
                  <AnimatedPressable
                    key={value}
                    onPress={() => void handleDepositChange(value)}
                    disabled={isUpdatingDeposit}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: "center",
                      backgroundColor: selected ? Colors.primary : Colors.muted,
                      borderWidth: selected ? 0 : 1, borderColor: Colors.border,
                      opacity: isUpdatingDeposit ? 0.6 : 1,
                    }}
                  >
                    <Text style={{
                      fontSize: 15, fontWeight: "800",
                      color: selected ? Colors.white : Colors.foreground,
                    }}>
                      {label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            {isUpdatingDeposit && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Mise à jour…</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Paiements en ligne ── */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{
          fontSize: 11, fontWeight: "700", color: Colors.mutedForeground,
          textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
        }}>
          Paiements en ligne
        </Text>
        <View style={{
          backgroundColor: Colors.card, borderRadius: 20, padding: 18,
          borderWidth: 1, borderColor: Colors.border,
          shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
          opacity: isStripeConnected ? 1 : 0.6,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 4 }}>
                Accepter les paiements en ligne
              </Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, lineHeight: 17 }}>
                {isStripeConnected
                  ? "Tes clientes paient à la réservation. Zéro impayé."
                  : "Active Stripe Connect d'abord pour activer cette option."}
              </Text>
            </View>
            <Switch
              value={acceptOnline && isStripeConnected}
              onValueChange={(v) => {
                if (!isStripeConnected) {
                  setPayError("Active d'abord Stripe Connect.");
                  return;
                }
                setAcceptOnline(v);
              }}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              disabled={!isStripeConnected}
            />
          </View>

          {acceptOnline && isStripeConnected && (
            <View style={{
              marginTop: 14, padding: 12, borderRadius: 12,
              backgroundColor: `${Colors.success}10`,
              borderWidth: 1, borderColor: `${Colors.success}25`,
              flexDirection: "row", alignItems: "center", gap: 8,
            }}>
              <Ionicons name="checkmark-circle-outline" size={15} color={Colors.success} />
              <Text style={{ fontSize: 12, color: Colors.success, flex: 1, fontWeight: "600" }}>
                Activé · Frais Stripe : 1,5% + 0,25€ par transaction
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Info cards ── */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
        {[
          { icon: "shield-checkmark-outline" as const, label: "Stripe", sub: "Sécurisé PCI", color: Colors.primary },
          { icon: "time-outline" as const,             label: "Virement", sub: "J+2 ouvré",   color: Colors.success },
          { icon: "close-circle-outline" as const,     label: "0 impayé", sub: "Garanti",     color: Colors.success },
        ].map(({ icon, label, sub, color }) => (
          <View key={label} style={{
            flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 12,
            borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 4,
          }}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>{label}</Text>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, textAlign: "center" }}>{sub}</Text>
          </View>
        ))}
      </View>

      {payError && <View style={{ marginBottom: 12 }}><ErrorMessage message={payError} /></View>}
      {paySuccess && (
        <View style={{ marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: `${Colors.success}12`, borderWidth: 1, borderColor: `${Colors.success}30` }}>
          <Text style={{ fontSize: 13, color: Colors.success, fontWeight: "600", textAlign: "center" }}>Paramètres de paiement mis à jour ✓</Text>
        </View>
      )}

      {/* ── Save ── */}
      <AnimatedPressable
        onPress={handleSave}
        disabled={isSaving}
        style={{
          height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center",
          backgroundColor: Colors.primary, opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.white }}>Enregistrer</Text>
        )}
      </AnimatedPressable>
    </ScrollView>
    </Animated.View>
  );
}
