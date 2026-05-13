import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";
import { proApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

type UpcomingClient = {
  id: number;
  name: string;
  service: string;
  time: string;
  price: number;
  status: "ongoing" | "upcoming" | "completed";
  avatar: string;
};

type TopService = { name: string; percentage: number };
type WeeklyPoint = { day: string; amount: number };

type DashData = {
  weeklyStats?: { services: number; change: number; isUp: boolean };
  todayForecast?: number;
  upcomingClients?: UpcomingClient[];
  fillRate?: number;
  clientsThisWeek?: number;
  topServices?: TopService[];
  weeklyRevenue?: WeeklyPoint[];
};

function n(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
}

const STATUS_CFG = {
  ongoing:   { label: "En cours",  bg: "rgba(52,199,89,0.15)",  text: "#34C759" },
  upcoming:  { label: "À venir",   bg: "rgba(0,122,255,0.15)",  text: "#007AFF" },
  completed: { label: "Terminé",   bg: "rgba(120,120,128,0.15)", text: "#6B7280" },
} as const;

export default function ProDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pro-dashboard"],
    queryFn: () => proApi.getDashboard(),
    staleTime: 60_000,
  });

  const raw = data?.data as DashData | undefined;

  const weeklyStats  = raw?.weeklyStats  ?? { services: 0, change: 0, isUp: true };
  const todayForecast = n(raw?.todayForecast);
  const upcomingClients = raw?.upcomingClients ?? [];
  const fillRate     = n(raw?.fillRate);
  const clientsThisWeek = n(raw?.clientsThisWeek);
  const topServices  = raw?.topServices  ?? [];
  const weeklyRevenue = raw?.weeklyRevenue ?? [];

  const maxRevenue = useMemo(
    () => Math.max(1, ...weeklyRevenue.map((d) => n(d.amount))),
    [weeklyRevenue]
  );
  const totalRevenue = useMemo(
    () => weeklyRevenue.reduce((s, d) => s + n(d.amount), 0),
    [weeklyRevenue]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={{ padding: 20, gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                height: i === 1 ? 120 : i === 2 ? 80 : 64,
                borderRadius: 16,
                backgroundColor: `${Colors.muted}99`,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HEADER ── */}
      <Animated.View entering={FadeInDown.delay(0).springify()}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: Colors.foreground,
            letterSpacing: -0.5,
          }}
        >
          Bonjour {user?.first_name ?? ""} 👋
        </Text>
      </Animated.View>

      {/* ── WEEKLY PERFORMANCE HERO ── */}
      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <LinearGradient
          colors={["#FF5EA0", "rgba(255,94,160,0.95)", "rgba(255,94,160,0.82)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: 20,
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
            overflow: "hidden",
          }}
        >
          {/* Glow blob */}
          <View
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />

          {/* Dot pattern overlay — mirrors web radial-gradient dots */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.08 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#fff",
                  left: (i % 4) * 60 + 10,
                  top: Math.floor(i / 4) * 30 + 10,
                }}
              />
            ))}
          </View>

          <View style={{ gap: 16 }}>
            {/* Label */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="pulse-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Cette semaine
              </Text>
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ fontSize: 48, fontWeight: "900", color: "#fff", letterSpacing: -1 }}>
                  {weeklyStats.services}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.9)" }}>
                  {weeklyStats.services > 1 ? "prestations" : "prestation"}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                }}
              >
                <Ionicons
                  name={weeklyStats.isUp ? "trending-up-outline" : "trending-down-outline"}
                  size={18}
                  color="#fff"
                />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                  {weeklyStats.isUp ? "+" : "-"}
                  {weeklyStats.change}%
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />

            {/* Footer */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "500" }}>
                vs semaine dernière
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>
                {weeklyStats.isUp ? "En progression" : "En baisse"}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── QUICK ACTIONS ── */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Créneaux", icon: "add" as const, onPress: () => setShowSlotsModal(true), color: Colors.primary, iconBg: "#FFE8F3" },
            { label: "Bloquer",  icon: "ban-outline" as const, onPress: () => setShowBlockModal(true), color: Colors.destructive, iconBg: "#FFE8E8" },
            { label: "Planning", icon: "eye-outline" as const, onPress: () => router.push("/(pro)/calendar"), color: Colors.primary, iconBg: "#FFE8F3" },
          ].map(({ label, icon, onPress, color, iconBg }) => (
            <Pressable
              key={label}
              onPress={onPress}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: 16,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                gap: 10,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: iconBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={icon} size={20} color={color} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.foreground }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* ── TODAY FORECAST ── */}
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <View
          style={{
            borderRadius: 12,
            padding: 16,
            backgroundColor: "#FEF0F7",
            borderWidth: 1,
            borderColor: "#FFD6E8",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${Colors.primary}1A`,
            }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: Colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Ionicons name="locate-outline" size={20} color="#fff" />
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "900",
                    color: Colors.primary,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Prévision du jour
                </Text>
                <Text style={{ fontSize: 11, color: `${Colors.primary}B3` }}>Revenu estimé</Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "900",
                color: Colors.primary,
                letterSpacing: -0.5,
              }}
            >
              {todayForecast.toFixed(2).replace(".", ",")}€
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── STATS GRID ── */}
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* Fill rate */}
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 16,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: `${Colors.primary}0D`,
              }}
            />
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#FFE8F3",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 9,
                    color: Colors.mutedForeground,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Remplissage
                </Text>
              </View>
              <View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: "900",
                      color: Colors.foreground,
                      letterSpacing: -0.5,
                    }}
                  >
                    {fillRate.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: Colors.primary }}>
                    %
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4, fontWeight: "500" }}>
                  Créneaux réservés
                </Text>
              </View>
            </View>
          </View>

          {/* Clients */}
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              padding: 16,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(52,199,89,0.05)",
              }}
            />
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(52,199,89,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="people-outline" size={16} color="#34C759" />
                </View>
                <Text
                  style={{
                    fontSize: 9,
                    color: Colors.mutedForeground,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Clientes
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: Colors.foreground,
                    letterSpacing: -0.5,
                  }}
                >
                  {clientsThisWeek}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4, fontWeight: "500" }}>
                  Servies cette semaine
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── UPCOMING CLIENTS ── */}
      <Animated.View entering={FadeInDown.delay(250).springify()}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 4, height: 20, backgroundColor: Colors.primary, borderRadius: 2 }} />
            <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.2 }}>
              Prochaines clientes
            </Text>
          </View>
          <Pressable onPress={() => router.push("/(pro)/calendar")}>
            <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700" }}>Voir tout →</Text>
          </Pressable>
        </View>

        {upcomingClients.length === 0 ? (
          <View
            style={{
              borderRadius: 12,
              padding: 32,
              backgroundColor: "rgba(0,0,0,0.02)",
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: Colors.border,
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: `${Colors.muted}80`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="calendar-outline" size={24} color={Colors.mutedForeground} />
            </View>
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>
                Aucune cliente prévue
              </Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>
                Les prochains rendez-vous apparaîtront ici
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {upcomingClients.map((client) => {
              const cfg = STATUS_CFG[client.status] ?? STATUS_CFG.upcoming;
              return (
                <Pressable
                  key={client.id}
                  onPress={() => router.push("/(pro)/calendar")}
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    backgroundColor: Colors.card,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: Colors.primary,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: Colors.primary,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        elevation: 2,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>
                        {client.avatar}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <Text
                          style={{ fontWeight: "700", fontSize: 14, color: Colors.foreground, flex: 1 }}
                          numberOfLines={1}
                        >
                          {client.name}
                        </Text>
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 20,
                            backgroundColor: cfg.bg,
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: "700", color: cfg.text }}>
                            {cfg.label}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 8, fontWeight: "500" }}
                        numberOfLines={1}
                      >
                        {client.service}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="time-outline" size={12} color={Colors.mutedForeground} />
                          <Text style={{ fontSize: 11, color: Colors.mutedForeground, fontWeight: "600" }}>
                            {client.time}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <Ionicons name="cash-outline" size={14} color={Colors.primary} />
                          <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.primary }}>
                            {n(client.price).toFixed(2).replace(".", ",")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* ── TOP SERVICES ── */}
      {topServices.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <View
            style={{
              borderRadius: 12,
              padding: 16,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 4, height: 20, backgroundColor: Colors.primary, borderRadius: 2 }} />
                <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground }}>Top prestations</Text>
              </View>
              <Ionicons name="star" size={16} color={Colors.primary} />
            </View>

            <View style={{ gap: 14 }}>
              {topServices.slice(0, 3).map((svc, i) => (
                <View key={i}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          backgroundColor: `${Colors.primary}1A`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "900", color: Colors.primary }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>
                        {svc.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: Colors.primary }}>
                      {svc.percentage}%
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 10,
                      backgroundColor: Colors.muted,
                      borderRadius: 5,
                      overflow: "hidden",
                    }}
                  >
                    <LinearGradient
                      colors={[Colors.primary, `${Colors.primary}CC`]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        height: "100%",
                        width: `${Math.min(svc.percentage, 100)}%`,
                        borderRadius: 5,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── WEEKLY REVENUE CHART ── */}
      {weeklyRevenue.length > 0 && (
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <View
            style={{
              borderRadius: 12,
              padding: 16,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 4, height: 20, backgroundColor: Colors.primary, borderRadius: 2 }} />
                <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground }}>
                  Revenus de la semaine
                </Text>
              </View>
              {totalRevenue > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="cash-outline" size={14} color={Colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "900", color: Colors.primary }}>
                    {totalRevenue.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 8,
                height: 120,
                paddingTop: 8,
              }}
            >
              {weeklyRevenue.map((day, i) => {
                const amt = n(day.amount);
                const isMax = amt === maxRevenue && amt > 0;
                const barH = maxRevenue > 0 ? Math.max((amt / maxRevenue) * 120, 8) : 8;
                return (
                  <View key={i} style={{ flex: 1, alignItems: "center", gap: 8 }}>
                    {isMax ? (
                      <LinearGradient
                        colors={[Colors.primary, `${Colors.primary}B3`]}
                        style={{
                          width: "100%",
                          height: barH,
                          borderRadius: 8,
                          shadowColor: Colors.primary,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 2,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: "100%",
                          height: barH,
                          borderRadius: 8,
                          backgroundColor: Colors.muted,
                        }}
                      />
                    )}
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: isMax ? Colors.primary : Colors.mutedForeground,
                      }}
                    >
                      {day.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── SLOTS MODAL ── */}
      <Modal visible={showSlotsModal} transparent animationType="slide" onRequestClose={() => setShowSlotsModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View
            style={{
              backgroundColor: Colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: insets.bottom + 28,
              borderTopWidth: 2,
              borderTopColor: `${Colors.primary}33`,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.foreground }}>
                Ajouter des créneaux
              </Text>
              <Pressable
                onPress={() => setShowSlotsModal(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: Colors.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={20} color={Colors.foreground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 20, lineHeight: 18 }}>
              Ouvrez de nouveaux créneaux depuis votre calendrier pour permettre à vos clientes de réserver.
            </Text>
            <Pressable
              onPress={() => { setShowSlotsModal(false); router.push("/(pro)/calendar"); }}
              style={{ overflow: "hidden", borderRadius: 12 }}
            >
              <LinearGradient
                colors={[Colors.primary, `${Colors.primary}E6`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                  Aller au calendrier
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── BLOCK MODAL ── */}
      <Modal visible={showBlockModal} transparent animationType="slide" onRequestClose={() => setShowBlockModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View
            style={{
              backgroundColor: Colors.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: insets.bottom + 28,
              borderTopWidth: 2,
              borderTopColor: `${Colors.destructive}33`,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.foreground }}>
                Bloquer une journée
              </Text>
              <Pressable
                onPress={() => setShowBlockModal(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: Colors.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={20} color={Colors.foreground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 20, lineHeight: 18 }}>
              Bloquez une journée complète pour ne plus recevoir de nouvelles réservations.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setShowBlockModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: Colors.muted,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: Colors.foreground, fontSize: 14 }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowBlockModal(false)}
                style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={[Colors.destructive, `${Colors.destructive}E6`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="ban-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Bloquer</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
