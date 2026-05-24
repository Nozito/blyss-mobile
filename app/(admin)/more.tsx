import React, { useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";

const TOOLS = [
  { key: "analytics", label: "Analytics", sub: "Métriques & revenus",  icon: "bar-chart"     as const, color: Colors.pro,     route: "/(admin)/analytics" },
  { key: "logs",      label: "Logs",      sub: "Événements système",   icon: "pulse"         as const, color: Colors.info,    route: "/(admin)/logs" },
  { key: "notifs",    label: "Notifs",    sub: "Push ciblées",         icon: "notifications" as const, color: Colors.success, route: "/(admin)/notifications" },
  { key: "coupons",   label: "Coupons",   sub: "Codes promo",          icon: "pricetag"      as const, color: Colors.warning, route: "/(admin)/coupons" },
];

const INFO_ROWS = [
  { label: "Application", value: "Blyss Admin" },
  { label: "Plateforme",  value: "React Native / Expo" },
  { label: "Backend",     value: process.env.EXPO_PUBLIC_API_URL ?? "—" },
] as const;

export default function AdminMoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const router = useRouter();

  const { data: dashData } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboard(),
    staleTime: 5 * 60_000,
  });

  const d = (dashData?.data as any) ?? {};

  const profileOpacity    = useRef(new Animated.Value(0)).current;
  const profileTranslateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(profileOpacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(profileTranslateY, { toValue: 0, damping: 18, stiffness: 160, useNativeDriver: true }),
    ]).start();
  }, []);

  const fullName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const initials = fullName.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  const stats = [
    { label: "Utilisateurs", value: d?.stats?.total_users ?? "—", icon: "people-outline" as const,  color: Colors.pro },
    { label: "RDV du mois",  value: d?.stats?.bookings_month ?? "—", icon: "calendar-outline" as const, color: Colors.info },
    { label: "CA du mois",   value: d?.stats?.revenue_month ? `${Number(d.stats.revenue_month).toFixed(0)}€` : "—", icon: "wallet-outline" as const, color: Colors.admin },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: A_BG }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero profile card ── */}
      <Animated.View style={{ opacity: profileOpacity, transform: [{ translateY: profileTranslateY }], marginBottom: 20 }}>
        <LinearGradient
          colors={["#EA6000", "#F97316", "#FBAB6A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 24, paddingBottom: 40, paddingHorizontal: 24, alignItems: "center" }}
        >
          {/* Decoration circles */}
          <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ position: "absolute", bottom: 20, left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.05)" }} />

          {/* Avatar */}
          <LinearGradient
            colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0.15)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.5)" }}
          >
            <Text style={{ fontSize: 34, fontWeight: "900", color: "#fff" }}>{initials || "A"}</Text>
          </LinearGradient>

          <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.4, marginBottom: 4 }}>{fullName || "Admin"}</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", marginBottom: 14 }}>{user?.email}</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 1 }}>⚡ ADMIN</Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>Accès total</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats strip — floats over the gradient */}
        <View style={{ marginHorizontal: 20, marginTop: -24, backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: A_BORDER, padding: 16, flexDirection: "row",
          shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 6 }}>
          {stats.map(({ label, value, icon, color }, i) => (
            <View key={label} style={{ flex: 1, alignItems: "center", borderRightWidth: i < stats.length - 1 ? 1 : 0, borderRightColor: A_BORDER }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${color}12`, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <Ionicons name={icon} size={16} color={color} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.foreground }}>{value}</Text>
              <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 1 }}>{label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={{ paddingHorizontal: 20 }}>
        {/* ── Outils ── */}
        <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 14 }}>
          Outils admin
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.key}
              onPress={() => router.push(tool.route as any)}
              style={({ pressed }) => [{
                width: "47%",
                backgroundColor: Colors.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: A_BORDER,
                padding: 18,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
                opacity: pressed ? 0.85 : 1,
              }]}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${tool.color}14`, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Ionicons name={tool.icon} size={22} color={tool.color} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.foreground, marginBottom: 3 }}>{tool.label}</Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{tool.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Logout ── */}
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            logout();
          }}
          style={({ pressed }) => [{
            backgroundColor: `${Colors.destructive}0A`,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: `${Colors.destructive}25`,
            paddingHorizontal: 16,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            marginBottom: 28,
            opacity: pressed ? 0.75 : 1,
          }]}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${Colors.destructive}14`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.destructive, flex: 1 }}>Se déconnecter</Text>
        </Pressable>

        {/* ── App info ── */}
        <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 14 }}>
          À propos
        </Text>
        <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: A_BORDER, marginBottom: 24, overflow: "hidden" }}>
          {INFO_ROWS.map(({ label, value }, i) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: i < INFO_ROWS.length - 1 ? 1 : 0, borderBottomColor: A_BORDER }}>
              <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>{label}</Text>
              <Text numberOfLines={1} style={{ maxWidth: 200, fontSize: 13, fontWeight: "700", color: Colors.foreground }}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
