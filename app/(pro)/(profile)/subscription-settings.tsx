import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { proApi } from "@/lib/api";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";

const PLAN_META: Record<RCPlan, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
  featureCount: number;
}> = {
  start:     { label: "Start",     icon: "flash-outline",    color: Colors.primary,   description: "Réservations & agenda",      featureCount: 5 },
  serenite:  { label: "Sérénité",  icon: "heart-outline",    color: Colors.pro,       description: "Finance & statistiques",     featureCount: 9 },
  signature: { label: "Signature", icon: "sparkles-outline", color: Colors.secondary, description: "Paiements & visibilité premium", featureCount: 14 },
};

// Fix 4 — used to decide upgrade vs downgrade CTA label
const PLAN_ORDER: Record<RCPlan, number> = { start: 0, serenite: 1, signature: 2 };

export default function ProSubscriptionSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Issue 2 — billing toggle so the user can pick monthly or annual before upgrading
  const [isAnnual, setIsAnnual] = useState(false);

  // activePlan from RC is the source of truth for current plan state
  const { activePlan, packages, purchase, restorePurchases, refreshActivePlan } = useRevenueCat();

  // proApi.getSubscription() only for display details (endDate, billingType)
  const { data, isLoading } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
  });

  const subscription = data?.data;

  // Issue 2 — upgrade goes through RC purchase() to hit App Store / Play Store
  const handleUpgrade = async (planId: RCPlan) => {
    if (planId === activePlan) return;
    setIsChanging(true);
    try {
      const rcPkg = packages.find((p) => p.key === planId);
      if (!rcPkg) {
        Alert.alert("Erreur", "Ce plan n'est pas disponible.");
        return;
      }
      const pkg = isAnnual && rcPkg.annualRcPackage ? rcPkg.annualRcPackage : rcPkg.rcPackage;
      const result = await purchase(pkg);
      if (result.success) {
        await refreshActivePlan();
        qc.invalidateQueries({ queryKey: ["pro-subscription"] });
        router.push({ pathname: "/(pro)/(profile)/subscription-success" as any, params: { plan: planId } });
      } else if (result.error && result.error !== "cancelled") {
        Alert.alert("Erreur", "L'achat n'a pas pu être complété. Réessaie.");
      }
    } catch {
      Alert.alert("Erreur", "Impossible de changer de plan pour l'instant.");
    } finally {
      setIsChanging(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Annuler l'abonnement",
      "Es-tu sûre de vouloir annuler ? Tu garderas l'accès jusqu'à la fin de ta période actuelle.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler", style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              await proApi.cancelSubscription();
              qc.invalidateQueries({ queryKey: ["pro-subscription"] });
              Alert.alert("Annulé", "Ton abonnement a été annulé. L'accès reste actif jusqu'à la fin de la période en cours.");
            } catch {
              Alert.alert("Erreur", "Impossible d'annuler l'abonnement pour l'instant.");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
            Mon abonnement
          </Text>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
            Gérer ton plan Blyss Pro
          </Text>
        </View>
      </View>

      {/* Fix 4 — hero current plan card: larger layout with badge, billing period, renewal */}
      {activePlan && (
        <View style={{
          backgroundColor: Colors.card, borderRadius: 20,
          borderWidth: 2, borderColor: `${PLAN_META[activePlan].color}50`,
          padding: 20, marginBottom: 20,
          shadowColor: PLAN_META[activePlan].color,
          shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 3,
        }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
            <View style={{
              width: 60, height: 60, borderRadius: 18,
              backgroundColor: `${PLAN_META[activePlan].color}18`,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name={PLAN_META[activePlan].icon} size={28} color={PLAN_META[activePlan].color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Plan actuel
              </Text>
              <Text style={{ fontSize: 19, fontWeight: "800", color: Colors.foreground, marginBottom: 2 }}>
                Formule {PLAN_META[activePlan].label}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: PLAN_META[activePlan].color }}>
                {packages.find((p) => p.key === activePlan)?.priceString ?? "—"}/mois
              </Text>
              {/* Issue 5 — billing period label from proApi billingType */}
              {subscription?.billingType && (
                <View style={{
                  alignSelf: "flex-start", marginTop: 6,
                  backgroundColor: `${PLAN_META[activePlan].color}15`,
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: PLAN_META[activePlan].color }}>
                    {subscription.billingType === "one_time" ? "Annuel · 2 mois offerts" : "Mensuel"}
                  </Text>
                </View>
              )}
            </View>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0",
              flexDirection: "row", alignItems: "center", gap: 6,
            }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#15803D" }}>Actif</Text>
            </View>
          </View>
          {subscription?.endDate && (
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 12 }}>
              Renouvellement le {new Date(subscription.endDate).toLocaleDateString("fr-FR")}
            </Text>
          )}
        </View>
      )}

      {/* Issue 2 — billing toggle: monthly vs annual before changing plan */}
      <View style={{
        flexDirection: "row", backgroundColor: Colors.card,
        borderRadius: 18, padding: 4, marginBottom: 16,
        borderWidth: 1, borderColor: Colors.border,
      }}>
        {(["monthly", "annual"] as const).map((period) => {
          const active = (period === "annual") === isAnnual;
          return (
            <Pressable
              key={period}
              onPress={() => setIsAnnual(period === "annual")}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 14,
                backgroundColor: active ? Colors.primary : "transparent",
                alignItems: "center", flexDirection: "row",
                justifyContent: "center", gap: 6,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#fff" : Colors.mutedForeground }}>
                {period === "monthly" ? "Mensuel" : "Annuel"}
              </Text>
              {period === "annual" && (
                <View style={{
                  backgroundColor: active ? "rgba(255,255,255,0.25)" : Colors.success,
                  borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>-17%</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Change plan */}
      <Text style={{
        fontSize: 11, fontWeight: "800", color: Colors.mutedForeground,
        textTransform: "uppercase", letterSpacing: 1,
        marginBottom: 12, paddingHorizontal: 2,
      }}>
        Changer de formule
      </Text>
      <View style={{ gap: 10, marginBottom: 20 }}>
        {(Object.keys(PLAN_META) as RCPlan[]).map((planId) => {
          const meta = PLAN_META[planId];
          const isCurrent = planId === activePlan;
          const rcPkg = packages.find((p) => p.key === planId);
          const priceStr = isAnnual
            ? (rcPkg?.annualPriceString ?? rcPkg?.priceString ?? "—")
            : (rcPkg?.priceString ?? "—");
          const isUpgrade = PLAN_ORDER[planId] > PLAN_ORDER[activePlan ?? "start"];
          return (
            <Pressable
              key={planId}
              onPress={() => { if (!isCurrent) void handleUpgrade(planId); }}
              disabled={isCurrent || isChanging}
              style={{
                backgroundColor: Colors.card, borderRadius: 16, padding: 16,
                borderWidth: isCurrent ? 2 : 1,
                borderColor: isCurrent ? meta.color : Colors.border,
                opacity: isChanging && !isCurrent ? 0.7 : 1,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: `${meta.color}18`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: Colors.foreground }}>
                    {meta.label}
                  </Text>
                  {/* Fix 4 — feature description line under plan name */}
                  <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                    {meta.description} · {meta.featureCount} fonctionnalités
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                    {priceStr}{isAnnual ? "/an" : "/mois"}
                  </Text>
                </View>
                {isCurrent ? (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: `${meta.color}18` }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: meta.color }}>Actuel</Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: meta.color, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {!isUpgrade && <Ionicons name="arrow-back" size={11} color="#fff" />}
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{meta.label}</Text>
                    {isUpgrade && <Ionicons name="arrow-forward" size={11} color="#fff" />}
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Restore purchases + legal footer */}
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        <Pressable onPress={() => void restorePurchases()}>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, textDecorationLine: "underline" }}>
            Restaurer mes achats
          </Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 11, color: Colors.mutedForeground, textAlign: "center", lineHeight: 16, marginBottom: 24 }}>
        Annule à tout moment • Paiement sécurisé
      </Text>

      {/* Fix 4 — cancel at very bottom, separated by divider, with access warning */}
      {subscription && (
        <>
          <View style={{ height: 1, backgroundColor: Colors.border, marginBottom: 20 }} />
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center", marginBottom: 12 }}>
            Tu garderas l'accès jusqu'à la fin de ta période actuelle.
          </Text>
          <Pressable
            onPress={handleCancel}
            disabled={isCancelling}
            style={{
              height: 48, borderRadius: 16,
              alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: Colors.border,
            }}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={Colors.mutedForeground} />
            ) : (
              <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.mutedForeground }}>
                Annuler mon abonnement
              </Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
