import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  Linking,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { proApi } from "@/lib/api";
import { Fonts } from "@/constants/fonts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import * as Haptics from "expo-haptics";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type BillingPeriod = "monthly" | "annual";

async function syncSubscriptionWithRetry(maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await proApi.syncSubscription();
      if (res.success) return true;
    } catch {}
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  return false;
}

const PLAN_CONFIG: Record<RCPlan, {
  label: string;
  fallbackMonthly: number;
  color: string;
  icon: "rocket-outline" | "shield-checkmark-outline" | "diamond-outline";
  features: { text: string; icon: string }[];
}> = {
  start: {
    label: "Start",
    fallbackMonthly: 29.9,
    color: Colors.primary,
    icon: "rocket-outline",
    features: [
      { text: "Tes clientes réservent sans DM ni appel", icon: "calendar-outline" },
      { text: "Rappels automatiques — zéro lapin", icon: "notifications-outline" },
      { text: "Profil public visible par toutes tes clientes", icon: "globe-outline" },
      { text: "Dashboard pour suivre ta semaine", icon: "bar-chart-outline" },
      { text: "Paiement en ligne sécurisé", icon: "card-outline" },
    ],
  },
  serenite: {
    label: "Sérénité",
    fallbackMonthly: 39.9,
    color: Colors.pro ?? Colors.pro,
    icon: "shield-checkmark-outline",
    features: [
      { text: "Tout Start inclus", icon: "checkmark-circle-outline" },
      { text: "CA en temps réel + facturation automatique", icon: "receipt-outline" },
      { text: "Portfolio photos pour attirer de nouvelles clientes", icon: "camera-outline" },
      { text: "Statistiques détaillées de ton activité", icon: "analytics-outline" },
      { text: "Rappels post-prestation pour fidéliser", icon: "heart-outline" },
    ],
  },
  signature: {
    label: "Signature",
    fallbackMonthly: 49.9,
    color: Colors.secondary,
    icon: "diamond-outline",
    features: [
      { text: "Tout Sérénité inclus", icon: "checkmark-circle-outline" },
      { text: "Mise en avant prioritaire dans la recherche", icon: "star-outline" },
      { text: "Encaissement à distance depuis ton profil", icon: "card-outline" },
      { text: "Badge Pro Signature visible par tes clientes", icon: "diamond-outline" },
      { text: "Support prioritaire 7j/7", icon: "headset-outline" },
    ],
  },
};

const ANNUAL_MONTHS_FREE = 2;

function annualMonthlyFallback(monthly: number) {
  return (monthly * (12 - ANNUAL_MONTHS_FREE)) / 12;
}

function savingsPercent(monthly: number, annualMonthly: number) {
  return Math.round((1 - annualMonthly / monthly) * 100);
}

const PLAN_LABEL_MAP: Record<RCPlan, string> = {
  start: "Start",
  serenite: "Sérénité",
  signature: "Signature",
};

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [purchasing, setPurchasing] = useState<RCPlan | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState(false);

  const { user, refreshProfile, logout } = useAuth();
  const { packages, purchase, restorePurchases, activePlan, isReady, refreshActivePlan } = useRevenueCat();
  const { showToast } = useToast();
  const [restoring, setRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (!result.success) {
        showToast("La restauration a échoué. Réessaie.", "error");
      } else if (result.restored) {
        showToast("Achats restaurés avec succès", "success");
        await refreshActivePlan();
      } else {
        showToast("Aucun abonnement actif trouvé pour ce compte Apple", "error");
      }
    } finally {
      setRestoring(false);
    }
  }, [restorePurchases, refreshActivePlan, showToast]);

  // hasActiveSubscription basé sur RC, pas sur user.pro_status (backend peut être lent)
  const hasActiveSubscription = activePlan !== null;

  const { data, isLoading } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
  });

  useEffect(() => {
    if (isLoading || reduceMotion) return;
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [isLoading, reduceMotion, contentOpacity]);

  const handleCancelSubscription = () => {
    void Linking.openURL("https://apps.apple.com/account/subscriptions");
  };

  const subscription = data?.data;
  const isAnnual = billing === "annual";

  const handlePurchase = useCallback(async (planKey: RCPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPurchasing(planKey);

    const rcPkg = packages.find((p) => p.key === planKey);

    if (rcPkg) {
      const pkg = isAnnual && rcPkg.annualRcPackage
        ? rcPkg.annualRcPackage
        : rcPkg.rcPackage;

      const result = await purchase(pkg);
      setPurchasing(null);

      if (result.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const synced = await syncSubscriptionWithRetry();
        if (!synced) setSyncWarning(true);
        await refreshProfile();
        qc.invalidateQueries({ queryKey: ["pro-subscription"] });
        await refreshActivePlan();
        router.push({ pathname: "/(pro)/(profile)/subscription-success" as any, params: { plan: planKey } });
      } else if (result.error && result.error !== "cancelled") {
        setPurchaseError("L'achat n'a pas pu être complété. Réessaie dans quelques instants.");
      }
    } else {
      // No RC package available — backend-only fallback
      setPurchasing(null);
      setPurchaseError("Ce plan n'est pas disponible pour l'instant. Réessaie plus tard.");
    }
  }, [isAnnual, packages, purchase, qc, router, refreshProfile, refreshActivePlan, subscription]);

  const savings = savingsPercent(
    PLAN_CONFIG.start.fallbackMonthly,
    annualMonthlyFallback(PLAN_CONFIG.start.fallbackMonthly)
  );

  const screenTitle = activePlan ? "Modifier ta formule" : "Choisis ta formule";
  const screenSubtitle = activePlan
    ? `Formule actuelle : ${PLAN_LABEL_MAP[activePlan]}`
    : "Gère ton plan Blyss Pro";

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Stack.Screen options={{
        gestureEnabled: hasActiveSubscription,
        headerBackVisible: false,
      }} />
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          {hasActiveSubscription && (
            <AnimatedIconButton
              onPress={() => safeBack(router)}
              accessibilityLabel="Retour"
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
            </AnimatedIconButton>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
              {screenTitle}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>{screenSubtitle}</Text>
          </View>
        </View>

        {purchaseError && (
              <View style={{ marginBottom: 16 }}>
                <ErrorMessage message={purchaseError} />
              </View>
            )}
            {syncWarning && (
              <View style={{ marginBottom: 16, backgroundColor: Colors.warningLight, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, color: Colors.warningText, lineHeight: 18 }}>
                  Abonnement actif. Synchronisation mineure échouée — redémarre l'app si certaines fonctionnalités manquent.
                </Text>
              </View>
            )}
            {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {!subscription && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 26, fontWeight: "900", color: Colors.foreground,
                  letterSpacing: -0.8, lineHeight: 33, marginBottom: 8,
                }}>
                  Ton activité mérite{"\n"}
                  <Text style={{ color: Colors.primary, fontFamily: Fonts.serifItalic }}>
                    mieux qu'un agenda papier
                  </Text>
                </Text>
                <Text style={{ fontSize: 14, color: Colors.mutedForeground, lineHeight: 22, marginBottom: 16 }}>
                  1 rendez-vous suffit à rentabiliser ton abonnement mensuel.
                </Text>
              </View>
            )}

            {subscription ? (
              <View style={{
                backgroundColor: Colors.card, borderRadius: 20,
                borderWidth: 2, borderColor: Colors.primary,
                padding: 18, marginBottom: 20,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground }}>
                    Plan {PLAN_CONFIG[subscription.plan as RCPlan]?.label ?? subscription.plan}
                  </Text>
                  <View style={{
                    backgroundColor: subscription.status === "active" ? `${Colors.success}20` : `${Colors.warning}20`,
                    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: subscription.status === "active" ? Colors.success : Colors.warning }}>
                      {subscription.status === "active" ? "Actif" : subscription.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 30, fontWeight: "800", color: Colors.primary, marginBottom: 4 }}>
                  {(Number(subscription.monthlyPrice) || 0).toFixed(2)} €
                  <Text style={{ fontSize: 14, fontWeight: "400", color: Colors.mutedForeground }}>/mois</Text>
                </Text>
                {subscription.endDate && (
                  <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 14 }}>
                    Expire le {new Date(subscription.endDate).toLocaleDateString("fr-FR")}
                  </Text>
                )}
                <Pressable
                  onPress={handleCancelSubscription}
                  style={{
                    borderWidth: 1.5, borderColor: Colors.border,
                    borderRadius: 14, paddingVertical: 10,
                    alignItems: "center", marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.mutedForeground }}>
                    Annuler l'abonnement
                  </Text>
                </Pressable>
                {activePlan !== null && (
                  <Pressable
                    onPress={() => router.push("/(pro)/(profile)/subscription-settings" as any)}
                    style={{ alignItems: "center", paddingVertical: 4 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.primary }}>
                      Gérer mon abonnement →
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            <View style={{
              flexDirection: "row", backgroundColor: Colors.card,
              borderRadius: 18, padding: 4, marginBottom: 20,
              borderWidth: 1, borderColor: Colors.border,
            }}>
              {(["monthly", "annual"] as BillingPeriod[]).map((p) => {
                const active = billing === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setBilling(p);
                    }}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 14,
                      backgroundColor: active ? Colors.primary : "transparent",
                      alignItems: "center", flexDirection: "row",
                      justifyContent: "center", gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: active ? Colors.white : Colors.mutedForeground }}>
                      {p === "monthly" ? "Mensuel" : "Annuel"}
                    </Text>
                    {p === "annual" && (
                      <View style={{
                        backgroundColor: active ? "rgba(255,255,255,0.25)" : Colors.success,
                        borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.white }}>2 mois offerts</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {isAnnual && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: `${Colors.success}10`, borderRadius: 14,
                borderWidth: 1, borderColor: `${Colors.success}30`,
                padding: 12, marginBottom: 16,
              }}>
                <Ionicons name="gift-outline" size={18} color={Colors.success} />
                <Text style={{ flex: 1, fontSize: 13, color: Colors.success, fontWeight: "500" }}>
                  2 mois offerts · soit 2 prestations économisées sur ton abonnement
                </Text>
              </View>
            )}

            {!isReady ? (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Chargement des offres...</Text>
              </View>
            ) : (
              (Object.keys(PLAN_CONFIG) as RCPlan[]).map((planKey) => {
                // Start n'existe pas en annuel — on affiche juste un bandeau info, pas de carte cliquable
                if (isAnnual && planKey === "start") return (
                  <View key="start-annual-notice" style={{
                    backgroundColor: `${Colors.mutedForeground}10`, borderRadius: 14,
                    borderWidth: 1, borderColor: Colors.border,
                    paddingVertical: 10, paddingHorizontal: 16, marginBottom: 12,
                    flexDirection: "row", alignItems: "center", gap: 8,
                  }}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.mutedForeground} />
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, flex: 1 }}>
                      Le plan Start n'est pas disponible en annuel
                    </Text>
                  </View>
                );

                const config = PLAN_CONFIG[planKey];
                const isCurrent = subscription?.plan === planKey;
                const rcPkg = packages.find((p) => p.key === planKey);
                const isPurchasing = purchasing === planKey;

                const displayStr = isAnnual
                  ? `${(rcPkg?.annualMonthlyPrice ?? annualMonthlyFallback(config.fallbackMonthly)).toFixed(2)} €`
                  : (rcPkg?.priceString ?? `${config.fallbackMonthly.toFixed(2)} €`);

                const annualTotal = isAnnual
                  ? ((rcPkg?.annualMonthlyPrice ?? annualMonthlyFallback(config.fallbackMonthly)) * 12).toFixed(0)
                  : null;

                const planSavings = savingsPercent(
                  rcPkg?.monthlyPrice ?? config.fallbackMonthly,
                  rcPkg?.annualMonthlyPrice ?? annualMonthlyFallback(config.fallbackMonthly)
                );

                return (
                  <View
                    key={planKey}
                    style={{
                      backgroundColor: Colors.card, borderRadius: 20,
                      borderWidth: isCurrent ? 2.5 : 1,
                      borderColor: isCurrent ? config.color : Colors.border,
                      marginBottom: 16, overflow: "hidden",
                    }}
                  >
                    {planKey === "serenite" && (
                      <View style={{ backgroundColor: Colors.primary, paddingVertical: 5, alignItems: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.white, letterSpacing: 1 }}>POPULAIRE</Text>
                      </View>
                    )}

                    <View style={{ padding: 18 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <Text style={{ fontSize: 19, fontWeight: "800", color: Colors.foreground }}>{config.label}</Text>
                            {isCurrent && (
                              <View style={{ backgroundColor: `${config.color}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: config.color }}>Actuel</Text>
                              </View>
                            )}
                            {isAnnual && (
                              <View style={{ backgroundColor: `${Colors.success}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.success }}>-{planSavings}%</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                            <Text style={{ fontSize: 28, fontWeight: "800", color: config.color }}>{displayStr}</Text>
                            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>/mois</Text>
                          </View>
                          {isAnnual && annualTotal && (
                            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>soit {annualTotal} €/an</Text>
                          )}
                        </View>
                        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${config.color}15`, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name={config.icon} size={24} color={config.color} />
                        </View>
                      </View>

                      <View style={{ gap: 9, marginBottom: isCurrent ? 0 : 16 }}>
                        {config.features.map((f) => (
                          <View key={f.text} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: `${config.color}15`, alignItems: "center", justifyContent: "center" }}>
                              <Ionicons name={f.icon as any} size={14} color={config.color} />
                            </View>
                            <Text style={{ fontSize: 13, color: Colors.foreground, flex: 1 }}>{f.text}</Text>
                          </View>
                        ))}
                      </View>

                      {!isCurrent && (
                        <AnimatedPressable
                          onPress={() => handlePurchase(planKey)}
                          disabled={!!purchasing}
                          style={{
                            height: 48, borderRadius: 14, backgroundColor: config.color,
                            alignItems: "center", justifyContent: "center",
                            flexDirection: "row", gap: 8,
                            opacity: isPurchasing ? 0.7 : 1,
                            shadowColor: config.color,
                            shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
                          }}
                        >
                          {isPurchasing ? (
                            <ActivityIndicator color={Colors.white} size="small" />
                          ) : (
                            <>
                              <Ionicons name="arrow-up-circle-outline" size={18} color={Colors.white} />
                              <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 14 }}>Choisir {config.label}</Text>
                            </>
                          )}
                        </AnimatedPressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            <View style={{ alignItems: "center", marginTop: 8, marginBottom: 4 }}>
              <Pressable onPress={() => void handleRestore()} disabled={restoring} hitSlop={8}>
                {restoring ? (
                  <ActivityIndicator size="small" color={Colors.mutedForeground} />
                ) : (
                  <Text style={{ fontSize: 13, color: Colors.mutedForeground, textDecorationLine: "underline" }}>Restaurer mes achats</Text>
                )}
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, textAlign: "center", marginTop: 8, lineHeight: 16 }}>
              Annule à tout moment • Paiement sécurisé
            </Text>

            {/* Mentions légales obligatoires (Apple Guideline 3.1.2) — doivent être visibles
                près du bouton d'achat, pas seulement dans les réglages post-achat. */}
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, textAlign: "center", lineHeight: 15, marginTop: 12, paddingHorizontal: 8 }}>
              {"L'abonnement se renouvelle automatiquement pour la même durée sauf annulation au moins 24h avant la fin de la période en cours, via Réglages > Apple ID > Abonnements. Le paiement est débité sur ton compte Apple à la confirmation de l'achat."}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 }}>
              <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")} hitSlop={8}>
                <Text style={{ fontSize: 11, color: Colors.primary, textDecorationLine: "underline" }}>Conditions d'utilisation</Text>
              </Pressable>
              <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>•</Text>
              <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")} hitSlop={8}>
                <Text style={{ fontSize: 11, color: Colors.primary, textDecorationLine: "underline" }}>Politique de confidentialité</Text>
              </Pressable>
            </View>

            {!hasActiveSubscription && (
              <Pressable
                onPress={() => { void logout().then(() => router.replace("/(auth)/login")); }}
                style={{ alignItems: "center", paddingVertical: 16 }}
              >
                <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                  Pas maintenant — se déconnecter
                </Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
      </Animated.View>
    </View>
  );
}
