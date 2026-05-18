import React, { type ReactNode } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { Colors } from "@/constants/colors";

interface Props {
  children: ReactNode;
}

/**
 * Portage exact du composant web <RequireSubscription>.
 *
 * Sources de vérité (par priorité) :
 *   1. RevenueCat entitlements (rcActivePlan)
 *   2. Backend /api/pro/subscription (backendPlan, fallback)
 *   3. user.is_admin → bypass total
 *
 * Comportement :
 *   - En attente d'init RC  → spinner (jamais de flash de paywall)
 *   - is_admin              → children (accès complet)
 *   - activePlan !== null   → children
 *   - activePlan === null   → redirect vers /(pro)/(profile)/subscription
 */
export function RequireSubscription({ children }: Props) {
  const { user, isLoading: authLoading } = useAuth();
  const { activePlan, isReady } = useRevenueCat();
  const router = useRouter();

  // Attendre que l'auth ET RC soient initialisés avant toute décision
  if (authLoading || !isReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF5F8" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  // Admin bypass
  if (user?.is_admin) return <>{children}</>;

  // Pas de plan actif → redirection vers l'écran d'abonnement
  if (!activePlan) {
    // La navigation s'effectue hors du render pour éviter les erreurs React
    setTimeout(() => router.replace("/(pro)/(profile)/subscription"), 0);
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF5F8" }}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.mutedForeground, fontSize: 13 }}>
          Vérification de l'abonnement…
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
