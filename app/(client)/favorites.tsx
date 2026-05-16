import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

  const { data: favorites = [], isLoading, isFetching, refetch } = useQuery<Specialist[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await favoritesApi.getAll();
      if (!res.success || !res.data) return [];
      return (res.data as FavoriteRaw[]).map((f) => ({
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
      }));
    },
    staleTime: 60_000,
  });

  const removeFavorite = useCallback(
    (proId: number) => {
      // Optimistic remove
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

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#FE5D9D" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 }}>
          Mes favoris
        </Text>
        <Text style={{ fontSize: 13, color: "#6D6D78", marginTop: 4 }}>
          {favorites.length > 0
            ? `${favorites.length} experte${favorites.length > 1 ? "s" : ""} sauvegardée${favorites.length > 1 ? "s" : ""}`
            : "Retrouve ici tes expertes préférées"}
        </Text>
      </View>

      {favorites.length === 0 ? (
        /* ── Empty state ── */
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#FFE6F0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="heart-outline" size={44} color="#FE5D9D" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#09090B", textAlign: "center" }}>
            Aucun favori
          </Text>
          <Text style={{ fontSize: 14, color: "#6D6D78", textAlign: "center", lineHeight: 20, maxWidth: 280 }}>
            Ajoute des prothésistes à tes favoris pour les retrouver facilement
          </Text>
          <Pressable onPress={() => router.push("/(client)/specialists")} style={{ marginTop: 8 }}>
            <LinearGradient
              colors={["#FE5D9D", "rgba(254,93,157,0.9)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 52,
                borderRadius: 16,
                paddingHorizontal: 32,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                shadowColor: "#FE5D9D",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Découvrir des pros</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <View style={{ marginBottom: 4 }}>
              <SpecialistCard
                item={item}
                isFav
                index={index}
                onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: item.id } })}
                onToggleFav={() => removeFavorite(item.id)}
              />
              {/* Remove button */}
              <Pressable
                onPress={() => removeFavorite(item.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 10,
                  marginTop: -12,
                  marginHorizontal: 0,
                  backgroundColor: "#FFFFFF",
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: "#EBE6E066",
                  marginBottom: 8,
                }}
              >
                <Ionicons name="heart" size={14} color="#EF4444" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#EF4444" }}>
                  Retirer des favoris
                </Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#FE5D9D" />
          }
        />
      )}
    </SafeAreaView>
  );
}
