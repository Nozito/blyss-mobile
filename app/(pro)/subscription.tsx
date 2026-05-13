import React from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { proApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

const PLAN_CONFIG = {
  start: {
    label: "Start",
    price: "49,90 €/mois",
    color: Colors.primary,
    features: ["Dashboard", "Agenda", "Clientes", "Prestations", "Profil public"],
  },
  serenite: {
    label: "Sérénité",
    price: "39,90 €/mois",
    color: Colors.pro,
    features: [
      "Tout Start",
      "Portfolio Instagram",
      "Rappels automatiques",
      "Statistiques",
      "Facturation",
    ],
  },
  signature: {
    label: "Signature",
    price: "29,90 €/mois",
    color: Colors.secondary,
    features: [
      "Tout Sérénité",
      "Suivi post-prestation",
      "Paiements en ligne",
      "Support prioritaire",
    ],
  },
} as const;

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
  });

  const cancelMutation = useMutation({
    mutationFn: () => proApi.cancelSubscription(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-subscription"] }),
  });

  const subscription = data?.data;

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
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Abonnement
        </Text>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Current plan */}
          {subscription ? (
            <Card
              elevated
              className="mb-6 p-5"
              style={{ borderWidth: 2, borderColor: Colors.primary }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lg font-bold text-foreground">
                  Plan {PLAN_CONFIG[subscription.plan]?.label ?? subscription.plan}
                </Text>
                <Badge
                  variant={subscription.status === "active" ? "success" : "warning"}
                  size="sm"
                >
                  {subscription.status === "active" ? "Actif" : subscription.status}
                </Badge>
              </View>
              <Text className="text-2xl font-bold text-primary mb-3">
                {subscription.monthlyPrice.toFixed(2)} €/mois
              </Text>
              {subscription.endDate && (
                <Text className="text-sm text-muted-foreground">
                  Expire le {new Date(subscription.endDate).toLocaleDateString("fr-FR")}
                </Text>
              )}
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onPress={() =>
                  Alert.alert(
                    "Annuler l'abonnement",
                    "Êtes-vous sûr de vouloir annuler votre abonnement ?",
                    [
                      { text: "Non", style: "cancel" },
                      {
                        text: "Confirmer",
                        style: "destructive",
                        onPress: () => cancelMutation.mutate(),
                      },
                    ]
                  )
                }
                style={{ marginTop: 12 }}
              >
                Annuler l'abonnement
              </Button>
            </Card>
          ) : (
            <View className="bg-warning/10 rounded-2xl p-4 mb-6">
              <Text className="text-warning font-semibold">
                Aucun abonnement actif
              </Text>
              <Text className="text-sm text-muted-foreground mt-1">
                Choisissez un plan pour accéder à toutes les fonctionnalités
              </Text>
            </View>
          )}

          {/* Plan cards */}
          {(Object.entries(PLAN_CONFIG) as Array<[keyof typeof PLAN_CONFIG, typeof PLAN_CONFIG[keyof typeof PLAN_CONFIG]]>).map(
            ([key, plan]) => {
              const isCurrentPlan = subscription?.plan === key;
              return (
                <Card
                  key={key}
                  elevated
                  className="mb-4"
                  style={isCurrentPlan ? { borderWidth: 2, borderColor: plan.color } : {}}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-lg font-bold text-foreground">
                          {plan.label}
                        </Text>
                        {isCurrentPlan && (
                          <Badge variant="default" size="sm">Actuel</Badge>
                        )}
                      </View>
                      <Text className="text-xl font-bold mt-0.5" style={{ color: plan.color }}>
                        {plan.price}
                      </Text>
                    </View>
                    <View
                      className="w-10 h-10 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: `${plan.color}15` }}
                    >
                      <Ionicons name="diamond-outline" size={20} color={plan.color} />
                    </View>
                  </View>

                  {plan.features.map((f) => (
                    <View key={f} className="flex-row items-center gap-2 mb-1.5">
                      <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                      <Text className="text-sm text-foreground">{f}</Text>
                    </View>
                  ))}
                </Card>
              );
            }
          )}
        </>
      )}
    </ScrollView>
  );
}
