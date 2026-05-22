import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import Purchases, { type PurchasesPackage, type CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";
import { proApi } from "@/lib/api";
import { useAuth } from "./AuthContext";

// Fix #1 — noms de variables corrigés pour correspondre à .env.local
const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

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
  // Fix #2 — guard auth avant d'appeler proApi.getSubscription()
  const { isAuthenticated } = useAuth();

  const [rcReady, setRcReady] = useState(false);
  const [backendPlanChecked, setBackendPlanChecked] = useState(false);
  const [packages, setPackages] = useState<RCPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [backendPlan, setBackendPlan] = useState<RCPlan | null>(null);

  // Reset au logout pour que le prochain login reparte d'un état propre
  useEffect(() => {
    if (!isAuthenticated) {
      setBackendPlan(null);
      setBackendPlanChecked(false);
    }
  }, [isAuthenticated]);

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
        setRcReady(true); // Phase 1 seulement
      }
    })();

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
    return () => listener?.remove();
  }, []);

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

  fetchBackendPlanRef.current = fetchBackendPlan;

  // Fix #2 — guard isAuthenticated : pas d'appel API avant que la session soit établie
  useEffect(() => {
    if (!rcReady || !isAuthenticated) return;
    const rcPlan = getActivePlanFromRC(customerInfo);
    if (rcPlan) {
      setBackendPlan(null);
      setBackendPlanChecked(true);
    } else {
      fetchBackendPlanRef.current().finally(() => setBackendPlanChecked(true));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcReady, isAuthenticated, customerInfo]);

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

  // Fix #3 — Provider value memoizé : évite de re-rendre tous les consumers sur chaque
  // flip interne de rcReady/backendPlanChecked
  const contextValue = useMemo(() => ({
    isReady, packages, customerInfo, activePlan, activeEntitlement,
    purchase, restorePurchases, refreshCustomerInfo, refreshActivePlan,
  }), [isReady, packages, customerInfo, activePlan, activeEntitlement,
      purchase, restorePurchases, refreshCustomerInfo, refreshActivePlan]);

  return (
    <RevenueCatContext.Provider value={contextValue}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) throw new Error("useRevenueCat must be used within RevenueCatProvider");
  return ctx;
}
