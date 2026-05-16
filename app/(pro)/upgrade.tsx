import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

type PlanId = "start" | "serenite" | "signature";

const PLAN_LABELS: Record<PlanId, string> = {
  start: "Start",
  serenite: "Sérénité",
  signature: "Signature",
};

const PLAN_PRICES: Record<PlanId, string> = {
  start: "49,90 €/mois",
  serenite: "39,90 €/mois",
  signature: "29,90 €/mois",
};

const PLAN_FEATURES: Record<PlanId, string[]> = {
  start: ["Dashboard activité", "Agenda intelligent", "Gestion clientes", "Profil public"],
  serenite: ["Tout Start inclus", "Module finance & statistiques", "Portfolio photos", "Rappels automatiques"],
  signature: ["Tout Sérénité inclus", "Paiements en ligne", "Visibilité premium", "Rappels post-prestation"],
};

const PLAN_GRADIENT_COLORS: Record<PlanId, [string, string]> = {
  start: [Colors.primary, "#FF80B8"],
  serenite: [Colors.pro, "#A78BFA"],
  signature: [Colors.secondary, "#D9A870"],
};

const PLAN_ICONS: Record<PlanId, keyof typeof Ionicons.glyphMap> = {
  start: "flash-outline",
  serenite: "heart-outline",
  signature: "sparkles-outline",
};

export default function ProUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Default to serenite as most common upgrade target
  const requiredPlan: PlanId = "serenite";
  const [gradStart, gradEnd] = PLAN_GRADIENT_COLORS[requiredPlan];
  const features = PLAN_FEATURES[requiredPlan];

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12 }}
        className="bg-background border-b border-border"
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.push("/(pro)/dashboard")}
            className="p-2 -ml-2 rounded-xl"
            style={{ backgroundColor: Colors.muted }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.foreground} />
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Upgrade requis</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient hero block */}
        <View
          className="rounded-3xl overflow-hidden mb-6"
        >
          <View
            className="px-6 py-8 items-center"
            style={{ backgroundColor: gradStart }}
          >
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <Ionicons name="lock-closed-outline" size={28} color={Colors.white} />
            </View>
            <Text className="text-xl font-bold text-white mb-2 text-center">
              Fonctionnalité non incluse
            </Text>
            <Text className="text-white/80 text-sm text-center leading-relaxed">
              Cette page nécessite le plan{" "}
              <Text className="font-bold text-white">{PLAN_LABELS[requiredPlan]}</Text>.{"\n"}
              Ton abonnement actuel ne comprend pas cet accès.
            </Text>
          </View>
        </View>

        {/* Target plan card */}
        <View
          className="bg-card rounded-2xl p-5 border border-border mb-4"
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center gap-3 mb-4">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: gradStart }}
            >
              <Ionicons name={PLAN_ICONS[requiredPlan]} size={18} color={Colors.white} />
            </View>
            <View>
              <Text className="font-bold text-foreground">Formule {PLAN_LABELS[requiredPlan]}</Text>
              <Text className="text-sm text-muted-foreground">{PLAN_PRICES[requiredPlan]}</Text>
            </View>
          </View>

          <View className="gap-3">
            {features.map((feature, idx) => (
              <View
                key={idx}
                className="flex-row items-center gap-3"
              >
                <View
                  className="w-5 h-5 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${gradStart}18` }}
                >
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: gradStart }} />
                </View>
                <Text className="text-sm text-foreground flex-1">{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA buttons */}
        <View className="gap-3">
          <Pressable
            onPress={() => router.push("/(pro)/subscription")}
            className="h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: gradStart }}
          >
            <Text className="text-white font-bold text-base">
              Passer au plan {PLAN_LABELS[requiredPlan]}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(pro)/dashboard")}
            className="h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: Colors.muted }}
          >
            <Text className="text-foreground font-semibold text-sm">
              Retour au tableau de bord
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
