import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import Purchases, { LOG_LEVEL, type PurchasesPackage, type CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";
import { proApi } from "@/lib/api";
import { useAuth } from "./AuthContext";

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

export type RCPlan = "start" | "serenite" | "signature";

export type RCPackage = {
  key: RCPlan;
  rcPackage: PurchasesPackage;
  /** ISO 4217 du store (dépend de la région du compte App Store). */
  currencyCode: string;
  monthlyPrice: number;
  /** Prix mensuel formaté par le store (devise incluse). */
  priceString: string;
  annualMonthlyPrice: number;
  annualTotal: number;
  /** Total annuel formaté par le store. */
  annualPriceString: string;
  /** Total annuel ÷ 12, formaté dans la devise du store. */
  annualPricePerMonthString: string;
  annualRcPackage?: PurchasesPackage;
};

// Formate un montant dans la devise du store. Utilisé uniquement en repli
// quand le SDK ne fournit pas de chaîne toute faite — jamais de symbole en dur.
function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

interface RevenueCatContextType {
  isReady: boolean;
  packages: RCPackage[];
  customerInfo: CustomerInfo | null;
  activePlan: RCPlan | null;
  purchase: (pkg: PurchasesPackage) => Promise<{ success: boolean; paymentId?: string; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; restored: boolean; error?: string }>;
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

// Les clés RevenueCat réelles ont un préfixe connu suivi d'une chaîne
// alphanumérique longue — un placeholder au format "goog_..." passe à travers
// une liste de mots-clés, pas à travers ce regex.
function isValidRcKey(key: string): boolean {
  return /^(appl|goog|amzn)_[A-Za-z0-9]{10,}$/.test(key);
}
const RC_API_KEY = Platform.OS === "ios" ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

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
    const apiKey = RC_API_KEY;
    if (!isValidRcKey(apiKey)) {
      setRcReady(true);
      return;
    }

    // Réduit le bruit console du SDK (INFO/DEBUG). Les "offerings empty" restent
    // en ERROR — c'est une config App Store Connect / StoreKit, pas un bug appli :
    // agreement "Paid Applications" actif, in-app purchases "Ready to Submit"
    // avec des product IDs identiques dans RevenueCat, offering marquée "Current".
    // ⚠️ Si le build embarque ios-config/Blyss.storekit (plugin withStoreKitConfig,
    // activé par EXPO_PUBLIC_USE_STOREKIT_CONFIG=1), StoreKit lit ce fichier au
    // lieu d'App Store Connect — désactiver pour tester en sandbox / prod.
    void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });

    (async () => {
      try {
        const [offerings, info] = await Promise.all([
          Purchases.getOfferings(),
          Purchases.getCustomerInfo(),
        ]);
        setCustomerInfo(info);
        if (!offerings.current || offerings.current.availablePackages.length === 0) {
          // Offerings vides : le SDK a répondu mais ASC/StoreKit n'a renvoyé
          // aucun produit. L'écran d'abonnement bascule sur ses prix de repli.
          console.warn(
            "[RevenueCat] Offerings vides — vérifier App Store Connect / StoreKit (cf. commentaire ci-dessus).",
          );
        }

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
            const currencyCode = mp.product.currencyCode || "EUR";
            const monthlyPrice = mp.product.price;
            const ap = annual[key];
            const annualTotal = ap?.product.price ?? monthlyPrice * 10;
            return [{
              key,
              rcPackage: mp,
              currencyCode,
              monthlyPrice,
              priceString: mp.product.priceString,
              annualMonthlyPrice: annualTotal / 12,
              annualTotal,
              annualPriceString: ap?.product.priceString ?? formatMoney(annualTotal, currencyCode),
              annualPricePerMonthString:
                ap?.product.pricePerMonthString ?? formatMoney(annualTotal / 12, currencyCode),
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

  // Identifie l'utilisateur auprès de RevenueCat : le subscriber id RC devient
  // l'id numérique du backend. C'est ce qu'attendent le webhook
  // (`event.app_user_id`) ET la réconciliation serveur
  // (`GET api.revenuecat.com/v1/subscribers/<id>`). Sans logIn, RC utilise un id
  // anonyme (`$RCAnonymousID:…`) et AUCUN achat réel n'est jamais rattaché à la
  // pro côté backend.
  useEffect(() => {
    if (!rcReady || !isValidRcKey(RC_API_KEY)) return;
    let cancelled = false;
    (async () => {
      try {
        if (isAuthenticated && user?.id != null) {
          const currentId = await Purchases.getAppUserID();
          if (currentId !== String(user.id)) {
            await Purchases.logIn(String(user.id));
          }
        } else if (!(await Purchases.isAnonymous())) {
          // logOut jette (et log une ERROR) si l'utilisateur est déjà anonyme.
          await Purchases.logOut();
        }
        const info = await Purchases.getCustomerInfo();
        if (!cancelled) setCustomerInfo(info);
      } catch {
        // best-effort : un échec ici n'empêche pas l'app de tourner, mais les
        // achats ne seront pas réconciliés tant que ça n'a pas réussi.
      }
    })();
    return () => { cancelled = true; };
  }, [rcReady, isAuthenticated, user?.id]);

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
    isReady, packages, customerInfo, activePlan,
    purchase, restorePurchases, refreshCustomerInfo, refreshActivePlan,
  }), [isReady, packages, customerInfo, activePlan,
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
