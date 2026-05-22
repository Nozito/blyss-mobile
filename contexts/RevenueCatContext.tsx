import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Purchases, { type PurchasesPackage, type CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";
import { proApi } from "@/lib/api";

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? "";
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? "";

export type RCPlan = "start" | "serenite" | "signature";

export type RCPackage = {
  key: RCPlan;
  rcPackage: PurchasesPackage;
  monthlyPrice: number;
  priceString: string;
  annualMonthlyPrice: number;
  annualPriceString: string;
  annualRcPackage?: PurchasesPackage;
};

interface RevenueCatContextType {
  isReady: boolean;
  packages: RCPackage[];
  customerInfo: CustomerInfo | null;
  activePlan: RCPlan | null;
  /** @deprecated Utiliser activePlan */
  activeEntitlement: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<{ success: boolean; paymentId?: string; error?: string }>;
  restorePurchases: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
  refreshActivePlan: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

const PLAN_IDENTIFIER_MAP: Record<string, RCPlan> = {
  start_monthly:     "start",
  start_annual:      "start",
  serenite_monthly:  "serenite",
  serenite_annual:   "serenite",
  signature_monthly: "signature",
  signature_annual:  "signature",
};

function getActivePlanFromRC(info: CustomerInfo | null): RCPlan | null {
  const ents = info?.entitlements?.active ?? {};
  if ("signature" in ents) return "signature";
  if ("serenite" in ents) return "serenite";
  if ("start" in ents) return "start";
  return null;
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const [rcReady, setRcReady] = useState(false);
  const [backendPlanChecked, setBackendPlanChecked] = useState(false);
  const [packages, setPackages] = useState<RCPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [backendPlan, setBackendPlan] = useState<RCPlan | null>(null);

  // Initialisation RC
  useEffect(() => {
    const apiKey = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    if (!apiKey) {
      setRcReady(true);
      return;
    }

    Purchases.configure({ apiKey });

    (async () => {
      try {
        const [offerings, info] = await Promise.all([
          Purchases.getOfferings(),
          Purchases.getCustomerInfo(),
        ]);
        setCustomerInfo(info);

        const current = offerings.current;
        if (current) {
          const monthly: Record<string, PurchasesPackage> = {};
          const annual: Record<string, PurchasesPackage> = {};

          for (const pkg of current.availablePackages) {
            const id = pkg.identifier.toLowerCase();
            if (id.includes("annual") || id.includes("yearly")) {
              const plan = PLAN_IDENTIFIER_MAP[id];
              if (plan) annual[plan] = pkg;
            } else {
              const plan = PLAN_IDENTIFIER_MAP[id];
              if (plan) monthly[plan] = pkg;
            }
          }

          const built: RCPackage[] = (["start", "serenite", "signature"] as RCPlan[]).flatMap((key) => {
            const mp = monthly[key];
            if (!mp) return [];
            const monthlyPrice = mp.product.price;
            const ap = annual[key];
            const annualTotal = ap?.product.price ?? monthlyPrice * 10;
            return [{
              key,
              rcPackage: mp,
              monthlyPrice,
              priceString: mp.product.priceString,
              annualMonthlyPrice: annualTotal / 12,
              annualPriceString: ap?.product.priceString ?? `${(annualTotal / 12).toFixed(2)} €`,
              annualRcPackage: ap,
            }];
          });

          setPackages(built);
        }
      } catch {
        // RC non disponible (simulator / clé absente)
      } finally {
        setRcReady(true);
      }
    })();

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
    return () => listener.remove();
  }, []);

  // Ref stable pour fetchBackendPlan — évite de le mettre dans les deps du useEffect
  const fetchBackendPlanRef = useRef<() => Promise<void>>(async () => {});

  const fetchBackendPlan = useCallback(async () => {
    try {
      const res = await proApi.getSubscription();
      if (res.success && res.data) {
        const s = res.data.status as string;
        if (s === "active" || s === "trialing") {
          setBackendPlan(res.data.plan as RCPlan);
          return;
        }
      }
      setBackendPlan(null);
    } catch {
      setBackendPlan(null);
    }
  }, []);

  // Garde la ref à jour sans provoquer de re-render
  fetchBackendPlanRef.current = fetchBackendPlan;

  // Déclenche le fallback backend via la ref stable — jamais de boucle
  useEffect(() => {
    if (!rcReady) return;
    const rcPlan = getActivePlanFromRC(customerInfo);
    if (rcPlan) {
      setBackendPlan(null);
      setBackendPlanChecked(true);
    } else {
      fetchBackendPlanRef.current().finally(() => setBackendPlanChecked(true));
    }
  // fetchBackendPlanRef intentionnellement exclu : c'est une ref, pas une valeur reactive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcReady, customerInfo]);

  // isReady = vrai seulement quand RC ET le plan backend sont tous les deux résolus
  const isReady = rcReady && backendPlanChecked;

  const rcActivePlan = getActivePlanFromRC(customerInfo);
  const activePlan: RCPlan | null = rcActivePlan ?? backendPlan;
  const activeEntitlement = activePlan;

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return { success: true, paymentId: pkg.identifier };
    } catch (e: any) {
      if (e?.userCancelled) return { success: false, error: "cancelled" };
      return { success: false, error: e?.message ?? "purchase_failed" };
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
    } catch {}
  }, []);

  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch {}
  }, []);

  const refreshActivePlan = useCallback(async () => {
    await Promise.all([refreshCustomerInfo(), fetchBackendPlanRef.current()]);
  }, [refreshCustomerInfo]);

  return (
    <RevenueCatContext.Provider value={{
      isReady, packages, customerInfo, activePlan, activeEntitlement,
      purchase, restorePurchases, refreshCustomerInfo, refreshActivePlan,
    }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) throw new Error("useRevenueCat must be used within RevenueCatProvider");
  return ctx;
}
