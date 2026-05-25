import React, { useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Animated, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";

const A_BG     = ADMIN.bg;
const A_BORDER = ADMIN.border;

const TOOLS = [
  { key: "analytics", label: "Analytics", sub: "Métriques & revenus",  symbol: "chart.bar.fill",                        color: Colors.pro,     route: "/(admin)/analytics" },
  { key: "logs",      label: "Logs",      sub: "Événements système",   symbol: "waveform",                              color: Colors.info,    route: "/(admin)/logs" },
  { key: "notifs",    label: "Notifs",    sub: "Push ciblées",         symbol: "bell.fill",                             color: Colors.success, route: "/(admin)/notifications" },
  { key: "coupons",   label: "Coupons",   sub: "Codes promo",          symbol: "tag.fill",                              color: Colors.warning, route: "/(admin)/coupons" },
];

const INFO_ROWS = [
  { label: "Application", value: "Blyss Admin",                         icon: "apps-outline"           as const },
  { label: "Plateforme",  value: "React Native / Expo",                  icon: "phone-portrait-outline" as const },
  { label: "Backend",     value: process.env.EXPO_PUBLIC_API_URL ?? "—", icon: "server-outline"         as const },
] as const;

// ─── ToolRow ──────────────────────────────────────────────────────────────────

function ToolRow({
  tool, isLast, onPress,
}: {
  tool: typeof TOOLS[number]; isLast: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start()
      }
    >
      <Animated.View style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.07)",
        transform: [{ scale }],
      }}>
        <View style={{
          width: 46, height: 46, borderRadius: 14,
          backgroundColor: `${tool.color}18`,
          alignItems: "center", justifyContent: "center",
        }}>
          {Platform.OS === "ios" ? (
            <SymbolView name={tool.symbol as any} size={22} tintColor={tool.color} />
          ) : (
            <Ionicons name="grid-outline" size={22} color={tool.color} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{tool.label}</Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{tool.sub}</Text>
        </View>
        {Platform.OS === "ios" ? (
          <SymbolView name="chevron.right" size={14} tintColor="rgba(255,255,255,0.2)" />
        ) : (
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

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

  // Entry animation — full screen
  const screenOpacity    = useRef(new Animated.Value(0)).current;
  const screenTranslateY = useRef(new Animated.Value(20)).current;

  // Avatar entrance
  const avatarScale   = useRef(new Animated.Value(0)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;

  // Logout press
  const logoutScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenOpacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(screenTranslateY, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.spring(avatarScale,   { toValue: 1, damping: 14, stiffness: 130, useNativeDriver: true }),
      Animated.spring(avatarOpacity, { toValue: 1, damping: 14, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, []);

  const fullName = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const initials = fullName.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  const stats = [
    {
      label: "Utilisateurs",
      value: d?.stats?.total_users ?? "—",
      symbol: "person.2.fill",
      icon: "people-outline" as const,
      color: Colors.pro,
      route: "/(admin)/users",
    },
    {
      label: "RDV du mois",
      value: d?.stats?.bookings_month ?? "—",
      symbol: "calendar.fill",
      icon: "calendar-outline" as const,
      color: Colors.info,
      route: "/(admin)/bookings",
    },
    {
      label: "CA du mois",
      value: d?.stats?.revenue_month
        ? `${Number(d.stats.revenue_month).toFixed(0)}€`
        : "—",
      symbol: "banknote.fill",
      icon: "wallet-outline" as const,
      color: Colors.admin,
      route: "/(admin)/analytics",
    },
  ];

  return (
    <Animated.View style={{
      flex: 1,
      backgroundColor: A_BG,
      opacity: screenOpacity,
      transform: [{ translateY: screenTranslateY }],
    }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Profile ── */}
        <LinearGradient
          colors={["#0F0800", "#1C0F00", "#120800"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 28,
            paddingBottom: 32,
            paddingHorizontal: 24,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {/* Orb déco top-right */}
          <View style={{
            position: "absolute", top: -20, right: -20,
            width: 140, height: 140, borderRadius: 70,
            backgroundColor: "rgba(249,115,22,0.06)",
          }} />

          {/* Shield watermark */}
          {Platform.OS === "ios" && (
            <SymbolView
              name="shield.fill"
              size={100}
              tintColor="rgba(249,115,22,0.07)"
              style={{ position: "absolute", bottom: 16, right: 20 }}
            />
          )}

          {/* Avatar animé */}
          <Animated.View style={{
            opacity: avatarOpacity,
            transform: [{ scale: avatarScale }],
          }}>
            <LinearGradient
              colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.08)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 96, height: 96, borderRadius: 32,
                alignItems: "center", justifyContent: "center",
                borderWidth: 2.5, borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              <Text style={{ fontSize: 36, fontWeight: "900", color: "#fff" }}>
                {initials || "A"}
              </Text>
            </LinearGradient>
          </Animated.View>

          <Text style={{
            fontSize: 24, fontWeight: "900", color: "#fff",
            letterSpacing: -0.5, marginTop: 16, marginBottom: 4,
          }}>
            {fullName || "Admin"}
          </Text>
          <Text style={{
            fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16,
          }}>
            {user?.email}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
              backgroundColor: "rgba(249,115,22,0.25)",
              borderWidth: 1, borderColor: "rgba(249,115,22,0.45)",
            }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: "#F97316", letterSpacing: 0.5 }}>
                ⚡ ADMIN
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
            }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Accès total</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats Strip flottante ── */}
        <View style={{
          marginHorizontal: 20, marginTop: -24,
          backgroundColor: "rgba(15,8,0,0.95)",
          borderRadius: 24,
          borderWidth: 1, borderColor: "rgba(249,115,22,0.20)",
          shadowColor: "#F97316",
          shadowOpacity: 0.15,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          padding: 18,
          flexDirection: "row",
        }}>
          {stats.map(({ label, value, symbol, icon, color, route }, i) => (
            <React.Fragment key={label}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push(route as any);
                }}
                style={{ flex: 1, alignItems: "center" }}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 14,
                  backgroundColor: `${color}18`,
                  alignItems: "center", justifyContent: "center",
                }}>
                  {Platform.OS === "ios" ? (
                    <SymbolView name={symbol as any} size={18} tintColor={color} />
                  ) : (
                    <Ionicons name={icon} size={18} color={color} />
                  )}
                </View>
                <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff", marginTop: 8 }}>
                  {value}
                </Text>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {label}
                </Text>
              </Pressable>
              {i < stats.length - 1 && (
                <View style={{
                  width: 1,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  alignSelf: "stretch",
                  marginVertical: 4,
                }} />
              )}
            </React.Fragment>
          ))}
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* ── Outils Admin ── */}
          <Text style={{
            fontSize: 11, fontWeight: "800",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: 1.8,
            textTransform: "uppercase",
            marginBottom: 14,
            marginTop: 28,
          }}>
            Outils Admin
          </Text>

          <View style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            {TOOLS.map((tool, i) => (
              <ToolRow
                key={tool.key}
                tool={tool}
                isLast={i === TOOLS.length - 1}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  router.push(tool.route as any);
                }}
              />
            ))}
          </View>

          {/* ── Bouton déconnexion ── */}
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              logout();
            }}
            onPressIn={() =>
              Animated.spring(logoutScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
            }
            onPressOut={() =>
              Animated.spring(logoutScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start()
            }
            style={{ marginTop: 16 }}
          >
            <Animated.View style={{
              backgroundColor: "rgba(240,58,58,0.10)",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(240,58,58,0.22)",
              paddingHorizontal: 18,
              paddingVertical: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              transform: [{ scale: logoutScale }],
            }}>
              <View style={{
                width: 46, height: 46, borderRadius: 14,
                backgroundColor: "rgba(240,58,58,0.15)",
                alignItems: "center", justifyContent: "center",
              }}>
                {Platform.OS === "ios" ? (
                  <SymbolView
                    name="rectangle.portrait.and.arrow.right"
                    size={22}
                    tintColor="#F03A3A"
                  />
                ) : (
                  <Ionicons name="log-out-outline" size={22} color="#F03A3A" />
                )}
              </View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#F03A3A", flex: 1 }}>
                Se déconnecter
              </Text>
            </Animated.View>
          </Pressable>

          {/* ── À propos ── */}
          <Text style={{
            fontSize: 11, fontWeight: "800",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: 1.8,
            textTransform: "uppercase",
            marginBottom: 14,
            marginTop: 28,
          }}>
            À propos
          </Text>

          <View style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            {INFO_ROWS.map(({ label, value, icon }, i) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 18,
                  paddingVertical: 15,
                  borderBottomWidth: i < INFO_ROWS.length - 1 ? 1 : 0,
                  borderBottomColor: "rgba(255,255,255,0.07)",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons name={icon} size={18} color="rgba(255,255,255,0.35)" />
                  </View>
                  <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>{label}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    maxWidth: 200,
                    fontSize: 13,
                    fontWeight: "700",
                    color: "rgba(255,255,255,0.8)",
                    textAlign: "right",
                  }}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}
