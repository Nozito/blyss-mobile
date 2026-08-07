import { useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { useRevenueCat } from "@/contexts/RevenueCatContext";

/**
 * Returns whether the current pro user has an active subscription
 * and a function to open the paywall.
 *
 * Source of truth: RevenueCat customerInfo (not backend user object).
 */
export function usePro() {
  const router = useRouter();
  const { activePlan, refreshCustomerInfo } = useRevenueCat();

  const isPro = activePlan !== null;

  // Refresh RC state on first mount so isPro is always fresh
  useEffect(() => {
    void refreshCustomerInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPaywall = useCallback(() => {
    router.push("/pro-subscription" as Parameters<typeof router.push>[0]);
  }, [router]);

  return { isPro, showPaywall, activePlan };
}
