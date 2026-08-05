import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  RefreshControl,
  type ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { specialistsApi, clientApi } from "@/lib/api";
import { Shadows } from "@/constants/shadows";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFavorites } from "@/hooks/useFavorites";
import { resolveMediaUrl } from "@/lib/media";

// ── Style constants (module-level → never recreated) ─────────────────────────
const CATEGORY_LIST_STYLE  = { paddingHorizontal: 24, gap: 8, paddingBottom: 4 } as const;
const SPECIALIST_LIST_STYLE = { paddingHorizontal: 24, gap: 16, paddingVertical: 8 } as const;
const MAIN_LIST_STYLE       = { paddingBottom: 100 } as const;
const CARD_WIDTH = 280;
const CARD_SNAP_INTERVAL = CARD_WIDTH + 16;

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Pose gel",     query: "gel" },
  { label: "Semi-perm.",   query: "semi-permanent" },
  { label: "French",       query: "french" },
  { label: "Nail art",     query: "nail art" },
  { label: "Manucure",     query: "manucure" },
  { label: "Baby boomer",  query: "baby boomer" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Pro {
  id: number;
  first_name: string;
  last_name: string;
  activity_name?: string | null;
  city?: string | null;
  profile_photo?: string | null;
  banner_photo?: string | null;
  avg_rating?: number | null;
  pro_specialties?: string[] | null;
}

interface Booking {
  id: number;
  status: string;
  start_datetime: string;
  pro_first_name?: string;
  pro_last_name?: string;
  pro_activity_name?: string;
  prestation_name?: string;
  price?: number | string;
}

// ── ShimmerBlock ──────────────────────────────────────────────────────────────
function ShimmerBlock({ style }: { style: object }) {
  const colors = useThemeColors();
  const translateX = useRef(new Animated.Value(-1)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [translateX, reduceMotion]);

  return (
    <View style={[{ backgroundColor: colors.muted, overflow: "hidden" }, style]}>
      {!reduceMotion && (
        <Animated.View
          style={[
            StyleSheetAbsoluteFillWide,
            {
              transform: [
                {
                  translateX: translateX.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-160, 160],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.55)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: 120, height: "100%" }}
          />
        </Animated.View>
      )}
    </View>
  );
}
const StyleSheetAbsoluteFillWide = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: -40,
  right: -40,
} as const;

// ── SpecialistCardSkeleton ────────────────────────────────────────────────────
function SpecialistCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View
      style={[{ width: CARD_WIDTH, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card }, Shadows.card]}
    >
      <ShimmerBlock style={{ width: "100%", height: 192 }} />
      <View className="px-4 py-3 flex-row items-center justify-between">
        <ShimmerBlock style={{ width: 70, height: 12, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 40, height: 20, borderRadius: 10 }} />
      </View>
    </View>
  );
}

// ── SpecialistCard ────────────────────────────────────────────────────────────
function SpecialistCard({
  pro,
  index,
  isFavorite,
  onToggleFav,
}: {
  pro: Pro;
  index: number;
  isFavorite: boolean;
  onToggleFav: (id: number) => void;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const heartScale = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const entryOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const entryTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 16)).current;
  const displayName = pro.activity_name ?? `${pro.first_name} ${pro.last_name}`;
  const specialty = pro.pro_specialties?.[0] ?? "Nail Artist";
  const bannerUrl = resolveMediaUrl(pro.banner_photo ?? pro.profile_photo);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(entryTranslateY, {
        toValue: 0,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
    // Only animate once on mount — deliberately ignore index changes from list re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHeartPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 80 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
    onToggleFav(pro.id);
  };

  const handlePressIn = () =>
    Animated.spring(cardScale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View
      style={{
        transform: [{ scale: cardScale }, { translateY: entryTranslateY }],
        opacity: entryOpacity,
      }}
    >
    <Pressable
      onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: pro.id } })}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ width: CARD_WIDTH, borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card }, Shadows.card]}
    >
      {/* Cover image */}
      <View style={{ height: 192, backgroundColor: colors.muted }}>
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[colors.primaryLight, colors.primary]}
            style={{ width: "100%", height: "100%" }}
          />
        )}

        {/* Dark gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
          style={{ position: "absolute", inset: 0 } as any}
        />

        {/* Favorite button with bounce */}
        <Pressable
          onPress={handleHeartPress}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          accessibilityState={{ checked: isFavorite }}
          style={{
            position: "absolute", top: 12, right: 12,
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.9)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? colors.destructive : colors.mutedForeground}
            />
          </Animated.View>
        </Pressable>

        {/* Name overlay */}
        <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}
          className="flex-row gap-3 items-center">
          <View
            style={{ width: 56, height: 56, borderRadius: 16, borderWidth: 2,
              borderColor: "rgba(255,255,255,0.9)", overflow: "hidden" }}
            className="bg-primary items-center justify-center flex-shrink-0"
          >
            {resolveMediaUrl(pro.profile_photo) ? (
              <Image
                source={{ uri: resolveMediaUrl(pro.profile_photo) }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text className="text-white font-bold text-xl">
                {pro.first_name[0]}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-base" numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
              {specialty}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
          <Ionicons name="location-outline" size={13} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{pro.city ?? "France"}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {pro.avg_rating != null && (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.warningLight }}
            >
              <Ionicons name="star" size={12} color="#FACC15" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                {pro.avg_rating != null ? Number(pro.avg_rating).toFixed(1) : "–"}
              </Text>
            </View>
          )}
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${colors.primary}1A`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

// ── BookingItem ───────────────────────────────────────────────────────────────
function BookingItem({ booking }: { booking: Booking }) {
  const router = useRouter();
  const colors = useThemeColors();
  const scale = useRef(new Animated.Value(1)).current;
  const proName =
    booking.pro_activity_name ??
    `${booking.pro_first_name ?? ""} ${booking.pro_last_name ?? ""}`.trim();
  const date = new Date(booking.start_datetime);
  const dateStr = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })} // BLYSS-FIX: 1.3
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          { backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: "rgba(254,93,157,0.2)", marginBottom: 12, padding: 16, flexDirection: "row", gap: 16, alignItems: "center" },
          Shadows.soft,
        ]}
      >
        <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 18 }}>
            {(proName[0] ?? "?").toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", fontSize: 15, color: colors.foreground }}>{proName}</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
            {booking.prestation_name ?? "Prestation"}
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8, alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{dateStr}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <Ionicons name="time-outline" size={12} color={colors.primary} />
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>{timeStr}</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </Pressable>
    </Animated.View>
  );
}

// ── EmptyBookingsPulse ────────────────────────────────────────────────────────
function EmptyBookingsIcon() {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={{ transform: [{ scale: pulse }] }}
      className="w-12 h-12 rounded-2xl bg-primary items-center justify-center flex-shrink-0"
    >
      <Ionicons name="calendar-outline" size={22} color={colors.onColor} />
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ClientHome() {
  const { user } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const flatListRef = useRef(null);
  useScrollToTop(flatListRef);

  // ── Entrance animation ──────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(reduceMotion ? 0 : 30)).current;
  const nameSlide = useRef(new Animated.Value(reduceMotion ? 0 : 20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(nameSlide, { toValue: 0, duration: 380, delay: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Search bar press feedback ─────────────────────────────────────────────
  const searchScale = useRef(new Animated.Value(1)).current;
  const searchBorderAnim = useRef(new Animated.Value(0)).current;
  const handleSearchPressIn = () => {
    Animated.parallel([
      Animated.spring(searchScale, { toValue: 1.02, useNativeDriver: true, speed: 40 }),
      Animated.timing(searchBorderAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };
  const handleSearchPressOut = () => {
    Animated.parallel([
      Animated.spring(searchScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
      Animated.timing(searchBorderAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };
  const searchBorderColor = searchBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  // ── Data queries ─────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);

  const { data: proRes, isLoading: loadingPros, refetch: refetchPros } = useQuery({
    queryKey: ["pros", "home"],
    queryFn: () => specialistsApi.getPros({ limit: 8 }),
    staleTime: 2 * 60_000,
  });

  const { data: bookingsRes } = useQuery({
    queryKey: ["client-bookings"],
    queryFn: () => clientApi.getMyBookings(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const { isFavorited, toggle: toggleFav } = useFavorites();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchPros(),
      queryClient.invalidateQueries({ queryKey: ["client-bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["favorites"] }),
    ]);
    setRefreshing(false);
  }, [refetchPros, queryClient]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const pros = (Array.isArray(proRes?.data) ? proRes.data : []) as Pro[];
  const bookings = (Array.isArray(bookingsRes?.data) ? bookingsRes.data : []) as Booking[];

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            (b.status === "pending" || b.status === "confirmed") &&
            new Date(b.start_datetime) > new Date()
        )
        .sort(
          (a, b) =>
            new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
        )
        .slice(0, 2),
    [bookings]
  );

  const greetingPrefix = user?.first_name ? "Salut" : "Bienvenue";
  const greetingName = user?.first_name ?? "";

  // ── Render helpers ────────────────────────────────────────────────────────
  const handleCategoryPress = useCallback(
    (item: (typeof CATEGORIES)[number]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedCategory((prev) => (prev === item.query ? null : item.query));
      router.push({ pathname: "/specialists", params: { service: item.query } });
    },
    [router]
  );

  const renderCategory = useCallback<ListRenderItem<(typeof CATEGORIES)[number]>>(
    ({ item }) => {
      const isSelected = selectedCategory === item.query;
      return (
        <Pressable
          onPress={() => handleCategoryPress(item)}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 2,
            backgroundColor: isSelected ? `${colors.primary}1A` : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
          }}
        >
          <Text
            style={{ fontSize: 12, fontWeight: "600", color: isSelected ? colors.primary : colors.foreground }}
          >
            {item.label}
          </Text>
        </Pressable>
      );
    },
    [selectedCategory, handleCategoryPress, colors]
  );

  const renderSpecialist = useCallback<ListRenderItem<Pro>>(
    ({ item, index }) => (
      <SpecialistCard
        pro={item}
        index={index}
        isFavorite={isFavorited(item.id)}
        onToggleFav={toggleFav}
      />
    ),
    [isFavorited, toggleFav]
  );

  const handlePrimaryCta = (path: "/specialists") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push(path);
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Animated.View
        style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
      <FlatList
        ref={flatListRef}
        data={[]}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={MAIN_LIST_STYLE}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={10}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: colors.foreground, letterSpacing: -0.5 }}>
                {greetingPrefix}{" "}
                <Animated.Text style={{ transform: [{ translateX: nameSlide }] }}>
                  {greetingName}
                </Animated.Text>
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                Trouve ta prochaine experte près de chez toi
              </Text>
            </View>

            {/* ── Search bar (tap → specialists) ─────────────────────────── */}
            <Animated.View
              style={{
                marginHorizontal: 24,
                marginBottom: 12,
                transform: [{ scale: searchScale }],
              }}
            >
              <Pressable
                onPress={() => router.push("/specialists")}
                onPressIn={handleSearchPressIn}
                onPressOut={handleSearchPressOut}
              >
                <Animated.View
                  style={[
                    {
                      height: 56,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: colors.card,
                      borderWidth: 2,
                      borderColor: searchBorderColor,
                      borderRadius: 16,
                      paddingHorizontal: 16,
                    },
                    Shadows.card,
                  ]}
                >
                  <Ionicons name="search-outline" size={20} color={colors.mutedForeground} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.mutedForeground }}>
                    Experte, ville, prestation...
                  </Text>
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* ── Category chips ──────────────────────────────────────────── */}
            <FlatList
              horizontal
              data={CATEGORIES as unknown as (typeof CATEGORIES)[number][]}
              keyExtractor={(item) => item.query}
              renderItem={renderCategory}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={CATEGORY_LIST_STYLE}
              style={{ marginBottom: 24 }}
            />

            {/* ── Sélection Blyss header ─────────────────────────────────── */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 12 }}>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Sélection Blyss</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {pros.length} experte{pros.length > 1 ? "s" : ""} disponible{pros.length > 1 ? "s" : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => handlePrimaryCta("/specialists")}
                className="flex-row items-center gap-1 px-4 py-2 rounded-full bg-primary active:opacity-80"
                style={Shadows.soft}
              >
                <Text className="text-xs font-semibold text-white">Tout voir</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.onColor} />
              </Pressable>
            </View>

            {/* ── Specialist cards (FlatList horizontal) ─────────────────── */}
            {loadingPros ? (
              <FlatList
                horizontal
                data={[1, 2, 3]}
                keyExtractor={(item) => String(item)}
                renderItem={() => <SpecialistCardSkeleton />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={SPECIALIST_LIST_STYLE}
                scrollEnabled={false}
              />
            ) : (
              <FlatList
                horizontal
                data={pros}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderSpecialist}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={SPECIALIST_LIST_STYLE}
                snapToInterval={CARD_SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
              />
            )}

            {/* ── Tes nails à venir ──────────────────────────────────────── */}
            <View style={{ paddingHorizontal: 24, marginTop: 32, marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Tes nails à venir</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                Tes prochains rendez-vous beauté
              </Text>
            </View>

            {upcomingBookings.length === 0 ? (
              <View
                style={{
                  marginHorizontal: 24, padding: 20, borderRadius: 16,
                  backgroundColor: `${colors.primary}0D`,
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: `${colors.primary}4D`,
                }}
              >
                <View className="flex-row gap-4 items-start">
                  <EmptyBookingsIcon />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", fontSize: 15, color: colors.foreground }}>
                      Aucun rendez-vous prévu
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4, lineHeight: 16 }}>
                      Réserve dès maintenant auprès d'une experte près de chez toi
                    </Text>
                    <Pressable
                      onPress={() => handlePrimaryCta("/specialists")}
                      className="mt-3 px-4 py-3 rounded-xl bg-primary self-start active:opacity-80"
                    >
                      <View className="flex-row gap-1.5 items-center">
                        <Text className="text-white text-xs font-semibold">
                          Découvrir les expertes
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View className="px-6">
                {upcomingBookings.map((b) => (
                  <BookingItem key={b.id} booking={b} />
                ))}
              </View>
            )}
          </>
        }
      />
      </Animated.View>
    </SafeAreaView>
  );
}
