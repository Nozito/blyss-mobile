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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { proApi } from "@/lib/api";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";

const PLAN_META: Record<RCPlan, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  start:     { label: "Start",      icon: "flash-outline",     color: Colors.primary },
  serenite:  { label: "Sérénité",   icon: "heart-outline",     color: Colors.pro },
  signature: { label: "Signature",  icon: "sparkles-outline",  color: Colors.secondary },
};

export default function ProSubscriptionSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);

  // activePlan from RC is the source of truth for current plan state
  const { activePlan, packages } = useRevenueCat();

  // proApi.getSubscription() only for display details (endDate, status)
  const { data, isLoading } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
  });

  const cancelMutation = useMutation({
    mutationFn: () => proApi.cancelSubscription(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-subscription"] });
      Alert.alert("Annulé", "Ton abonnement a été annulé. L'accès reste actif jusqu'à la fin de la période en cours.");
    },
    onError: () => Alert.alert("Erreur", "Impossible d'annuler l'abonnement pour l'instant."),
  });

  const subscription = data?.data;

  const handleUpgrade = async (planId: RCPlan) => {
    if (planId === activePlan) return;
    setIsChanging(true);
    try {
      await proApi.updateSubscription({ plan: planId });
      qc.invalidateQueries({ queryKey: ["pro-subscription"] });
      router.push({
        pathname: "/(pro)/(profile)/subscription-success" as any,
        params: { plan: planId, isUpgrade: "true" },
      });
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
        { text: "Oui, annuler", style: "destructive", onPress: () => cancelMutation.mutate() },
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

      {/* Current plan card */}
      {activePlan && (
        <View style={{
          backgroundColor: Colors.card, borderRadius: 20,
          borderWidth: 2, borderColor: `${PLAN_META[activePlan].color}40`,
          padding: 18, marginBottom: 20,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: "800", color: Colors.mutedForeground,
            textTransform: "uppercase", letterSpacing: 1, marginBottom: 12,
          }}>
            Plan actuel
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: subscription?.endDate ? 10 : 0 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: `${PLAN_META[activePlan].color}18`,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name={PLAN_META[activePlan].icon} size={22} color={PLAN_META[activePlan].color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground }}>
                Formule {PLAN_META[activePlan].label}
              </Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                {packages.find((p) => p.key === activePlan)?.priceString ?? "—"}/mois
              </Text>
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
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
              Renouvellement le {new Date(subscription.endDate).toLocaleDateString("fr-FR")}
            </Text>
          )}
        </View>
      )}

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
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
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
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
                    {rcPkg ? `${rcPkg.priceString}/mois` : "—"}
                  </Text>
                </View>
                {isCurrent ? (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: `${meta.color}18` }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: meta.color }}>Actuel</Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: meta.color }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>Choisir</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Cancel */}
      {subscription && (
        <Pressable
          onPress={handleCancel}
          disabled={cancelMutation.isPending}
          style={{
            height: 48, borderRadius: 16,
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: Colors.border,
          }}
        >
          {cancelMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.mutedForeground} />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.mutedForeground }}>
              Annuler mon abonnement
            </Text>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}
