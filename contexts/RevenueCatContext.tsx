import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import Purchases, { type PurchasesPackage, type CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";

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
  activeEntitlement: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<{ success: boolean; paymentId?: string; error?: string }>;
  restorePurchases: () => Promise<void>;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

const PLAN_IDENTIFIER_MAP: Record<string, RCPlan> = {
  start_monthly:    "start",
  start_annual:     "start",
  serenite_monthly: "serenite",
  serenite_annual:  "serenite",
  signature_monthly: "signature",
  signature_annual: "signature",
};

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [packages, setPackages] = useState<RCPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    const apiKey = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    if (!apiKey) {
      setIsReady(true);
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
        // RC not available (simulator / no keys)
      } finally {
        setIsReady(true);
      }
    })();

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
    return () => listener.remove();
  }, []);

  const activeEntitlement = customerInfo
    ? (Object.keys(customerInfo.entitlements.active)[0] ?? null)
    : null;

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      const paymentId = pkg.identifier;
      return { success: true, paymentId };
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

  return (
    <RevenueCatContext.Provider value={{
      isReady, packages, customerInfo, activeEntitlement,
      purchase, restorePurchases, refreshCustomerInfo,
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
