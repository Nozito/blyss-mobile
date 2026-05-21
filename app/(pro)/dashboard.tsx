import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
      <View>
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
      </View>

      {/* ── WEEKLY PERFORMANCE HERO ── */}
      <View>
        <LinearGradient
          colors={["#FF4D96", "#FF5EA0", "#FF82B8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 22,
            shadowColor: "#FF4D96",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 8,
            overflow: "hidden",
          }}
        >
          {/* Décors : cercles concentriques en coin */}
          <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.10)" }} />
          <View style={{ position: "absolute", top: -16, right: -16, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <View style={{ position: "absolute", bottom: -30, left: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.06)" }} />

          <View style={{ gap: 18 }}>
            {/* Label */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Ionicons name="pulse-outline" size={12} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Cette semaine
                </Text>
              </View>
              {/* Trend badge */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: weeklyStats.isUp ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                <Ionicons name={weeklyStats.isUp ? "trending-up" : "trending-down"} size={14} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: -0.2 }}>
                  {weeklyStats.isUp ? "+" : "-"}{weeklyStats.change}%
                </Text>
              </View>
            </View>

            {/* Nombre principal */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <Text style={{ fontSize: 60, fontWeight: "900", color: "#fff", letterSpacing: -2, lineHeight: 62 }}>
                  {weeklyStats.services}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
                  {weeklyStats.services > 1 ? "prestations" : "prestation"}
                </Text>
              </View>
              {totalRevenue > 0 && (
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginTop: 2 }}>
                  {totalRevenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} € générés
                </Text>
              )}
            </View>

            {/* Divider + footer */}
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.18)" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500" }}>
                vs semaine dernière
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: weeklyStats.isUp ? "#A7F3D0" : "#FCA5A5" }} />
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "700" }}>
                  {weeklyStats.isUp ? "En progression" : "En baisse"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── QUICK ACTIONS ── */}
      <View>
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
      </View>

      {/* ── TODAY FORECAST ── */}
      <View>
        <LinearGradient
          colors={["#FFF0F8", "#FFDFF0", "#FFD6EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: "#FFCCE5",
            overflow: "hidden",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          {/* Décor coin */}
          <View style={{ position: "absolute", top: -24, right: -24, width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(254,93,157,0.10)" }} />
          <View style={{ position: "absolute", bottom: -12, left: 40, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(254,93,157,0.06)" }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {/* Left */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }}>
                <Ionicons name="flash" size={22} color="#fff" />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: "900", color: Colors.primary, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Aujourd'hui
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>
                  Revenu estimé
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#34C759" }} />
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, fontWeight: "600" }}>
                    {upcomingClients.length} rdv prévu{upcomingClients.length > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right — valeur */}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 32, fontWeight: "900", color: Colors.primary, letterSpacing: -1 }}>
                {todayForecast.toFixed(0)}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: `${Colors.primary}99`, marginTop: -2 }}>
                euros
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── STATS GRID ── */}
      <View>
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
      </View>

      {/* ── UPCOMING CLIENTS ── */}
      <View>
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
      </View>

      {/* ── TOP SERVICES ── */}
      {topServices.length > 0 && (
        <View>
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
        </View>
      )}

      {/* ── WEEKLY REVENUE CHART ── */}
      {weeklyRevenue.length > 0 && (
        <View>
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
        </View>
      )}

      {/* ── SLOTS MODAL ── */}
      <Modal visible={showSlotsModal} onClose={() => setShowSlotsModal(false)} title="Ajouter des créneaux" bottomSheet>
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
            style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Aller au calendrier</Text>
          </LinearGradient>
        </Pressable>
      </Modal>

      {/* ── BLOCK MODAL ── */}
      <Modal visible={showBlockModal} onClose={() => setShowBlockModal(false)} title="Bloquer une journée" bottomSheet>
        <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 20, lineHeight: 18 }}>
          Bloquez une journée complète pour ne plus recevoir de nouvelles réservations.
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setShowBlockModal(false)}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.muted, alignItems: "center" }}
          >
            <Text style={{ fontWeight: "700", color: Colors.foreground, fontSize: 14 }}>Annuler</Text>
          </Pressable>
          <Pressable onPress={() => setShowBlockModal(false)} style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
            <LinearGradient
              colors={[Colors.destructive, `${Colors.destructive}E6`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Ionicons name="ban-outline" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Bloquer</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}
