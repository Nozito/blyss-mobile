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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { proApi } from "@/lib/api";

type PlanId = "start" | "serenite" | "signature";

const PLANS: Array<{
  id: PlanId;
  label: string;
  price: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  features: string[];
}> = [
  {
    id: "start",
    label: "Start",
    price: "49,90 €/mois",
    color: Colors.primary,
    icon: "flash-outline",
    features: ["Dashboard", "Agenda", "Clientes", "Profil public"],
  },
  {
    id: "serenite",
    label: "Sérénité",
    price: "39,90 €/mois",
    color: Colors.pro,
    icon: "heart-outline",
    features: ["Tout Start", "Finance & stats", "Portfolio photos", "Rappels auto"],
  },
  {
    id: "signature",
    label: "Signature",
    price: "29,90 €/mois",
    color: Colors.secondary,
    icon: "sparkles-outline",
    features: ["Tout Sérénité", "Paiements en ligne", "Visibilité premium", "Support prioritaire"],
  },
];

export default function ProSubscriptionSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);

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
  const currentPlanId = subscription?.plan as PlanId | undefined;

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === currentPlanId) return;
    setIsChanging(true);
    try {
      await proApi.updateSubscription?.({ plan: planId });
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
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center mb-2">
          <AnimatedIconButton
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-muted items-center justify-center mr-3"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <Text className="text-2xl font-bold text-foreground">Mon abonnement</Text>
        </View>
        <Text className="text-sm text-muted-foreground ml-1">
          Gérer ton plan Blyss Pro
        </Text>
      </View>

      {/* Current plan */}
      {subscription && currentPlanId && (
        <View
          className="bg-card rounded-2xl p-5 border border-border mb-6"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
            borderColor: PLANS.find((p) => p.id === currentPlanId)?.color + "40",
            borderWidth: 2,
          }}
        >
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Plan actuel
          </Text>
          <View className="flex-row items-center gap-3 mb-3">
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${PLANS.find((p) => p.id === currentPlanId)?.color}18` }}
            >
              <Ionicons
                name={PLANS.find((p) => p.id === currentPlanId)?.icon ?? "flash-outline"}
                size={22}
                color={PLANS.find((p) => p.id === currentPlanId)?.color}
              />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-foreground">
                Formule {PLANS.find((p) => p.id === currentPlanId)?.label}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {PLANS.find((p) => p.id === currentPlanId)?.price}
              </Text>
            </View>
            <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" }}>
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#22C55E" }} />
                <Text className="text-xs font-bold" style={{ color: "#15803D" }}>Actif</Text>
              </View>
            </View>
          </View>
          {subscription.endDate && (
            <Text className="text-xs text-muted-foreground">
              Renouvellement le {new Date(subscription.endDate).toLocaleDateString("fr-FR")}
            </Text>
          )}
        </View>
      )}

      {/* Change plan */}
      <View className="mb-6">
        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Changer de formule
        </Text>
        <View className="gap-3">
          {PLANS.map((plan, idx) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <View
                key={plan.id}
              >
                <Pressable
                  onPress={() => !isCurrent && handleUpgrade(plan.id)}
                  disabled={isCurrent || isChanging}
                  className="bg-card rounded-2xl p-4 border"
                  style={{
                    borderColor: isCurrent ? plan.color : Colors.border,
                    borderWidth: isCurrent ? 2 : 1,
                    opacity: isChanging ? 0.7 : 1,
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${plan.color}18` }}
                    >
                      <Ionicons name={plan.icon} size={18} color={plan.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-foreground">{plan.label}</Text>
                      <Text className="text-xs text-muted-foreground">{plan.price}</Text>
                    </View>
                    {isCurrent ? (
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: `${plan.color}18` }}>
                        <Text className="text-xs font-bold" style={{ color: plan.color }}>Actuel</Text>
                      </View>
                    ) : (
                      <View
                        className="px-3 py-1 rounded-full items-center justify-center"
                        style={{ backgroundColor: plan.color }}
                      >
                        <Text className="text-xs font-bold text-white">Choisir</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {/* Cancel subscription */}
      {subscription && (
        <View>
          <Pressable
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
            className="h-12 rounded-2xl items-center justify-center border border-border"
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.mutedForeground} />
            ) : (
              <Text className="text-sm font-semibold text-muted-foreground">Annuler mon abonnement</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
