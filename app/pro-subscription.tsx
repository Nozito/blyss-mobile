import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { getPlanDefinitions } from "@/constants/plans";
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

function savingsPercent(monthly: number, annualMonthly: number) {
  return Math.round((1 - annualMonthly / monthly) * 100);
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const PLAN_CONFIG = useMemo(() => getPlanDefinitions(colors), [colors]);
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [purchasing, setPurchasing] = useState<RCPlan | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState(false);

  const { refreshProfile, logout } = useAuth();
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
  // Plan affiché dans la carte "abonnement actuel" : le backend fait foi quand
  // il a synchronisé, mais RC reste la source de vérité tant que ce n'est pas
  // le cas (cf. hasActiveSubscription plus haut) — évite d'afficher "aucun
  // abonnement" juste après un achat pendant que le backend rattrape son retard.
  const currentPlanKey = (subscription?.plan as RCPlan | undefined) ?? activePlan;
  const currentPlanPkg = currentPlanKey ? packages.find((p) => p.key === currentPlanKey) : undefined;

  const handlePurchase = useCallback(async (planKey: RCPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPurchasing(planKey);
    // Capturée avant l'achat — sert à l'onboarding pour ne montrer que les
    // écrans des fonctionnalités nouvellement débloquées lors d'un upgrade.
    const previousPlan = activePlan;

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
        router.push({
          pathname: "/pro-subscription-success" as any,
          params: { plan: planKey, previousPlan: previousPlan ?? "" },
        });
      } else if (result.error && result.error !== "cancelled") {
        setPurchaseError("L'achat n'a pas pu être complété. Réessaie dans quelques instants.");
      }
    } else {
      // No RC package available — backend-only fallback
      setPurchasing(null);
      setPurchaseError("Ce plan n'est pas disponible pour l'instant. Réessaie plus tard.");
    }
  }, [isAnnual, packages, purchase, qc, router, refreshProfile, refreshActivePlan, activePlan]);

  const screenTitle = activePlan ? "Modifier ta formule" : "Choisis ta formule";
  const screenSubtitle = activePlan
    ? `Formule actuelle : ${PLAN_CONFIG[activePlan].label}`
    : "Gère ton plan Blyss Pro";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </AnimatedIconButton>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
              {screenTitle}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{screenSubtitle}</Text>
          </View>
        </View>

        {purchaseError && (
              <View style={{ marginBottom: 16 }}>
                <ErrorMessage message={purchaseError} />
              </View>
            )}
            {syncWarning && (
              <View style={{ marginBottom: 16, backgroundColor: colors.warningLight, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.warningText, lineHeight: 18 }}>
                  Abonnement actif. Synchronisation mineure échouée — redémarre l'app si certaines fonctionnalités manquent.
                </Text>
              </View>
            )}
            {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {!hasActiveSubscription && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{
                  fontSize: 26, fontWeight: "900", color: colors.foreground,
                  letterSpacing: -0.8, lineHeight: 33, marginBottom: 8,
                }}>
                  Ton activité mérite{"\n"}
                  <Text style={{ color: colors.primary, fontFamily: Fonts.serifItalic }}>
                    mieux qu'un agenda papier
                  </Text>
                </Text>
                <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22, marginBottom: 16 }}>
                  1 rendez-vous suffit à rentabiliser ton abonnement mensuel.
                </Text>
              </View>
            )}

            {currentPlanKey ? (
              <View style={{
                backgroundColor: colors.card, borderRadius: 20,
                borderWidth: 2, borderColor: colors.primary,
                padding: 18, marginBottom: 20,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground }}>
                    Plan {PLAN_CONFIG[currentPlanKey]?.label ?? currentPlanKey}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{
                      width: 7, height: 7, borderRadius: 3.5,
                      backgroundColor: !subscription || subscription.status === "active" ? colors.success : colors.warning,
                    }} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: !subscription || subscription.status === "active" ? colors.success : colors.warning }}>
                      {!subscription || subscription.status === "active" ? "Actif" : subscription.status}
                    </Text>
                  </View>
                </View>
                {/* Le prix réellement facturé vient de RC (source de vérité), pas du champ
                    monthlyPrice du backend qui peut diverger de l'offre RC active. */}
                {subscription?.billingType === "one_time" && currentPlanPkg ? (
                  <>
                    <Text style={{ fontSize: 30, fontWeight: "800", color: colors.primary, marginBottom: 0 }}>
                      {currentPlanPkg.annualPriceString}
                      <Text style={{ fontSize: 14, fontWeight: "400", color: colors.mutedForeground }}>/an</Text>
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 4 }}>
                      soit {currentPlanPkg.annualMonthlyPrice.toFixed(2)} €/mois
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 30, fontWeight: "800", color: colors.primary, marginBottom: 4 }}>
                    {currentPlanPkg?.priceString ?? `${(currentPlanPkg?.monthlyPrice ?? PLAN_CONFIG[currentPlanKey].fallbackMonthly).toFixed(2)} €`}
                    <Text style={{ fontSize: 14, fontWeight: "400", color: colors.mutedForeground }}>/mois</Text>
                  </Text>
                )}
                {subscription?.endDate && (
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 14 }}>
                    Expire le {new Date(subscription.endDate).toLocaleDateString("fr-FR")}
                  </Text>
                )}

                {/* Repères utiles au-delà du simple prix : ancienneté + type de facturation —
                    disponibles uniquement une fois le backend synchronisé */}
                {subscription && (
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                    <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                        Membre depuis
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                        {new Date(subscription.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
                        Facturation
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                        {subscription.billingType === "monthly" ? "Mensuelle" : "Paiement unique"}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 14 }} />

                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                  Ce qui est inclus
                </Text>
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {(PLAN_CONFIG[currentPlanKey]?.features ?? []).map((f) => (
                    <View key={f.text} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                      <Text style={{ fontSize: 12.5, color: colors.foreground, flex: 1 }}>{f.text}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={handleCancelSubscription}
                  style={{
                    borderWidth: 1.5, borderColor: colors.border,
                    borderRadius: 14, paddingVertical: 10,
                    alignItems: "center", marginBottom: 10,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.mutedForeground }}>
                    Annuler l'abonnement
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{
              flexDirection: "row", backgroundColor: colors.card,
              borderRadius: 18, padding: 4, marginBottom: 20,
              borderWidth: 1, borderColor: colors.border,
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
                      backgroundColor: active ? colors.primary : "transparent",
                      alignItems: "center", flexDirection: "row",
                      justifyContent: "center", gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: active ? colors.onColor : colors.mutedForeground }}>
                      {p === "monthly" ? "Mensuel" : "Annuel"}
                    </Text>
                    {p === "annual" && (
                      <View style={{
                        backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.success,
                        borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.onColor }}>2 mois offerts</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {isAnnual && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 8,
                backgroundColor: `${colors.success}10`, borderRadius: 14,
                borderWidth: 1, borderColor: `${colors.success}30`,
                padding: 12, marginBottom: 16,
              }}>
                <Ionicons name="gift-outline" size={18} color={colors.success} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.success, fontWeight: "500" }}>
                  2 mois offerts · soit 2 prestations économisées sur ton abonnement
                </Text>
              </View>
            )}

            {!isReady ? (
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Chargement des offres...</Text>
              </View>
            ) : (
              (Object.keys(PLAN_CONFIG) as RCPlan[]).map((planKey) => {
                const config = PLAN_CONFIG[planKey];
                const isCurrent = currentPlanKey === planKey;
                const rcPkg = packages.find((p) => p.key === planKey);
                const isPurchasing = purchasing === planKey;

                // Le total annuel est le prix de référence exact (facturé en une fois) ;
                // le prix "/mois" n'en est qu'une division d'affichage, jamais recalculé
                // à l'envers — pour éviter un écart de quelques centimes avec le prix
                // réellement facturé (cf. obligations d'affichage du prix total en France).
                const annualTotalValue = rcPkg?.annualTotal ?? config.fallbackAnnualTotal;

                const displayStr = isAnnual
                  ? `${(annualTotalValue / 12).toFixed(2)} €`
                  : (rcPkg?.priceString ?? `${config.fallbackMonthly.toFixed(2)} €`);

                const annualTotal = isAnnual ? annualTotalValue.toFixed(2) : null;

                const planSavings = savingsPercent(
                  rcPkg?.monthlyPrice ?? config.fallbackMonthly,
                  annualTotalValue / 12
                );

                return (
                  <View
                    key={planKey}
                    style={{
                      backgroundColor: colors.card, borderRadius: 20,
                      borderWidth: isCurrent ? 2.5 : 1,
                      borderColor: isCurrent ? config.color : colors.border,
                      marginBottom: 16, overflow: "hidden",
                    }}
                  >
                    {planKey === "serenite" && (
                      <View style={{ backgroundColor: colors.primary, paddingVertical: 5, alignItems: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: colors.onColor, letterSpacing: 1 }}>POPULAIRE</Text>
                      </View>
                    )}

                    <View style={{ padding: 18 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <Text style={{ fontSize: 19, fontWeight: "800", color: colors.foreground }}>{config.label}</Text>
                            {isCurrent && (
                              <View style={{ backgroundColor: `${config.color}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: config.color }}>Actuel</Text>
                              </View>
                            )}
                            {isAnnual && (
                              <View style={{ backgroundColor: `${colors.success}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.success }}>-{planSavings}%</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                            <Text style={{ fontSize: 28, fontWeight: "800", color: config.color }}>
                              {isAnnual ? `${annualTotal} €` : displayStr}
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{isAnnual ? "/an" : "/mois"}</Text>
                          </View>
                          {isAnnual && (
                            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>soit {displayStr}/mois</Text>
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
                            <Text style={{ fontSize: 13, color: colors.foreground, flex: 1 }}>{f.text}</Text>
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
                            <ActivityIndicator color={colors.onColor} size="small" />
                          ) : (
                            <>
                              <Ionicons name="arrow-up-circle-outline" size={18} color={colors.onColor} />
                              <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>Choisir {config.label}</Text>
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
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, textDecorationLine: "underline" }}>Restaurer mes achats</Text>
                )}
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "center", marginTop: 8, lineHeight: 16 }}>
              Annule à tout moment • Paiement sécurisé
            </Text>

            {/* Mentions légales obligatoires (Apple Guideline 3.1.2) — doivent être visibles
                près du bouton d'achat, pas seulement dans les réglages post-achat. */}
            <Text style={{ fontSize: 10, color: colors.mutedForeground, textAlign: "center", lineHeight: 15, marginTop: 12, paddingHorizontal: 8 }}>
              {"L'abonnement se renouvelle automatiquement pour la même durée sauf annulation au moins 24h avant la fin de la période en cours, via Réglages > Apple ID > Abonnements. Le paiement est débité sur ton compte Apple à la confirmation de l'achat."}
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 }}>
              <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")} hitSlop={8}>
                <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }}>Conditions d'utilisation</Text>
              </Pressable>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>•</Text>
              <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")} hitSlop={8}>
                <Text style={{ fontSize: 11, color: colors.primary, textDecorationLine: "underline" }}>Politique de confidentialité</Text>
              </Pressable>
            </View>

            {!hasActiveSubscription && (
              <Pressable
                onPress={() => { void logout().then(() => router.replace("/(auth)/login")); }}
                style={{ alignItems: "center", paddingVertical: 16 }}
              >
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
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
