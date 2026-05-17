import React, { useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { favoritesApi } from "@/lib/api";
import {
  SpecialistCard,
  type Specialist,
} from "@/components/screens/client/specialists/SpecialistCard";

interface FavoriteRaw {
  pro_id: number;
  first_name: string;
  last_name: string;
  activity_name: string | null;
  city: string | null;
  profile_photo: string | null;
  specialty: string | null;
  avg_rating: number;
  reviews_count: number;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // ── Entrance animation ────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── CTA pulse every 3 s ───────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: favorites = [], isFetching, refetch } = useQuery<Specialist[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await favoritesApi.getAll();
      if (!res.success || !Array.isArray(res.data)) return [];
      return res.data.map((raw) => {
        const f = raw as FavoriteRaw;
        return {
          id: f.pro_id,
          business_name: f.activity_name || `${f.first_name} ${f.last_name}`,
          specialty: f.specialty || "Prothésiste ongulaire",
          city: f.city || "",
          rating: Number(f.avg_rating) || 0,
          reviews_count: Number(f.reviews_count) || 0,
          profile_image_url: f.profile_photo,
          cover_image_url: null,
          first_name: f.first_name,
          distance_km: null,
        };
      });
    },
    staleTime: 60_000,
  });

  const removeFavorite = useCallback(
    (proId: number) => {
      queryClient.setQueryData<Specialist[]>(["favorites"], (prev = []) =>
        prev.filter((f) => f.id !== proId)
      );
      queryClient.setQueryData<Set<number>>(["favorites-ids"], (prev = new Set()) => {
        const next = new Set(prev);
        next.delete(proId);
        return next;
      });
      favoritesApi.remove(proId).catch(() => {
        void queryClient.invalidateQueries({ queryKey: ["favorites"] });
        void queryClient.invalidateQueries({ queryKey: ["favorites-ids"] });
      });
    },
    [queryClient]
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#FFEAF1", paddingTop: insets.top }}>
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#111" }}>
            Mes favoris
          </Text>
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}>
            Retrouve ici tes expertes préférées
          </Text>
        </View>

        {favorites.length === 0 ? (
          /* ── Empty state ── */
          <View style={styles.emptyContainer}>
            {isFetching ? (
              <ActivityIndicator size="large" color="#FE5D9D" />
            ) : (
              <>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="heart-outline" size={48} color="#FE5D9D" />
                </View>

                <Text style={{ fontSize: 20, fontWeight: "800", color: "#111" }}>
                  Aucun favori
                </Text>
                <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center", lineHeight: 20 }}>
                  Ajoute des prothésistes à tes favoris{"\n"}
                  pour les retrouver facilement
                </Text>

                {/* CTA avec pulse toutes les 3 s */}
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Pressable
                    onPress={() => router.push("/(client)/specialists")}
                    style={styles.discoverButton}
                  >
                    <Ionicons name="sparkles-outline" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                      Découvrir des pros
                    </Text>
                  </Pressable>
                </Animated.View>
              </>
            )}
          </View>
        ) : (
          /* ── Favorites list ── */
          <FlatList
            data={favorites}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item, index }) => (
              <SpecialistCard
                item={item}
                isFav
                index={index}
                onPress={() =>
                  router.push({ pathname: "/specialist/[id]", params: { id: item.id } })
                }
                onToggleFav={() => removeFavorite(item.id)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#FE5D9D" />
            }
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FDE8EF",
    alignItems: "center",
    justifyContent: "center",
  },
  discoverButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FE5D9D",
    borderRadius: 999,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
});
