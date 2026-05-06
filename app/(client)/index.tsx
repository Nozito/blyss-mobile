import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";
import { specialistsApi, favoritesApi, clientApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

const CATEGORIES = [
  { label: "Pose gel", emoji: "💅", query: "gel" },
  { label: "Semi-perm.", emoji: "✨", query: "semi-permanent" },
  { label: "French", emoji: "🤍", query: "french" },
  { label: "Nail art", emoji: "🎨", query: "nail art" },
  { label: "Manucure", emoji: "💎", query: "manucure" },
  { label: "Baby boomer", emoji: "🌸", query: "baby boomer" },
];

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
  const displayName = pro.activity_name ?? `${pro.first_name} ${pro.last_name}`;
  const specialty = pro.pro_specialties?.[0] ?? "Nail Artist";
  const imageUrl = pro.banner_photo ?? pro.profile_photo;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/specialist/[id]",
          params: { id: pro.id },
        })
      }
      style={{
        minWidth: 280,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: Colors.border,
        backgroundColor: Colors.card,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View style={{ height: 192, backgroundColor: Colors.muted }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <LinearGradient
            colors={[Colors.primaryLight, Colors.primary]}
            style={{ width: "100%", height: "100%" }}
          />
        )}
        <LinearGradient
          colors={[
            "rgba(0,0,0,0)",
            "rgba(0,0,0,0.3)",
            "rgba(0,0,0,0.85)",
          ]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <Pressable
          onPress={() => onToggleFav(pro.id)}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.9)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={18}
            color={isFavorite ? Colors.destructive : Colors.mutedForeground}
          />
        </Pressable>
        <View
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.9)",
              overflow: "hidden",
              backgroundColor: Colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {pro.profile_photo ? (
              <Image
                source={{ uri: pro.profile_photo }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 20 }}>
                {pro.first_name[0]}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
              {specialty}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{ flexDirection: "row", gap: 4, alignItems: "center" }}
        >
          <Ionicons
            name="location-outline"
            size={13}
            color={Colors.mutedForeground}
          />
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
            {pro.city ?? "France"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {pro.avg_rating != null && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "#fefce8",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Ionicons name="star" size={12} color="#FACC15" />
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}
              >
                {pro.avg_rating.toFixed(1)}
              </Text>
            </View>
          )}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: `${Colors.primary}1A`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function BookingItem({ booking }: { booking: Booking }) {
  const router = useRouter();
  const proName =
    booking.pro_activity_name ??
    `${booking.pro_first_name ?? ""} ${booking.pro_last_name ?? ""}`.trim();
  const date = new Date(booking.start_datetime);
  const dateStr = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(client)/my-bookings",
        })
      }
      style={{
        backgroundColor: Colors.card,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: `${Colors.primary}33`,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 12,
        padding: 16,
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: Colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
          {(proName[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontWeight: "700",
            fontSize: 15,
            color: Colors.foreground,
          }}
        >
          {proName}
        </Text>
        <Text
          style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}
        >
          {booking.prestation_name ?? "Prestation"}
        </Text>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={Colors.mutedForeground}
            />
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
              {dateStr}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Ionicons
              name="time-outline"
              size={12}
              color={Colors.primary}
            />
            <Text
              style={{
                fontSize: 12,
                color: Colors.primary,
                fontWeight: "600",
              }}
            >
              {timeStr}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={Colors.mutedForeground}
      />
    </Pressable>
  );
}

export default function ClientHome() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  const { data: proRes, isLoading: loadingPros } = useQuery({
    queryKey: ["pros", "home"],
    queryFn: () => specialistsApi.getPros({ limit: 8 }),
  });

  const { data: bookingsRes } = useQuery({
    queryKey: ["client-bookings"],
    queryFn: () => clientApi.getMyBookings(),
  });

  const { data: favRes } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesApi.getAll(),
    onSuccess: (res: { data?: unknown[] }) => {
      const ids = new Set<number>(
        ((res?.data as Array<{ pro_id: number }>) ?? []).map((f) => f.pro_id)
      );
      setFavoriteIds(ids);
    },
  } as Parameters<typeof useQuery>[0]);

  const toggleFavMutation = useMutation({
    mutationFn: async (proId: number) => {
      if (favoriteIds.has(proId)) {
        await favoritesApi.remove(proId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(proId);
          return next;
        });
      } else {
        await favoritesApi.add(proId);
        setFavoriteIds((prev) => new Set([...prev, proId]));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const pros = ((proRes?.data as unknown[]) ?? []) as Pro[];
  const bookings = ((bookingsRes?.data as unknown[]) ?? []) as Booking[];
  const upcomingBookings = bookings
    .filter(
      (b) =>
        (b.status === "pending" || b.status === "confirmed") &&
        new Date(b.start_datetime) > new Date()
    )
    .slice(0, 2);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(50).springify()}>
        <View
          style={{
            paddingHorizontal: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
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
            <Text
              style={{
                fontSize: 13,
                color: Colors.mutedForeground,
                marginTop: 2,
              }}
            >
              Tes nails parfaites, en quelques clics ✨
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(client)/notifications")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 16,
              backgroundColor: Colors.card,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={Colors.foreground}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/(client)/specialists")}
          style={{
            marginHorizontal: 24,
            marginBottom: 12,
            height: 56,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: Colors.card,
            borderWidth: 2,
            borderColor: Colors.border,
            borderRadius: 16,
            paddingHorizontal: 16,
          }}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={Colors.mutedForeground}
          />
          <Text
            style={{
              color: Colors.mutedForeground,
              fontSize: 14,
              flex: 1,
            }}
          >
            Experte, ville, prestation...
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 4 }}
          style={{ marginBottom: 24 }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.query}
              onPress={() =>
                router.push({
                  pathname: "/(client)/specialists",
                  params: { search: cat.query },
                })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: Colors.card,
                borderWidth: 2,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: Colors.foreground,
                }}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(150).springify()}
        style={{ marginBottom: 8 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            marginBottom: 12,
          }}
        >
          <View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: Colors.foreground,
                }}
              >
                Sélection Blyss
              </Text>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={Colors.primary}
              />
            </View>
            <Text
              style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}
            >
              {pros.length} experte(s) disponible(s)
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(client)/specialists")}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: Colors.primary,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}
            >
              Tout voir
            </Text>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </Pressable>
        </View>

        {loadingPros ? (
          <View style={{ height: 280, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={pros}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 16, paddingVertical: 8 }}
            renderItem={({ item }) => (
              <SpecialistCard
                pro={item}
                isFavorite={favoriteIds.has(item.id)}
                onToggleFav={(id) => toggleFavMutation.mutate(id)}
              />
            )}
          />
        )}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(200).springify()}
        style={{ paddingHorizontal: 24, marginTop: 8, marginBottom: 12 }}
      >
        <Pressable
          onPress={() => router.push("/(client)/specialists")}
          style={{
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: Colors.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Text
              style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}
            >
              Voir toutes les expertes
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(250).springify()}
        style={{ paddingHorizontal: 24, marginTop: 24 }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: Colors.foreground,
          }}
        >
          Tes nails à venir
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: Colors.mutedForeground,
            marginTop: 2,
            marginBottom: 12,
          }}
        >
          Tes prochains rendez-vous beauté
        </Text>

        {upcomingBookings.length === 0 ? (
          <View
            style={{
              padding: 20,
              borderRadius: 16,
              backgroundColor: `${Colors.primary}0D`,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: `${Colors.primary}4D`,
            }}
          >
            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: Colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="calendar-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontWeight: "600",
                    fontSize: 15,
                    color: Colors.foreground,
                  }}
                >
                  Aucun rendez-vous prévu
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.mutedForeground,
                    marginTop: 4,
                  }}
                >
                  Réserve ta prochaine séance avec une experte Blyss
                </Text>
                <Pressable
                  onPress={() => router.push("/(client)/specialists")}
                  style={{
                    marginTop: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: Colors.primary,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    Découvrir les expertes
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          upcomingBookings.map((b) => (
            <BookingItem key={b.id} booking={b} />
          ))
        )}
      </Animated.View>
    </ScrollView>
  );
}
