import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import Purchases, { type PurchasesPackage, type CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";
import { proApi } from "@/lib/api";
import { useAuth } from "./AuthContext";

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
  restorePurchases: () => Promise<{ success: boolean; restored: boolean; error?: string }>;
  refreshCustomerInfo: () => Promise<void>;
  refreshActivePlan: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

// start_annual retiré — Start est mensuel uniquement, pas d'offre annuelle pour ce plan
const PLAN_IDENTIFIER_MAP: Record<string, RCPlan> = {
  start_monthly:     "start",
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
  const { isAuthenticated } = useAuth();

  const [rcReady, setRcReady] = useState(false);
  const [backendPlanChecked, setBackendPlanChecked] = useState(false);
  const [packages, setPackages] = useState<RCPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [backendPlan, setBackendPlan] = useState<RCPlan | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setBackendPlan(null);
      setBackendPlanChecked(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const apiKey = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    // Les clés RevenueCat réelles ont un préfixe connu suivi d'une chaîne alphanumérique
    // longue, sans ponctuation. Se fier à une liste de mots-clés de placeholder
    // (ex: "your_key_here") est fragile — un placeholder au format "goog_..." (points de
    // suspension littéraux, cf. .env.example) passait à travers l'ancien guard et
    // déclenchait Purchases.configure() avec une clé invalide, cassant silencieusement
    // les achats sur Android.
    const isValidRcKey = /^(appl|goog|amzn)_[A-Za-z0-9]{10,}$/.test(apiKey);
    if (!isValidRcKey) {
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

    const onCustomerInfo = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(onCustomerInfo);
    return () => { Purchases.removeCustomerInfoUpdateListener(onCustomerInfo); };
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

  // backendPlanChecked ne redevient jamais true tant que l'utilisateur est
  // déconnecté (l'effet qui le fait dépend justement de isAuthenticated) — sans
  // isAuthenticated dans cette condition, isReady restait bloqué à false après
  // un logout, ce qui coinçait app/(pro)/_layout.tsx sur son écran de chargement
  // au lieu de rediriger vers /welcome (aucune vérification de plan n'est
  // pertinente pour un utilisateur déconnecté, donc rien à attendre ici).
  const isReady = rcReady && (backendPlanChecked || !isAuthenticated);

  const rcActivePlan = getActivePlanFromRC(customerInfo);
  const activePlan: RCPlan | null = rcActivePlan ?? backendPlan;
  const activeEntitlement = activePlan;

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return { success: true, paymentId: pkg.identifier };
    } catch (e: unknown) {
      // react-native-purchases doesn't export a typed error shape for this
      const err = e as { userCancelled?: boolean; message?: string } | undefined;
      if (err?.userCancelled) return { success: false, error: "cancelled" };
      return { success: false, error: err?.message ?? "purchase_failed" };
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const restored = getActivePlanFromRC(info) !== null;
      return { success: true, restored };
    } catch (e: unknown) {
      const err = e as { message?: string } | undefined;
      return { success: false, restored: false, error: err?.message ?? "restore_failed" };
    }
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
