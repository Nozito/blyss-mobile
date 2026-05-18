import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";

/**
 * Hook qui redirige vers l'écran d'abonnement si le plan n'est pas actif.
 * À utiliser dans les screens individuels si besoin d'un double-check.
 * Le guard principal est dans (pro)/_layout.tsx.
 */
export function useRequireSubscription() {
  const { user } = useAuth();
  const { activePlan, isReady } = useRevenueCat();
  const router = useRouter();

  useEffect(() => {
    if (!isReady || !user) return;
    if (user.is_admin) return;
    if (!activePlan) {
      router.replace("/(pro)/(profile)/subscription");
    }
  }, [isReady, user, activePlan]);

  return {
    hasActiveSub: user?.is_admin || Boolean(activePlan),
    activePlan,
  };
}
