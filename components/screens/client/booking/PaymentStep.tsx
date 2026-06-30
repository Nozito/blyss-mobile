import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useStripe } from "@stripe/stripe-react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { Colors } from "@/constants/colors";

interface Props {
  amount: number;
  depositPercentage: number;
  prestationName?: string;
  /** Null until backend createPaymentIntent is wired up */
  clientSecret: string | null;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function PaymentStep({
  amount,
  depositPercentage,
  prestationName,
  clientSecret,
  onSuccess,
  onError,
}: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const initSheet = async (secret: string) => {
    setInitializing(true);
    setInitError(null);
    const { error } = await initPaymentSheet({
      paymentIntentClientSecret: secret,
      merchantDisplayName: "Blyss",
      style: "automatic",
      appearance: {
        colors: {
          primary: Colors.primary,
          background: Colors.white,
          componentBackground: Colors.cream,
          componentBorder: Colors.border,
          componentDivider: Colors.border,
          primaryText: Colors.foreground,
          secondaryText: Colors.mutedForeground,
          componentText: Colors.foreground,
          placeholderText: Colors.mutedForeground,
          icon: Colors.mutedForeground,
          error: Colors.destructive,
        },
      },
    });
    if (error) {
      setInitError(error.message);
      onError(error.message);
    } else {
      setReady(true);
    }
    setInitializing(false);
  };

  // Init payment sheet as soon as clientSecret is available
  useEffect(() => {
    if (!clientSecret) return;
    let cancelled = false;
    void (async () => {
      if (!cancelled) await initSheet(clientSecret);
    })();
    return () => { cancelled = true; };
  }, [clientSecret]);

  const handlePay = async () => {
    if (!ready) return;
    setPaying(true);
    const { error } = await presentPaymentSheet();
    setPaying(false);

    if (!error) {
      onSuccess();
      return;
    }
    if (error.code === "Canceled") return; // user dismissed, no alert needed
    onError(error.message);
  };

  return (
    <View style={{ gap: 20 }}>
      {/* Header */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
          Paiement sécurisé
        </Text>
        <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
          {depositPercentage < 100
            ? `Acompte de ${depositPercentage}% à payer maintenant`
            : "Termine le paiement pour confirmer"}
        </Text>
      </View>

      {/* Amount summary */}
      <View
        style={{
          backgroundColor: Colors.white,
          borderRadius: 20,
          padding: 20,
          gap: 12,
          ...Shadows.card,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Total à payer</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: Colors.foreground }}>
            {Number(amount).toFixed(2)}€
          </Text>
        </View>
        {prestationName && (
          <>
            <View style={{ height: 1, backgroundColor: Colors.border }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Prestation</Text>
              <Text style={{ fontSize: 13, fontWeight: "500", color: Colors.foreground, flexShrink: 1 }} numberOfLines={1}>
                {prestationName}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Payment sheet area */}
      {initializing ? (
        <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 32, alignItems: "center", gap: 12, ...Shadows.card }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Initialisation du paiement…</Text>
        </View>
      ) : initError ? (
        /* Init failed — show retry */
        <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 24, alignItems: "center", gap: 16, ...Shadows.card }}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.destructive} />
          <Text style={{ fontSize: 14, color: Colors.foreground, textAlign: "center", lineHeight: 20 }}>
            Impossible d'initialiser le paiement.
          </Text>
          <Pressable
            onPress={() => clientSecret && void initSheet(clientSecret)}
            style={{
              backgroundColor: Colors.primary, borderRadius: 999,
              paddingVertical: 12, paddingHorizontal: 28,
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 14 }}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        /* Pay button — opens Stripe Payment Sheet */
        <Pressable
          onPress={handlePay}
          disabled={!ready || paying}
          style={{ opacity: !ready || paying ? 0.6 : 1 }}
        >
          <LinearGradient
            colors={[Colors.primary, "rgba(254,93,157,0.9)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {paying ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="card-outline" size={18} color={Colors.white} />
                <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 15 }}>
                  Payer {Number(amount).toFixed(2)}€
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>
      )}

      {/* Security note */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Ionicons name="shield-checkmark-outline" size={14} color={Colors.mutedForeground} />
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Paiement sécurisé par Stripe</Text>
      </View>
    </View>
  );
}
