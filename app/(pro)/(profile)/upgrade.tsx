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
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";

const PLAN_META: Record<RCPlan, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  features: string[];
}> = {
  start: {
    label: "Start",
    icon: "flash-outline",
    color: Colors.primary,
    features: ["Dashboard activité", "Agenda intelligent", "Gestion clientes", "Profil public"],
  },
  serenite: {
    label: "Sérénité",
    icon: "heart-outline",
    color: Colors.pro,
    features: ["Tout Start inclus", "Module finance & statistiques", "Portfolio photos", "Rappels automatiques"],
  },
  signature: {
    label: "Signature",
    icon: "sparkles-outline",
    color: Colors.secondary,
    features: ["Tout Sérénité inclus", "Paiements en ligne", "Visibilité premium", "Rappels post-prestation"],
  },
};

export default function ProUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { packages } = useRevenueCat();

  const requiredPlan: RCPlan = "serenite";
  const meta = PLAN_META[requiredPlan];
  const rcPkg = packages.find((p) => p.key === requiredPlan);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 12,
        backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border,
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        <Pressable
          onPress={() => router.push("/(pro)/dashboard")}
          style={{ padding: 8, marginLeft: -8, borderRadius: 12, backgroundColor: Colors.muted }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.foreground} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: Colors.foreground }}>
          Upgrade requis
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{
          borderRadius: 24, overflow: "hidden", marginBottom: 20,
          backgroundColor: meta.color,
          padding: 32, alignItems: "center",
        }}>
          <View style={{
            width: 64, height: 64, borderRadius: 16, marginBottom: 16,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="lock-closed-outline" size={28} color={Colors.white} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.white, marginBottom: 8, textAlign: "center" }}>
            Fonctionnalité non incluse
          </Text>
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 20 }}>
            Cette page nécessite le plan{" "}
            <Text style={{ fontWeight: "800", color: Colors.white }}>{meta.label}</Text>.{"\n"}
            Ton abonnement actuel ne comprend pas cet accès.
          </Text>
        </View>

        {/* Target plan card */}
        <View style={{
          backgroundColor: Colors.card, borderRadius: 20, padding: 20,
          borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
          shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: meta.color,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name={meta.icon} size={18} color={Colors.white} />
            </View>
            <View>
              <Text style={{ fontWeight: "700", fontSize: 15, color: Colors.foreground }}>
                Formule {meta.label}
              </Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                {rcPkg ? `${rcPkg.priceString}/mois` : "—"}
              </Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            {meta.features.map((feature) => (
              <View key={feature} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: `${meta.color}18`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} />
                </View>
                <Text style={{ fontSize: 13, color: Colors.foreground, flex: 1 }}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTAs */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push("/(pro)/(profile)/subscription")}
            style={{
              height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
              backgroundColor: meta.color,
              shadowColor: meta.color, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: "800", fontSize: 15 }}>
              Passer au plan {meta.label}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(pro)/dashboard")}
            style={{
              height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center",
              backgroundColor: Colors.muted,
            }}
          >
            <Text style={{ color: Colors.foreground, fontWeight: "600", fontSize: 14 }}>
              Retour au tableau de bord
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
