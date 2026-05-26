import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { proApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";
import { useAuth } from "@/contexts/AuthContext";

type BillingPeriod = "monthly" | "annual";

async function syncSubscriptionWithRetry(
  payload: Parameters<typeof proApi.createSubscription>[0],
  maxAttempts = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await proApi.createSubscription(payload);
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
      { text: "Réservation en ligne", icon: "calendar-outline" },
      { text: "Gestion des rendez-vous", icon: "grid-outline" },
      { text: "Notifications clientes", icon: "notifications-outline" },
      { text: "Tableau de bord", icon: "bar-chart-outline" },
      { text: "Profil public Blyss", icon: "globe-outline" },
    ],
  },
  serenite: {
    label: "Sérénité",
    fallbackMonthly: 39.9,
    color: Colors.pro ?? "#7C3AED",
    icon: "shield-checkmark-outline",
    features: [
      { text: "Tout Start inclus", icon: "checkmark-circle-outline" },
      { text: "Module finance", icon: "receipt-outline" },
      { text: "Statistiques & Facturation", icon: "analytics-outline" },
      { text: "Portfolio photos", icon: "camera-outline" },
      { text: "Rappels automatiques", icon: "notifications-outline" },
    ],
  },
  signature: {
    label: "Signature",
    fallbackMonthly: 49.9,
    color: Colors.secondary ?? "#F59E0B",
    icon: "diamond-outline",
    features: [
      { text: "Tout Sérénité inclus", icon: "checkmark-circle-outline" },
      { text: "Visibilité premium", icon: "star-outline" },
      { text: "Encaissement en ligne", icon: "card-outline" },
      { text: "Rappels post-prestation", icon: "heart-outline" },
      { text: "Support prioritaire", icon: "headset-outline" },
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
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [purchasing, setPurchasing] = useState<RCPlan | null>(null);

  const { user, refreshProfile } = useAuth();
  const { packages, purchase, restorePurchases, activePlan, isReady, refreshActivePlan } = useRevenueCat();

  // hasActiveSubscription basé sur RC, pas sur user.pro_status (backend peut être lent)
  const hasActiveSubscription = activePlan !== null;

  const { data, isLoading } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
  });

  const handleCancelSubscription = () => {
    Alert.alert(
      "Gérer mon abonnement",
      "Les abonnements Blyss Pro sont gérés par Apple. Tu seras redirigée vers les Réglages Apple pour annuler.",
      [
        { text: "Retour", style: "cancel" },
        {
          text: "Gérer via Apple",
          onPress: () => void Linking.openURL("https://apps.apple.com/account/subscriptions"),
        },
      ]
    );
  };

  const subscription = data?.data;
  const isAnnual = billing === "annual";

  const handlePurchase = useCallback(async (planKey: RCPlan) => {
    setPurchasing(planKey);

    const rcPkg = packages.find((p) => p.key === planKey);

    if (rcPkg) {
      const pkg = isAnnual && rcPkg.annualRcPackage
        ? rcPkg.annualRcPackage
        : rcPkg.rcPackage;

      const result = await purchase(pkg);
      setPurchasing(null);

      if (result.success) {
        const synced = await syncSubscriptionWithRetry({
          plan: planKey,
          billingType: isAnnual ? "one_time" : "monthly",
          monthlyPrice: isAnnual ? rcPkg.annualMonthlyPrice : rcPkg.monthlyPrice,
          paymentId: result.paymentId ?? pkg.identifier,
        });
        if (!synced) {
          // RC confirme l'achat, mais backend n'a pas répondu après 3 essais.
          // L'accès est accordé via RC, mais on prévient l'utilisateur.
          Alert.alert(
            "Paiement accepté",
            "Ton abonnement est actif. Une erreur de synchronisation mineure s'est produite — si des fonctionnalités sont manquantes dans les prochaines minutes, redémarre l'application ou contacte le support.",
            [{ text: "OK" }]
          );
        }
        await refreshProfile();
        qc.invalidateQueries({ queryKey: ["pro-subscription"] });
        await refreshActivePlan();
        router.push({ pathname: "/(pro)/(profile)/subscription-success" as any, params: { plan: planKey } });
      } else if (result.error && result.error !== "cancelled") {
        Alert.alert("Erreur", "L'achat n'a pas pu être complété. Réessaie.");
      }
    } else {
      const config = PLAN_CONFIG[planKey];
      const monthly = config.fallbackMonthly;
      const price = isAnnual ? annualMonthlyFallback(monthly) : monthly;
      Alert.alert(
        `Passer au plan ${config.label}`,
        `Tu seras facturée ${price.toFixed(2)} €/mois${isAnnual ? ` (${(price * 12).toFixed(0)} €/an)` : ""}.`,
        [
          { text: "Annuler", style: "cancel", onPress: () => setPurchasing(null) },
          {
            text: "Confirmer",
            onPress: async () => {
              try {
                if (subscription) {
                  await proApi.updateSubscription({ plan: planKey });
                } else {
                  await proApi.createSubscription({
                    plan: planKey,
                    billingType: isAnnual ? "one_time" : "monthly",
                    monthlyPrice: isAnnual ? annualMonthlyFallback(PLAN_CONFIG[planKey].fallbackMonthly) : PLAN_CONFIG[planKey].fallbackMonthly,
                    paymentId: `manual_${planKey}_${Date.now()}`,
                  });
                }
                await refreshProfile();
                qc.invalidateQueries({ queryKey: ["pro-subscription"] });
                await refreshActivePlan();
                router.push({ pathname: "/(pro)/(profile)/subscription-success" as any, params: { plan: planKey } });
              } catch {
                Alert.alert("Erreur", "Impossible de changer de plan.");
              } finally {
                setPurchasing(null);
              }
            },
          },
        ]
      );
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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          {hasActiveSubscription && (
            <AnimatedIconButton
              onPress={() => router.back()}
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

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
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
            ) : (
              <View style={{
                backgroundColor: `${Colors.warning}15`, borderRadius: 16,
                borderWidth: 1, borderColor: `${Colors.warning}40`,
                padding: 16, marginBottom: 20,
                flexDirection: "row", alignItems: "center", gap: 12,
              }}>
                <Ionicons name="alert-circle-outline" size={22} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>Aucun abonnement actif</Text>
                  <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
                    Choisis un plan pour accéder à toutes les fonctionnalités
                  </Text>
                </View>
              </View>
            )}

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
                    onPress={() => setBilling(p)}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 14,
                      backgroundColor: active ? Colors.primary : "transparent",
                      alignItems: "center", flexDirection: "row",
                      justifyContent: "center", gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: active ? "#fff" : Colors.mutedForeground }}>
                      {p === "monthly" ? "Mensuel" : "Annuel"}
                    </Text>
                    {p === "annual" && (
                      <View style={{
                        backgroundColor: active ? "rgba(255,255,255,0.25)" : Colors.success,
                        borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>-{savings}%</Text>
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
                  2 mois offerts avec l'abonnement annuel
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
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 1 }}>POPULAIRE</Text>
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
                        <Pressable
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
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
                              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Choisir {config.label}</Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            <View style={{ alignItems: "center", marginTop: 8, marginBottom: 4 }}>
              <Pressable onPress={restorePurchases}>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground, textDecorationLine: "underline" }}>Restaurer mes achats</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, textAlign: "center", marginTop: 8, lineHeight: 16 }}>
              Annule à tout moment • Paiement sécurisé
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
