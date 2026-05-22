import React, { useRef, useEffect } from "react";
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
import { Colors } from "@/constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFavorites } from "@/hooks/useFavorites";
import {
  SpecialistCard,
} from "@/components/screens/client/specialists/SpecialistCard";

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favorites, isLoading, isFetching, refetch, removeFavorite } = useFavorites();

  // ── Entrance animation ────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Empty state animations ────────────────────────────────────────────────
  const emptyScaleAnim = useRef(new Animated.Value(0)).current;
  const emptyFade1 = useRef(new Animated.Value(0)).current;
  const emptySlide1 = useRef(new Animated.Value(16)).current;
  const emptyFade2 = useRef(new Animated.Value(0)).current;
  const emptySlide2 = useRef(new Animated.Value(16)).current;
  const emptyFade3 = useRef(new Animated.Value(0)).current;
  const emptySlide3 = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!isLoading && favorites.length === 0) {
      emptyScaleAnim.setValue(0);
      emptyFade1.setValue(0); emptySlide1.setValue(16);
      emptyFade2.setValue(0); emptySlide2.setValue(16);
      emptyFade3.setValue(0); emptySlide3.setValue(16);
      Animated.sequence([
        Animated.delay(100),
        Animated.spring(emptyScaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      ]).start();
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(emptyFade1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(emptySlide1, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
      Animated.sequence([
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(emptyFade2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(emptySlide2, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
      Animated.sequence([
        Animated.delay(360),
        Animated.parallel([
          Animated.timing(emptyFade3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(emptySlide3, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [isLoading, favorites.length]);

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
            {isLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} />
            ) : (
              <>
                <Animated.View
                  style={{
                    width: 128, height: 128, borderRadius: 64,
                    backgroundColor: "rgba(254,93,157,0.12)",
                    alignItems: "center", justifyContent: "center",
                    marginBottom: 24,
                    transform: [{ scale: emptyScaleAnim }],
                  }}
                >
                  <Ionicons name="heart" size={64} color={Colors.primary} />
                </Animated.View>

                <Animated.Text
                  style={{
                    fontSize: 22, fontWeight: "800", color: Colors.foreground,
                    marginBottom: 8, textAlign: "center",
                    opacity: emptyFade1,
                    transform: [{ translateY: emptySlide1 }],
                  }}
                >
                  Aucun favori
                </Animated.Text>

                <Animated.Text
                  style={{
                    fontSize: 14, color: Colors.mutedForeground, textAlign: "center",
                    maxWidth: 280, lineHeight: 20, marginBottom: 32,
                    opacity: emptyFade2,
                    transform: [{ translateY: emptySlide2 }],
                  }}
                >
                  Ajoute des prothésistes à tes favoris pour les retrouver facilement
                </Animated.Text>

                <Animated.View style={{ opacity: emptyFade3, transform: [{ translateY: emptySlide3 }] }}>
                  <Pressable
                    onPress={() => router.push("/specialists")}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: Colors.primary,
                      paddingHorizontal: 32,
                      paddingVertical: 16,
                      borderRadius: 32,
                      shadowColor: Colors.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      elevation: 8,
                    }}>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                        Découvrir des pros
                      </Text>
                    </View>
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
                onBook={() => router.push({ pathname: "/booking", params: { proId: item.id } })}
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
});
