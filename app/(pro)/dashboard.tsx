import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
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
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { proApi } from "@/lib/api";
import { withAlpha } from "@/constants/colors";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SkeletonBox } from "@/components/ui/SkeletonBox"; // BLYSS-FIX: 2.3
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Unavailability = { id: number; start_date: string; end_date: string; reason: string | null };

type UpcomingClient = {
  id: number;
  // id is the booking ID; client_user_id is the actual user to navigate to.
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
  todayAppointmentsCount?: number;
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

function UpcomingClientRow({ client, index }: { client: UpcomingClient; index: number }) {
  const router = useRouter();
  const colors = useThemeColors();
  const STATUS_CFG = useMemo(() => getStatusCfg(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const entryOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const entryTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 12)).current;
  const cfg = STATUS_CFG[client.status] ?? STATUS_CFG.upcoming;

  useEffect(() => {
    if (reduceMotion) return;
    const delay = Math.min(index, 6) * 60;
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.timing(entryTranslateY, { toValue: 0, duration: 280, delay, useNativeDriver: true }),
    ]).start();
    // Animate once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={{
        opacity: entryOpacity,
        transform: [{ translateY: entryTranslateY }, { scale }],
      }}
    >
      <Pressable
        onPress={() => router.push(`/(pro)/(clients)/client-detail?clientId=${client.client_user_id}`)}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        style={{
          borderRadius: 12,
          padding: 16,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.black,
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
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Text style={{ color: colors.onColor, fontWeight: "900", fontSize: 14 }}>
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
                style={{ fontWeight: "700", fontSize: 14, color: colors.foreground, flex: 1 }}
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
              style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 8, fontWeight: "500" }}
              numberOfLines={1}
            >
              {client.service}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: "600" }}>
                  {client.time}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
                {n(client.price).toFixed(2).replace(".", ",")} €
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function getStatusCfg(colors: ReturnType<typeof useThemeColors>) {
  return {
    ongoing:   { label: "En cours",  bg: withAlpha(colors.success, 0.15),  text: colors.success },
    upcoming:  { label: "À venir",   bg: withAlpha(colors.info, 0.15),  text: colors.info },
    completed: { label: "Terminé",   bg: withAlpha(colors.mutedForeground, 0.15), text: colors.mutedForeground },
  } as const;
}

export default function ProDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const contentTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 16)).current;
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
      if (done !== "true") router.replace("/pro-onboarding" as any);
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

  useEffect(() => {
    if (isLoading || reduceMotion) return;
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(contentTranslateY, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [isLoading, reduceMotion, contentOpacity, contentTranslateY]);

  const raw = data?.data as DashData | undefined;

  const weeklyStats  = raw?.weeklyStats  ?? { services: 0, change: 0, isUp: true };
  const todayForecast = n(raw?.todayForecast);
  const todayAppointmentsCount = n(raw?.todayAppointmentsCount);
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

  const heroState = useMemo(() => {
    // `upcomingClients` looks at every future reservation (next 3, any day) —
    // it must never stand in for "today". `todayAppointmentsCount` is the
    // only field actually scoped to the current calendar day.
    if (upcomingClients.length === 0) {
      return {
        headline: "Aucun rendez-vous\npour l'instant",
        sub: weeklyStats.services > 0
          ? `${weeklyStats.services} prestation${weeklyStats.services > 1 ? "s" : ""} réalisée${weeklyStats.services > 1 ? "s" : ""} cette semaine`
          : "Semaine en démarrage",
        ctaLabel: "Relancer une cliente",
        ctaIcon: "person-add-outline" as const,
        onPressCta: () => router.push("/(pro)/(clients)"),
      };
    }

    if (todayAppointmentsCount === 0) {
      return {
        headline: "Pas de rendez-vous\naujourd'hui",
        sub: "Ton prochain rendez-vous arrive bientôt",
        ctaLabel: "Voir le planning",
        ctaIcon: "calendar-outline" as const,
        onPressCta: () => router.push("/(pro)/calendar"),
      };
    }

    if (todayAppointmentsCount <= 2) {
      return {
        headline: "Journée calme\naujourd'hui",
        sub: `${todayForecast.toFixed(0)} € prévus aujourd'hui`,
        ctaLabel: "Ouvrir des créneaux",
        ctaIcon: "add-circle-outline" as const,
        onPressCta: () => setShowSlotsModal(true),
      };
    }

    return {
      headline: `${todayAppointmentsCount} rendez-vous\naujourd'hui`,
      sub: `${todayForecast.toFixed(0)} € prévus aujourd'hui`,
      ctaLabel: "Voir le planning",
      ctaIcon: "calendar-outline" as const,
      onPressCta: () => router.push("/(pro)/calendar"),
    };
  }, [upcomingClients.length, todayAppointmentsCount, weeklyStats.services, todayForecast, router]);

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
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
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
    <Animated.View style={{ flex: 1, opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}>
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* ── HEADER ── */}
      <View>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: colors.foreground,
            letterSpacing: -0.5,
          }}
        >
          Bonjour {user?.first_name ?? ""}
        </Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
          Ton planning du jour
        </Text>
      </View>

      {/* ── WEEKLY PERFORMANCE HERO ── */}
      <View>
        <LinearGradient
          colors={["#FF4D96", colors.primary, "#FF82B8"]}
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
                <Ionicons name="today-outline" size={12} color={colors.onColor} />
                <Text style={{ color: colors.onColor, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Aujourd'hui
                </Text>
              </View>
              {/* Trend badge — pouls hebdo, conservé en repère secondaire */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: weeklyStats.isUp ? "rgba(255,255,255,0.22)" : colors.overlayLight, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                <Ionicons name={weeklyStats.isUp ? "trending-up" : "trending-down"} size={14} color={colors.onColor} />
                <Text style={{ color: colors.onColor, fontWeight: "900", fontSize: 13, letterSpacing: -0.2 }}>
                  {weeklyStats.isUp ? "+" : "-"}{weeklyStats.change}%
                </Text>
              </View>
            </View>

            {/* État du jour — plus un chiffre passif, un verdict */}
            <View>
              <Text style={{ fontSize: 26, fontWeight: "900", color: colors.onColor, letterSpacing: -0.6, lineHeight: 30 }}>
                {heroState.headline}
              </Text>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600", marginTop: 8 }}>
                {heroState.sub}
              </Text>
            </View>

            {/* Divider + CTA contextuel */}
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.18)" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500" }}>
                {weeklyStats.isUp ? "+" : "-"}{weeklyStats.change}% vs semaine dernière
              </Text>
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  heroState.onPressCta();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.3)",
                }}
              >
                <Ionicons name={heroState.ctaIcon} size={14} color={colors.onColor} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.onColor }}>
                  {heroState.ctaLabel}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── UPCOMING CLIENTS ── */}
      {/* Détail opérationnel, après le verdict du hero — pas besoin de répéter
          l'état vide ici, le hero l'a déjà annoncé avec son CTA. */}
      {upcomingClients.length > 0 && (
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
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.foreground, letterSpacing: -0.2 }}>
                Prochaines clientes
              </Text>
            </View>
            <Pressable onPress={() => router.push("/(pro)/calendar")}>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "700" }}>Voir tout →</Text>
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            {upcomingClients.map((client, i) => (
              <UpcomingClientRow key={client.id} client={client} index={i} />
            ))}
          </View>
        </View>
      )}

      {/* ── QUICK ACTIONS ── */}
      <View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "Créneaux", icon: "add" as const, onPress: () => setShowSlotsModal(true), color: colors.primary, iconBg: withAlpha(colors.primary, 0.15) },
            { label: "Bloquer",  icon: "ban-outline" as const, onPress: openBlockModal, color: colors.destructive, iconBg: withAlpha(colors.destructive, 0.15) },
            { label: "Planning", icon: "eye-outline" as const, onPress: () => router.push("/(pro)/calendar"), color: colors.primary, iconBg: withAlpha(colors.primary, 0.15) },
          ].map(({ label, icon, onPress, color, iconBg }) => (
            <AnimatedPressable
              key={label}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onPress();
              }}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                gap: 10,
                shadowColor: colors.black,
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
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.foreground }}>
                {label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>

      {/* ── TODAY FORECAST ── */}
      <View>
        <LinearGradient
          colors={isDark ? [withAlpha(colors.primary, 0.18), withAlpha(colors.primary, 0.12), withAlpha(colors.primary, 0.08)] : ["#FFF0F8", "#FFDFF0", "#FFD6EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.25),
            overflow: "hidden",
            shadowColor: colors.primary,
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
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }}>
                <Ionicons name="flash" size={22} color={colors.onColor} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: "900", color: colors.primary, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Aujourd'hui
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                  Revenu estimé
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
                  <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600" }}>
                    {todayAppointmentsCount === 0
                      ? "Aucun rdv aujourd'hui"
                      : `${todayAppointmentsCount} rdv prévu${todayAppointmentsCount > 1 ? "s" : ""}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right — valeur */}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 32, fontWeight: "900", color: colors.primary, letterSpacing: -1 }}>
                {todayForecast.toFixed(0)}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: `${colors.primary}99`, marginTop: -2 }}>
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
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              shadowColor: colors.black,
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
                backgroundColor: `${colors.primary}0D`,
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
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 9,
                    color: colors.mutedForeground,
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
                      color: colors.foreground,
                      letterSpacing: -0.5,
                    }}
                  >
                    {fillRate.toFixed(0)}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: colors.primary }}>
                    %
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 4, fontWeight: "500" }}>
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
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              shadowColor: colors.black,
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
                backgroundColor: withAlpha(colors.success, 0.05),
              }}
            />
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: withAlpha(colors.success, 0.15),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="people-outline" size={16} color={colors.success} />
                </View>
                <Text
                  style={{
                    fontSize: 9,
                    color: colors.mutedForeground,
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
                    color: colors.foreground,
                    letterSpacing: -0.5,
                  }}
                >
                  {clientsThisWeek}
                </Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 4, fontWeight: "500" }}>
                  Servies cette semaine
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── TOP SERVICES ── */}
      {topServices.length > 0 && (
        <View>
          <View
            style={{
              borderRadius: 12,
              padding: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.foreground }}>Top prestations</Text>
              </View>
              <Ionicons name="star" size={16} color={colors.primary} />
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
                          backgroundColor: `${colors.primary}1A`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "900", color: colors.primary }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                        {svc.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}>
                      {svc.percentage}%
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 10,
                      backgroundColor: colors.muted,
                      borderRadius: 5,
                      overflow: "hidden",
                    }}
                  >
                    <LinearGradient
                      colors={[colors.primary, `${colors.primary}CC`]}
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
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.foreground }}>
                  Revenus de la semaine
                </Text>
              </View>
              {totalRevenue > 0 && (
                <Text style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}>
                  {totalRevenue.toFixed(0)} €
                </Text>
              )}
            </View>

            {totalRevenue > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 14,
                  height: 120,
                  paddingTop: 8,
                }}
              >
                {weeklyRevenue.map((day, i) => {
                  const amt = n(day.amount);
                  const isMax = amt === maxRevenue && amt > 0;
                  const barH = Math.max((amt / maxRevenue) * 104, 8);
                  const dayLabel = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i] ?? day.day;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center", gap: 8 }}>
                      {isMax ? (
                        <LinearGradient
                          colors={[colors.primary, `${colors.primary}B3`]}
                          style={{
                            width: "100%",
                            height: barH,
                            borderRadius: 8,
                            shadowColor: colors.primary,
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
                            backgroundColor: colors.muted,
                          }}
                        />
                      )}
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: isMax ? colors.primary : colors.mutedForeground,
                        }}
                      >
                        {dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ paddingVertical: 28, alignItems: "center", gap: 8 }}>
                <Ionicons name="bar-chart-outline" size={28} color={colors.border} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                  Aucune donnée cette semaine
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── SLOTS MODAL ── */}
      <Modal visible={showSlotsModal} onClose={() => setShowSlotsModal(false)} title="Ajouter des créneaux" bottomSheet>
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 20, lineHeight: 18 }}>
          Ouvre de nouveaux créneaux depuis ton calendrier pour permettre à tes clientes de réserver.
        </Text>
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setShowSlotsModal(false);
            router.push("/(pro)/calendar");
          }}
          style={{
            borderRadius: 12,
            backgroundColor: colors.primary,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.onColor} />
          <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>Aller au calendrier</Text>
        </AnimatedPressable>
      </Modal>

      {/* ── BLOCK MODAL ── */}
      <Modal visible={showBlockModal} onClose={() => setShowBlockModal(false)} title="Bloquer une journée" bottomSheet>
        {/* Date picker */}
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground,
          textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          Journée à bloquer
        </Text>
        <Pressable
          onPress={() => setShowBlockDatePicker((v) => !v)}
          style={{ height: 48, borderRadius: 14, borderWidth: 1.5,
            borderColor: showBlockDatePicker ? colors.destructive : colors.border,
            paddingHorizontal: 14, backgroundColor: colors.destructiveLight,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12 }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
            {blockDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Ionicons name="calendar-outline" size={18} color={colors.destructive} />
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
            themeVariant={isDark ? "dark" : "light"}
            accentColor={colors.destructive}
          />
        )}

        {/* Statut de la journée sélectionnée */}
        <Text style={{ fontSize: 12, marginBottom: 20, lineHeight: 18,
          color: isBlockedDay(blockDate) ? colors.destructive : colors.mutedForeground,
          fontWeight: isBlockedDay(blockDate) ? "700" : "400" }}>
          {isBlockedDay(blockDate)
            ? "Cette journée est bloquée — appuie sur Débloquer pour la réouvrir"
            : "Cette journée est disponible à la réservation"}
        </Text>

        {blockError && <View style={{ marginBottom: 8 }}><ErrorMessage message={blockError} /></View>}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => { setBlockError(null); setShowBlockModal(false); }}
            style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center" }}
          >
            <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 14 }}>Annuler</Text>
          </Pressable>
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(
                isBlockedDay(blockDate) ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy
              ).catch(() => {});
              handleBlockDay();
            }}
            disabled={blockLoading}
            style={{
              flex: 1,
              borderRadius: 12,
              backgroundColor: colors.destructive,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: blockLoading ? 0.7 : 1,
            }}
          >
            {blockLoading ? (
              <ActivityIndicator color={colors.onColor} size="small" />
            ) : (
              <>
                <Ionicons name={isBlockedDay(blockDate) ? "lock-open-outline" : "ban-outline"} size={18} color={colors.onColor} />
                <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>
                  {isBlockedDay(blockDate) ? "Débloquer" : "Bloquer"}
                </Text>
              </>
            )}
          </AnimatedPressable>
        </View>
      </Modal>
    </ScrollView>
    </Animated.View>
  );
}
