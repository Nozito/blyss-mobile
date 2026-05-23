import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

const HUB_ITEMS = [
  {
    route: "/(admin)/analytics",
    icon: "analytics-outline" as const,
    label: "Analytics",
    description: "Métriques de croissance, rétention et revenus sur la durée",
    color: "#A78BFA",
  },
  {
    route: "/(admin)/logs",
    icon: "pulse-outline" as const,
    label: "Logs Système",
    description: "Événements API, erreurs, actions utilisateurs en temps réel",
    color: "#38BDF8",
  },
  {
    route: "/(admin)/notifications",
    icon: "notifications-outline" as const,
    label: "Notifications",
    description: "Envoyer des notifications push ciblées à pros et clients",
    color: "#4ADE80",
  },
  {
    route: "/(admin)/coupons",
    icon: "pricetag-outline" as const,
    label: "Coupons",
    description: "Créer et gérer les codes promo, remises et offres spéciales",
    color: ACCENT,
  },
];

export default function AdminMoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>Plus</Text>
      <Text style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>Outils avancés d'administration</Text>

      {/* Admin identity card */}
      <LinearGradient
        colors={["rgba(249,115,22,0.14)", "rgba(249,115,22,0.04)", "transparent"]}
        style={{ borderRadius: 20, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", padding: 18, marginBottom: 28, flexDirection: "row", alignItems: "center", gap: 14 }}
      >
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(249,115,22,0.2)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: ACCENT }}>
            {user?.first_name?.[0]?.toUpperCase() ?? "A"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT }}>{user?.first_name} {user?.last_name}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{user?.email}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.15)" }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: ACCENT, letterSpacing: 1 }}>ADMIN</Text>
        </View>
      </LinearGradient>

      {/* Hub cards */}
      <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14, paddingHorizontal: 2 }}>
        Outils
      </Text>
      <View style={{ gap: 12, marginBottom: 32 }}>
        {HUB_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [{
              backgroundColor: CARD, borderRadius: 20, padding: 18,
              borderWidth: 1, borderColor: pressed ? `${item.color}30` : BORDER,
              flexDirection: "row", alignItems: "center", gap: 16,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: `${item.color}15`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT, marginBottom: 4 }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: MUTED, lineHeight: 17 }}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={MUTED} />
          </Pressable>
        ))}
      </View>

      {/* App info */}
      <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Informations</Text>
        {[
          { label: "Application", value: "Blyss Admin" },
          { label: "Plateforme", value: "React Native / Expo" },
          { label: "Backend", value: process.env.EXPO_PUBLIC_API_URL ?? "—" },
        ].map(({ label, value }) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <Text style={{ fontSize: 13, color: MUTED }}>{label}</Text>
            <Text numberOfLines={1} style={{ maxWidth: 200, fontSize: 13, fontWeight: "600", color: TEXT }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Logout */}
      <Pressable
        onPress={() => logout()}
        style={{ height: 52, borderRadius: 16, backgroundColor: "rgba(248,113,113,0.10)", borderWidth: 1, borderColor: "rgba(248,113,113,0.25)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
      >
        <Ionicons name="log-out-outline" size={20} color="#F87171" />
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#F87171" }}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
