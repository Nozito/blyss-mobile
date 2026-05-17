import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Animated,
  type ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { specialistsApi, favoritesApi, clientApi } from "@/lib/api";
import { Shadows } from "@/constants/shadows";

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: "Pose gel",     emoji: "💅", query: "gel" },
  { label: "Semi-perm.",   emoji: "✨", query: "semi-permanent" },
  { label: "French",       emoji: "🤍", query: "french" },
  { label: "Nail art",     emoji: "🎨", query: "nail art" },
  { label: "Manucure",     emoji: "💎", query: "manucure" },
  { label: "Baby boomer",  emoji: "🌸", query: "baby boomer" },
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

// ── SpecialistCard ────────────────────────────────────────────────────────────
function SpecialistCard({
  pro,
  isFavorite,
  onToggleFav,
}: {
  pro: Pro;
  isFavorite: boolean;
  onToggleFav: (id: number) => void;
}) {
  const router = useRouter();
  const heartScale = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const displayName = pro.activity_name ?? `${pro.first_name} ${pro.last_name}`;
  const specialty = pro.pro_specialties?.[0] ?? "Nail Artist";
  const bannerUrl = pro.banner_photo ?? pro.profile_photo;

  const handleHeartPress = () => {
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
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
    <Pressable
      onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: pro.id } })}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ width: 280, borderRadius: 24, overflow: "hidden" }, Shadows.card]}
      className="border-2 border-border bg-card"
    >
      {/* Cover image */}
      <View className="bg-muted" style={{ height: 192 }}>
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={["#FFE6F0", "#FE5D9D"]}
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
              color={isFavorite ? "#EF4444" : "#6D6D78"}
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
            {pro.profile_photo ? (
              <Image
                source={{ uri: pro.profile_photo }}
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
      <View className="px-4 py-3 flex-row items-center justify-between">
        <View className="flex-row gap-1 items-center">
          <Ionicons name="location-outline" size={13} color="#6D6D78" />
          <Text className="text-xs text-muted-foreground">{pro.city ?? "France"}</Text>
        </View>
        <View className="flex-row gap-3 items-center">
          {pro.avg_rating != null && (
            <View
              className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#fefce8" }}
            >
              <Ionicons name="star" size={12} color="#FACC15" />
              <Text className="text-xs font-bold text-foreground">
                {pro.avg_rating != null ? Number(pro.avg_rating).toFixed(1) : "–"}
              </Text>
            </View>
          )}
          <View className="w-7 h-7 rounded-lg bg-primary/10 items-center justify-center">
            <Ionicons name="chevron-forward" size={15} color="#FE5D9D" />
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
  const proName =
    booking.pro_activity_name ??
    `${booking.pro_first_name ?? ""} ${booking.pro_last_name ?? ""}`.trim();
  const date = new Date(booking.start_datetime);
  const dateStr = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Pressable
      onPress={() => router.push("/(client)/my-bookings")}
      className="bg-card rounded-2xl border-2 mb-3 p-4 flex-row gap-4 items-center active:opacity-80"
      style={[{ borderColor: "rgba(254,93,157,0.2)" }, Shadows.soft]}
    >
      <View className="w-14 h-14 rounded-xl bg-primary items-center justify-center flex-shrink-0">
        <Text className="text-white font-bold text-lg">
          {(proName[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-bold text-base text-foreground">{proName}</Text>
        <Text className="text-sm text-muted-foreground mt-0.5">
          {booking.prestation_name ?? "Prestation"}
        </Text>
        <View className="flex-row gap-3 mt-2 items-center">
          <View className="flex-row gap-1 items-center">
            <Ionicons name="calendar-outline" size={12} color="#6D6D78" />
            <Text className="text-xs text-muted-foreground">{dateStr}</Text>
          </View>
          <View className="flex-row gap-1 items-center">
            <Ionicons name="time-outline" size={12} color="#FE5D9D" />
            <Text className="text-xs text-primary font-semibold">{timeStr}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6D6D78" />
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ClientHome() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  // ── Entrance animation ──────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: proRes, isLoading: loadingPros } = useQuery({
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

  const { data: favRes } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesApi.getAll(),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Sync favoriteIds from query (replaces deprecated onSuccess)
  useEffect(() => {
    const ids = new Set<number>(
      ((favRes?.data as Array<{ pro_id: number }>) ?? []).map((f) => f.pro_id)
    );
    setFavoriteIds(ids);
  }, [favRes]);

  // ── Favorite mutation ─────────────────────────────────────────────────────
  const toggleFavMutation = useMutation({
    mutationFn: async (proId: number) => {
      if (favoriteIds.has(proId)) await favoritesApi.remove(proId);
      else await favoritesApi.add(proId);
    },
    onMutate: (proId: number) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(proId)) next.delete(proId);
        else next.add(proId);
        return next;
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const pros = ((proRes?.data as unknown[]) ?? []) as Pro[];
  const bookings = ((bookingsRes?.data as unknown[]) ?? []) as Booking[];

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

  const greeting = user?.first_name ? `Salut ${user.first_name}` : "Bienvenue";

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderCategory: ListRenderItem<(typeof CATEGORIES)[number]> = ({ item }) => (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/(client)/specialists", params: { search: item.query } })
      }
      className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border-2 border-border active:border-primary active:opacity-80"
    >
      <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
      <Text className="text-xs font-semibold text-foreground">{item.label}</Text>
    </Pressable>
  );

  const renderSpecialist: ListRenderItem<Pro> = ({ item }) => (
    <SpecialistCard
      pro={item}
      isFavorite={favoriteIds.has(item.id)}
      onToggleFav={(id) => toggleFavMutation.mutate(id)}
    />
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Animated.View
        style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
      <FlatList
        data={[]}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <View className="px-6 pt-4 pb-2">
              <Text className="text-2xl font-black text-foreground tracking-tight">
                {greeting} 👋
              </Text>
              <Text className="text-sm text-muted-foreground mt-0.5">
                Tes nails parfaites, en quelques clics ✨
              </Text>
            </View>

            {/* ── Search bar (tap → specialists) ─────────────────────────── */}
            <Pressable
              onPress={() => router.push("/(client)/specialists")}
              className="mx-6 mb-3 h-14 flex-row items-center gap-3 bg-card border-2 border-border rounded-2xl px-4"
              style={Shadows.card}
            >
              <Ionicons name="search-outline" size={20} color="#6D6D78" />
              <Text className="text-muted-foreground text-sm flex-1">
                Experte, ville, prestation...
              </Text>
            </Pressable>

            {/* ── Category chips ──────────────────────────────────────────── */}
            <FlatList
              horizontal
              data={CATEGORIES as unknown as (typeof CATEGORIES)[number][]}
              keyExtractor={(item) => item.query}
              renderItem={renderCategory}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 4 }}
              style={{ marginBottom: 24 }}
            />

            {/* ── Sélection Blyss header ─────────────────────────────────── */}
            <View className="flex-row items-center justify-between px-6 mb-3">
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xl font-bold text-foreground">Sélection Blyss</Text>
                </View>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {pros.length} experte{pros.length > 1 ? "s" : ""} disponible{pros.length > 1 ? "s" : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push("/(client)/specialists")}
                className="flex-row items-center gap-1 px-4 py-2 rounded-full bg-primary"
                style={Shadows.soft}
              >
                <Text className="text-xs font-semibold text-white">Tout voir</Text>
                <Ionicons name="chevron-forward" size={12} color="#fff" />
              </Pressable>
            </View>

            {/* ── Specialist cards (FlatList horizontal) ─────────────────── */}
            {loadingPros ? (
              <View className="h-64 items-center justify-center">
                <ActivityIndicator color="#FE5D9D" />
              </View>
            ) : (
              <FlatList
                horizontal
                data={pros}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderSpecialist}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, gap: 16, paddingVertical: 8 }}
              />
            )}

            {/* ── CTA "Voir toutes les expertes" ─────────────────────────── */}
            <Pressable
              onPress={() => router.push("/(client)/specialists")}
              className="mx-6 mt-3 py-3.5 rounded-2xl bg-primary items-center justify-center"
              style={Shadows.soft}
            >
              <View className="flex-row gap-2 items-center">
                <Text className="text-white font-semibold text-sm">
                  Voir toutes les expertes
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </Pressable>

            {/* ── Tes nails à venir ──────────────────────────────────────── */}
            <View className="px-6 mt-8 mb-3">
              <Text className="text-xl font-bold text-foreground">Tes nails à venir</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Tes prochains rendez-vous beauté
              </Text>
            </View>

            {upcomingBookings.length === 0 ? (
              <View
                className="mx-6 p-5 rounded-2xl"
                style={{
                  backgroundColor: "rgba(254,93,157,0.05)",
                  borderWidth: 2,
                  borderStyle: "dashed",
                  borderColor: "rgba(254,93,157,0.3)",
                }}
              >
                <View className="flex-row gap-4 items-start">
                  <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center flex-shrink-0">
                    <Ionicons name="calendar-outline" size={22} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-base text-foreground">
                      Aucun rendez-vous prévu
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-1 leading-4">
                      Réserve dès maintenant auprès d'une experte près de chez toi
                    </Text>
                    <Pressable
                      onPress={() => router.push("/(client)/specialists")}
                      className="mt-3 px-4 py-2 rounded-xl bg-primary self-start"
                    >
                      <View className="flex-row gap-1.5 items-center">
                        <Ionicons name="sparkles-outline" size={14} color="#fff" />
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
