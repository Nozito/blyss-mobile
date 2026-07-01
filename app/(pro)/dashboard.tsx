import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal } from "@/components/ui/Modal";
import { toLocalDate } from "@/lib/dateUtils";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { proApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { TAB_BOTTOM_PADDING } from "@/constants/layout";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SkeletonBox } from "@/components/ui/SkeletonBox"; // BLYSS-FIX: 2.3

type Unavailability = { id: number; start_date: string; end_date: string; reason: string | null };

type UpcomingClient = {
  id: number;
  // BLYSS-FIX: 1.1 — id is the booking ID; client_user_id is the actual user to navigate to
  // BACKEND TODO: ensure GET /api/pro/dashboard returns client_user_id in upcomingClients items
  client_user_id: number;
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
  if (typeof v === "number") return v;
  const normalized = String(v ?? "0").replace(/\s/g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
}

const STATUS_CFG = {
  ongoing:   { label: "En cours",  bg: "rgba(52,199,89,0.15)",  text: "#34C759" },
  upcoming:  { label: "À venir",   bg: "rgba(0,122,255,0.15)",  text: "#007AFF" },
  completed: { label: "Terminé",   bg: "rgba(120,120,128,0.15)", text: Colors.mutedForeground },
} as const;

export default function ProDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDate, setBlockDate] = useState<Date>(new Date());
  const [showBlockDatePicker, setShowBlockDatePicker] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);

  // Redirect new pros to onboarding if they haven't seen it yet
  useEffect(() => {
    AsyncStorage.getItem("pro_onboarding_done").then((done) => {
      if (done !== "true") router.replace("/(pro)/onboarding");
    });
  // router is stable in Expo Router
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pro-dashboard"],
    queryFn: () => proApi.getDashboard(),
    staleTime: 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  const isBlockedDay = (d: Date) => {
    const s = toLocalDate(d);
    return unavailabilities.some((u) => s >= u.start_date && s <= u.end_date);
  };

  const openBlockModal = async () => {
    setShowBlockModal(true);
    try {
      const res = await proApi.getUnavailabilities();
      if (res.success && res.data) setUnavailabilities(res.data as Unavailability[]);
    } catch { /* silent */ }
  };

  const handleBlockDay = async () => {
    const dayStr = toLocalDate(blockDate);
    const existing = unavailabilities.find((u) => dayStr >= u.start_date && dayStr <= u.end_date);
    setBlockLoading(true);
    try {
      if (existing) {
        await proApi.deleteUnavailability(existing.id);
        setUnavailabilities((prev) => prev.filter((u) => u.id !== existing.id));
      } else {
        await proApi.createUnavailability({ start_date: dayStr, end_date: dayStr, reason: "blocked" });
        const res = await proApi.getUnavailabilities();
        if (res.success && res.data) setUnavailabilities(res.data as Unavailability[]);
      }
      setShowBlockModal(false);
    } catch {
      setBlockError("Impossible de modifier le statut de la journée");
    } finally {
      setBlockLoading(false);
    }
  };

  if (isLoading) { // BLYSS-FIX: 2.3 — shimmer skeletons replacing static boxes
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={{ padding: 20, gap: 16 }}>
          {/* Hero gradient area */}
          <SkeletonBox height={160} borderRadius={20} />
          {/* Quick actions row */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SkeletonBox height={80} borderRadius={16} style={{ flex: 1 }} />
            <SkeletonBox height={80} borderRadius={16} style={{ flex: 1 }} />
            <SkeletonBox height={80} borderRadius={16} style={{ flex: 1 }} />
          </View>
          {/* Today forecast */}
          <SkeletonBox height={80} borderRadius={16} />
          {/* Stats grid */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SkeletonBox height={100} borderRadius={16} style={{ flex: 1 }} />
            <SkeletonBox height={100} borderRadius={16} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + TAB_BOTTOM_PADDING,
        paddingHorizontal: 20,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
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
          colors={["#FF4D96", Colors.primary, "#FF82B8"]}
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
                <Ionicons name="pulse-outline" size={12} color={Colors.white} />
                <Text style={{ color: Colors.white, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Cette semaine
                </Text>
              </View>
              {/* Trend badge */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: weeklyStats.isUp ? "rgba(255,255,255,0.22)" : Colors.overlayLight, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                <Ionicons name={weeklyStats.isUp ? "trending-up" : "trending-down"} size={14} color={Colors.white} />
                <Text style={{ color: Colors.white, fontWeight: "900", fontSize: 13, letterSpacing: -0.2 }}>
                  {weeklyStats.isUp ? "+" : "-"}{weeklyStats.change}%
                </Text>
              </View>
            </View>

            {/* Nombre principal */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <Text style={{ fontSize: 60, fontWeight: "900", color: Colors.white, letterSpacing: -2, lineHeight: 62 }}>
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
            { label: "Bloquer",  icon: "ban-outline" as const, onPress: openBlockModal, color: Colors.destructive, iconBg: "#FFE8E8" },
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
                shadowColor: Colors.black,
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
                <Ionicons name="flash" size={22} color={Colors.white} />
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
              shadowColor: Colors.black,
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
              shadowColor: Colors.black,
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
                  onPress={() => router.push(`/(pro)/(clients)/client-detail?clientId=${client.client_user_id}`)} // BLYSS-FIX: 1.1
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    backgroundColor: Colors.card,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    shadowColor: Colors.black,
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
                      <Text style={{ color: Colors.white, fontWeight: "900", fontSize: 14 }}>
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
              shadowColor: Colors.black,
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
              shadowColor: Colors.black,
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

            {totalRevenue > 0 ? (
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
                  const barH = Math.max((amt / maxRevenue) * 120, 8);
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
            ) : (
              <View style={{ paddingVertical: 28, alignItems: "center", gap: 8 }}>
                <Ionicons name="bar-chart-outline" size={28} color={Colors.border} />
                <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                  Aucune donnée cette semaine
                </Text>
              </View>
            )}
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
            <Ionicons name="calendar-outline" size={18} color={Colors.white} />
            <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 14 }}>Aller au calendrier</Text>
          </LinearGradient>
        </Pressable>
      </Modal>

      {/* ── BLOCK MODAL ── */}
      <Modal visible={showBlockModal} onClose={() => setShowBlockModal(false)} title="Bloquer une journée" bottomSheet>
        {/* Date picker */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground,
          textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          Journée à bloquer
        </Text>
        <Pressable
          onPress={() => setShowBlockDatePicker((v) => !v)}
          style={{ height: 48, borderRadius: 14, borderWidth: 1.5,
            borderColor: showBlockDatePicker ? Colors.destructive : Colors.border,
            paddingHorizontal: 14, backgroundColor: "#FFF1F1",
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>
            {blockDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={Colors.destructive} />
        </Pressable>

        {showBlockDatePicker && (
          <DateTimePicker
            value={blockDate}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            minimumDate={new Date()}
            onChange={(_, date) => {
              if (Platform.OS === "android") setShowBlockDatePicker(false);
              if (date) setBlockDate(date);
            }}
            themeVariant="light"
            accentColor={Colors.destructive}
          />
        )}

        {/* Statut de la journée sélectionnée */}
        <Text style={{ fontSize: 12, marginBottom: 20, lineHeight: 18,
          color: isBlockedDay(blockDate) ? Colors.destructive : Colors.mutedForeground,
          fontWeight: isBlockedDay(blockDate) ? "700" : "400" }}>
          {isBlockedDay(blockDate)
            ? "Cette journée est bloquée — appuie sur Débloquer pour la réouvrir"
            : "Cette journée est disponible à la réservation"}
        </Text>

        {blockError && <View style={{ marginBottom: 8 }}><ErrorMessage message={blockError} /></View>}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => { setBlockError(null); setShowBlockModal(false); }}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.muted, alignItems: "center" }}
          >
            <Text style={{ fontWeight: "700", color: Colors.foreground, fontSize: 14 }}>Annuler</Text>
          </Pressable>
          <Pressable onPress={handleBlockDay} disabled={blockLoading} style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
            <LinearGradient
              colors={[Colors.destructive, `${Colors.destructive}E6`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center",
                justifyContent: "center", gap: 8, opacity: blockLoading ? 0.7 : 1 }}
            >
              {blockLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name={isBlockedDay(blockDate) ? "lock-open-outline" : "ban-outline"} size={18} color={Colors.white} />
                  <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 14 }}>
                    {isBlockedDay(blockDate) ? "Débloquer" : "Bloquer"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}
