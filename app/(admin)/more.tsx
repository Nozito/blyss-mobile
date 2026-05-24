import React, { useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Animated, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Colors } from "@/constants/colors";

const GRID_ITEMS = [
  { route: "/(admin)/analytics",     icon: "analytics-outline"     as const, symbol: "chart.bar.xaxis" as const, label: "Analytics", description: "Métriques & revenus",    color: Colors.pro },
  { route: "/(admin)/logs",          icon: "pulse-outline"         as const, symbol: "waveform"        as const, label: "Logs",      description: "Événements système",     color: Colors.info },
  { route: "/(admin)/notifications", icon: "notifications-outline" as const, symbol: "bell"            as const, label: "Notifs",    description: "Push ciblées",           color: Colors.success },
  { route: "/(admin)/coupons",       icon: "pricetag-outline"      as const, symbol: "tag"             as const, label: "Coupons",   description: "Codes promo",            color: Colors.admin },
];

const INFO_ROWS = [
  { label: "Application", value: "Blyss Admin" },
  { label: "Plateforme",  value: "React Native / Expo" },
  { label: "Backend",     value: process.env.EXPO_PUBLIC_API_URL ?? "—" },
] as const;

type GridItem = { route: string; icon: React.ComponentProps<typeof Ionicons>["name"]; symbol: string; label: string; description: string; color: string };
function GridCard({ item, index }: { item: GridItem; index: number }) {
  const router  = useRouter();
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
          backgroundColor: Colors.card, borderRadius: 12, padding: 18,
          borderWidth: 1, borderColor: pressed ? `${item.color}35` : Colors.border,
          opacity: pressed ? 0.85 : 1, aspectRatio: 1, justifyContent: "space-between",
          shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
        }]}
      >
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${item.color}12`, alignItems: "center", justifyContent: "center" }}>
          {Platform.OS === "ios"
            ? <SymbolView name={item.symbol} size={24} tintColor={item.color} />
            : <Ionicons name={item.icon} size={24} color={item.color} />}
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground, marginBottom: 3 }}>{item.label}</Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground, lineHeight: 15 }}>{item.description}</Text>
        </View>
        <View style={{ position: "absolute", top: 14, right: 14 }}>
          <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />
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
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Admin identity card */}
      <Animated.View style={{
        borderRadius: 16, borderWidth: 1, borderColor: `${Colors.admin}33`,
        backgroundColor: `${Colors.admin}0A`, padding: 18,
        flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 28,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
        opacity: identityOpacity, transform: [{ translateY: identityTranslateY }],
      }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.admin, alignItems: "center", justifyContent: "center", shadowColor: Colors.admin, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>
            {user?.first_name?.[0]?.toUpperCase() ?? "A"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground }}>{user?.first_name} {user?.last_name}</Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{user?.email}</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: `${Colors.admin}18` }}>
          <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.admin, letterSpacing: 1 }}>ADMIN</Text>
        </View>
      </Animated.View>

      {/* 2×2 Grid */}
      <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 }}>
        Outils
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        {GRID_ITEMS.map((item, i) => (
          <GridCard key={item.route} item={item} index={i} />
        ))}
      </View>

      {/* App info */}
      <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>
        Informations
      </Text>
      <View style={{ backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 24, overflow: "hidden",
        shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
        {INFO_ROWS.map(({ label, value }, i) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < INFO_ROWS.length - 1 ? 1 : 0, borderBottomColor: Colors.border }}>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>{label}</Text>
            <Text numberOfLines={1} style={{ maxWidth: 200, fontSize: 13, fontWeight: "600", color: Colors.foreground }}>{value}</Text>
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
          height: 54, borderRadius: 16, backgroundColor: `${Colors.destructive}10`,
          borderWidth: 1, borderColor: `${Colors.destructive}28`,
          alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10,
          opacity: pressed ? 0.75 : 1,
        }]}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.destructive }}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
