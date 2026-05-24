import React, { useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";

const BG     = "#0B0E14";
const CARD   = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT   = "#F8FAFC";
const MUTED  = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

const GRID_ITEMS = [
  { route: "/(admin)/analytics",     icon: "analytics-outline"    as const, label: "Analytics", description: "Métriques & revenus",    color: "#A78BFA" },
  { route: "/(admin)/logs",          icon: "pulse-outline"        as const, label: "Logs",      description: "Événements système",     color: "#38BDF8" },
  { route: "/(admin)/notifications", icon: "notifications-outline" as const, label: "Notifs",   description: "Push ciblées",           color: "#4ADE80" },
  { route: "/(admin)/coupons",       icon: "pricetag-outline"     as const, label: "Coupons",   description: "Codes promo",            color: ACCENT },
] as const;

const INFO_ROWS = [
  { label: "Application", value: "Blyss Admin" },
  { label: "Plateforme",  value: "React Native / Expo" },
  { label: "Backend",     value: process.env.EXPO_PUBLIC_API_URL ?? "—" },
] as const;

function GridCard({ item, index }: { item: typeof GRID_ITEMS[number]; index: number }) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 80),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(scale,   { toValue: 1, damping: 16, stiffness: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, minWidth: 140, opacity, transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push(item.route as any);
        }}
        style={({ pressed }) => [{
          backgroundColor: CARD, borderRadius: 22, padding: 18,
          borderWidth: 1, borderColor: pressed ? `${item.color}35` : BORDER,
          opacity: pressed ? 0.85 : 1, aspectRatio: 1, justifyContent: "space-between",
        }]}
      >
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${item.color}18`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT, marginBottom: 3 }}>{item.label}</Text>
          <Text style={{ fontSize: 11, color: MUTED, lineHeight: 15 }}>{item.description}</Text>
        </View>
        <View style={{ position: "absolute", top: 14, right: 14 }}>
          <Ionicons name="chevron-forward" size={14} color={MUTED} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AdminMoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const identityOpacity    = useRef(new Animated.Value(0)).current;
  const identityTranslateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(identityOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(identityTranslateY, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Admin identity card */}
      <Animated.View style={{
        borderRadius: 22, borderWidth: 1, borderColor: "rgba(249,115,22,0.22)",
        backgroundColor: "rgba(249,115,22,0.07)", padding: 18,
        flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 28,
        opacity: identityOpacity, transform: [{ translateY: identityTranslateY }],
      }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1.5, borderColor: "rgba(249,115,22,0.3)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: ACCENT }}>
            {user?.first_name?.[0]?.toUpperCase() ?? "A"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT }}>{user?.first_name} {user?.last_name}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{user?.email}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.18)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", color: ACCENT, letterSpacing: 1 }}>ADMIN</Text>
        </View>
      </Animated.View>

      {/* 2×2 Grid */}
      <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 }}>
        Outils
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        {GRID_ITEMS.map((item, i) => (
          <GridCard key={item.route} item={item} index={i} />
        ))}
      </View>

      {/* App info */}
      <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>
        Informations
      </Text>
      <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, marginBottom: 24, overflow: "hidden" }}>
        {INFO_ROWS.map(({ label, value }, i) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < INFO_ROWS.length - 1 ? 1 : 0, borderBottomColor: BORDER }}>
            <Text style={{ fontSize: 13, color: MUTED }}>{label}</Text>
            <Text numberOfLines={1} style={{ maxWidth: 200, fontSize: 13, fontWeight: "600", color: TEXT }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Logout */}
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          logout();
        }}
        style={({ pressed }) => [{
          height: 54, borderRadius: 16, backgroundColor: "rgba(248,113,113,0.10)",
          borderWidth: 1, borderColor: "rgba(248,113,113,0.22)",
          alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10,
          opacity: pressed ? 0.75 : 1,
        }]}
      >
        <Ionicons name="log-out-outline" size={20} color="#F87171" />
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#F87171" }}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
