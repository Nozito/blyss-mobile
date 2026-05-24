import React, { useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Animated, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Colors } from "@/constants/colors";

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";

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
          backgroundColor: Colors.card, borderRadius: 18, padding: 18,
          borderWidth: 1, borderColor: pressed ? `${item.color}35` : A_BORDER,
          opacity: pressed ? 0.85 : 1, aspectRatio: 1, justifyContent: "space-between",
          shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
        }]}
      >
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${item.color}12`, alignItems: "center", justifyContent: "center" }}>
          {Platform.OS === "ios"
            ? <SymbolView name={item.symbol} size={26} tintColor={item.color} />
            : <Ionicons name={item.icon} size={26} color={item.color} />}
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
      style={{ flex: 1, backgroundColor: A_BG }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Admin identity card — LinearGradient hero */}
      <Animated.View style={{
        borderRadius: 20, overflow: "hidden", marginBottom: 28,
        shadowColor: "#EA6000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 4,
        opacity: identityOpacity, transform: [{ translateY: identityTranslateY }],
      }}>
        <LinearGradient
          colors={["#EA6000", "#F97316", "#FBAB6A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <View style={{ position: "absolute", top: -24, right: -24, width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.10)" }} />
          {/* Avatar — white gradient */}
          <LinearGradient
            colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0.15)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 52, height: 52, borderRadius: 15, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 20, fontWeight: "900", color: Colors.white }}>
              {user?.first_name?.[0]?.toUpperCase() ?? "A"}
            </Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.white }}>{user?.first_name} {user?.last_name}</Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{user?.email}</Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.20)" }}>
            <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.white, letterSpacing: 1 }}>ADMIN</Text>
          </View>
        </LinearGradient>
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
      <View style={{ backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: A_BORDER, marginBottom: 24, overflow: "hidden",
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
        {INFO_ROWS.map(({ label, value }, i) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < INFO_ROWS.length - 1 ? 1 : 0, borderBottomColor: A_BORDER }}>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>{label}</Text>
            <Text numberOfLines={1} style={{ maxWidth: 200, fontSize: 13, fontWeight: "600", color: Colors.foreground }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Logout — Colors.card row with icon square */}
      <View style={{ backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: A_BORDER, overflow: "hidden",
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            logout();
          }}
          style={({ pressed }) => [{
            flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14,
            opacity: pressed ? 0.75 : 1,
          }]}
        >
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.destructive}10`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="log-out-outline" size={18} color={Colors.destructive} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.destructive }}>Se déconnecter</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
