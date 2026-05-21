import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useStripe } from "@stripe/stripe-react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";

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

  // Init payment sheet as soon as clientSecret is available
  useEffect(() => {
    if (!clientSecret) return;
    let cancelled = false;

    (async () => {
      setInitializing(true);
      const { error } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Blyss",
        style: "automatic",
        appearance: {
          colors: {
            primary: "#FE5D9D",
            background: "#FFFFFF",
            componentBackground: "#F8F5F1",
            componentBorder: "#EBE6E0",
            componentDivider: "#EBE6E0",
            primaryText: "#09090B",
            secondaryText: "#6D6D78",
            componentText: "#09090B",
            placeholderText: "#6D6D78",
            icon: "#6D6D78",
            error: "#EF4444",
          },
        },
      });
      if (cancelled) return;
      if (error) {
        onError(error.message);
      } else {
        setReady(true);
      }
      setInitializing(false);
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
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 }}>
          Paiement sécurisé
        </Text>
        <Text style={{ fontSize: 14, color: "#6D6D78" }}>
          {depositPercentage < 100
            ? `Acompte de ${depositPercentage}% à payer maintenant`
            : "Termine le paiement pour confirmer"}
        </Text>
      </View>

      {/* Amount summary */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: 20,
          gap: 12,
          ...Shadows.card,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, color: "#6D6D78" }}>Total à payer</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#09090B" }}>
            {Number(amount).toFixed(2)}€
          </Text>
        </View>
        {prestationName && (
          <>
            <View style={{ height: 1, backgroundColor: "#EBE6E0" }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <Text style={{ fontSize: 13, color: "#6D6D78" }}>Prestation</Text>
              <Text style={{ fontSize: 13, fontWeight: "500", color: "#09090B", flexShrink: 1 }} numberOfLines={1}>
                {prestationName}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Payment sheet area */}
      {clientSecret === null || initializing ? (
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 32, alignItems: "center", gap: 12, ...Shadows.card }}>
          <ActivityIndicator size="large" color="#FE5D9D" />
          <Text style={{ fontSize: 13, color: "#6D6D78" }}>Initialisation du paiement…</Text>
        </View>
      ) : (

        /* Pay button — opens Stripe Payment Sheet */
        <Pressable
          onPress={handlePay}
          disabled={!ready || paying}
          style={{ opacity: !ready || paying ? 0.6 : 1 }}
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
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  Payer {Number(amount).toFixed(2)}€
                </Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>
      )}

      {/* Security note */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#6D6D78" />
        <Text style={{ fontSize: 11, color: "#6D6D78" }}>Paiement sécurisé par Stripe</Text>
      </View>
    </View>
  );
}
