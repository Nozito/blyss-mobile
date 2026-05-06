import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { favoritesApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

interface FavoriteItem {
  id: number;
  name: string;
  specialty: string;
  location: string;
  rating: number;
  reviews: number;
  profile_image_url: string | null;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading, error, refetch } = useQuery<FavoriteItem[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await favoritesApi.getAll();
      if (!res.success) throw new Error(res.error ?? "Erreur de chargement");
      return (
        (res.data as Array<Record<string, unknown>> | undefined) ?? []
      ).map((fav) => ({
        id: (fav.pro_id as number) ?? (fav.id as number),
        name:
          (fav.activity_name as string | null) ||
          `${fav.first_name ?? ""} ${fav.last_name ?? ""}`.trim(),
        specialty:
          (fav.specialty as string | null) || "Prothésiste ongulaire",
        location: (fav.city as string | null) || "France",
        rating: Number(fav.avg_rating) || 0,
        reviews: Number(fav.reviews_count) || 0,
        profile_image_url: (fav.profile_photo as string | null) ?? null,
      }));
    },
    staleTime: 60_000,
  });

  const removeFavorite = useCallback(
    async (proId: number) => {
      queryClient.setQueryData<FavoriteItem[]>(["favorites"], (prev = []) =>
        prev.filter((f) => f.id !== proId)
      );
      queryClient.setQueryData<Set<number>>(["favorites-ids"], (prev = new Set()) => {
        const next = new Set(prev);
        next.delete(proId);
        return next;
      });
      try {
        await favoritesApi.remove(proId);
        void queryClient.invalidateQueries({ queryKey: ["favorites"] });
        void queryClient.invalidateQueries({ queryKey: ["favorites-ids"] });
      } catch {
        void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      }
    },
    [queryClient]
  );

  if (isLoading) {
    return (
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          paddingTop: insets.top,
        }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
      >
        <View style={{ height: 36, width: 144, backgroundColor: Colors.muted, borderRadius: 12, alignSelf: "center", marginBottom: 8 }} />
        <View style={{ height: 16, width: 192, backgroundColor: Colors.muted, borderRadius: 8, alignSelf: "center", marginBottom: 24 }} />
        {[...Array(4)].map((_, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              padding: 20,
              borderRadius: 24,
              backgroundColor: Colors.card,
              borderWidth: 2,
              borderColor: Colors.border,
              marginBottom: 12,
            }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.muted, flexShrink: 0 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ height: 16, width: "60%", backgroundColor: Colors.muted, borderRadius: 6 }} />
              <View style={{ height: 12, width: "45%", backgroundColor: Colors.muted, borderRadius: 6 }} />
              <View style={{ height: 12, width: "35%", backgroundColor: Colors.muted, borderRadius: 6 }} />
            </View>
            <View style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: Colors.muted }} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: `${Colors.destructive}1A`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Ionicons name="alert-circle-outline" size={40} color={Colors.destructive} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: Colors.foreground, marginBottom: 8 }}>Oups !</Text>
        <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center", marginBottom: 24 }}>
          {(error as Error).message}
        </Text>
        <Pressable
          onPress={() => void refetch()}
          style={{
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 16,
            backgroundColor: Colors.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: Colors.background,
        paddingTop: insets.top,
      }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(50).springify()}
        style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, alignItems: "center" }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: Colors.foreground,
            letterSpacing: -0.5,
            marginBottom: 4,
          }}
        >
          Mes favoris
        </Text>
        <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
          {favorites.length > 0
            ? `${favorites.length} experte${favorites.length > 1 ? "s" : ""} sauvegardée${favorites.length > 1 ? "s" : ""}`
            : "Retrouve ici tes expertes préférées"}
        </Text>
      </Animated.View>

      {favorites.length === 0 ? (
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={{
            alignItems: "center",
            paddingVertical: 80,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: `${Colors.primary}1A`,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <Ionicons name="heart-outline" size={64} color={Colors.primary} />
          </View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: Colors.foreground,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Aucun favori
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: Colors.mutedForeground,
              textAlign: "center",
              marginBottom: 32,
              maxWidth: 280,
            }}
          >
            Ajoute des prothésistes à tes favoris pour les retrouver
            facilement
          </Text>
          <Pressable
            onPress={() => router.push("/(client)")}
            style={{
              paddingHorizontal: 40,
              paddingVertical: 16,
              borderRadius: 24,
              backgroundColor: Colors.primary,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Ionicons name="sparkles-outline" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 17 }}>
              Découvrir des pros
            </Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          {favorites.map((specialist, index) => (
            <Animated.View
              key={specialist.id}
              entering={FadeInDown.delay(100 + index * 50).springify()}
            >
              <View
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: Colors.border,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 12,
                  elevation: 2,
                }}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/specialist/[id]",
                      params: { id: specialist.id },
                    })
                  }
                  style={{ padding: 20 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        overflow: "hidden",
                        flexShrink: 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      {specialist.profile_image_url ? (
                        <Image
                          source={{ uri: specialist.profile_image_url }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <LinearGradient
                          colors={[Colors.primary, `${Colors.primary}B3`]}
                          style={{
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 24,
                              fontWeight: "700",
                              color: "#fff",
                            }}
                          >
                            {specialist.name[0]}
                          </Text>
                        </LinearGradient>
                      )}
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "700",
                          color: Colors.foreground,
                          marginBottom: 2,
                        }}
                        numberOfLines={1}
                      >
                        {specialist.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: Colors.mutedForeground,
                          marginBottom: 8,
                        }}
                        numberOfLines={1}
                      >
                        {specialist.specialty}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: `${Colors.muted}80`,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                        >
                          <Ionicons
                            name="location-outline"
                            size={12}
                            color={Colors.mutedForeground}
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "500",
                              color: Colors.mutedForeground,
                            }}
                          >
                            {specialist.location}
                          </Text>
                        </View>

                        {specialist.rating > 0 && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              backgroundColor: "#FEF9C3",
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                            }}
                          >
                            <Ionicons name="star" size={12} color="#FBBF24" />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: Colors.foreground,
                              }}
                            >
                              {specialist.rating.toFixed(1)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: Colors.mutedForeground,
                              }}
                            >
                              ({specialist.reviews})
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={Colors.mutedForeground}
                      style={{ flexShrink: 0 }}
                    />
                  </View>
                </Pressable>

                {/* Remove button */}
                <Pressable
                  onPress={() => removeFavorite(specialist.id)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderTopWidth: 2,
                    borderTopColor: Colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="heart" size={16} color={Colors.destructive} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: Colors.destructive,
                    }}
                  >
                    Retirer des favoris
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
