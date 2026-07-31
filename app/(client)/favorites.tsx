import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Animated,
  type ListRenderItem,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { useFavorites } from "@/hooks/useFavorites";
import { SpecialistCard, type Specialist } from "@/components/screens/client/specialists/SpecialistCard";

// Module-level style constants — never recreated
const CATEGORY_LIST_STYLE = { paddingBottom: 4, paddingHorizontal: 20, paddingTop: 8 } as const;

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { favorites, isLoading, isFetching, refetch, toggle, isToggling } = useFavorites();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);

  // ── Entrance animation ────────────────────────────────────────────────────
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Empty state animations ────────────────────────────────────────────────
  // Valeurs finales par défaut (visibles) : sur cet écran persisté par la tab
  // bar, l'effet ci-dessous peut se redéclencher plusieurs fois de suite (va-et-
  // vient favorites.length 0→1→0 pendant des mutations rapprochées) et repartir
  // d'un `setValue(0)` sans jamais terminer son animation — le contenu restait
  // alors invisible en permanence. Partir déjà visible élimine ce risque ; le
  // useEffect ne fait plus que rejouer un effet ponctuel, jamais bloquant.
  const emptyScaleAnim = useRef(new Animated.Value(1)).current;
  const emptyFade1  = useRef(new Animated.Value(1)).current;
  const emptySlide1 = useRef(new Animated.Value(0)).current;
  const emptyFade2  = useRef(new Animated.Value(1)).current;
  const emptySlide2 = useRef(new Animated.Value(0)).current;
  const emptyFade3  = useRef(new Animated.Value(1)).current;
  const emptySlide3 = useRef(new Animated.Value(0)).current;
  const hasPlayedEmptyAnim = useRef(false);

  useEffect(() => {
    if (isLoading || favorites.length !== 0 || hasPlayedEmptyAnim.current) return;
    hasPlayedEmptyAnim.current = true;
    emptyScaleAnim.setValue(0);
    emptyFade1.setValue(0);  emptySlide1.setValue(16);
    emptyFade2.setValue(0);  emptySlide2.setValue(16);
    emptyFade3.setValue(0);  emptySlide3.setValue(16);
    Animated.sequence([
      Animated.delay(100),
      Animated.spring(emptyScaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
    ]).start();
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(emptyFade1,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(emptySlide1, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(emptyFade2,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(emptySlide2, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(360),
      Animated.parallel([
        Animated.timing(emptyFade3,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(emptySlide3, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [isLoading, favorites.length]);

  // ── Stable content style (depends only on insets) ────────────────────────
  const contentStyle = useCallback(
    () => ({ paddingBottom: insets.bottom + 24, paddingHorizontal: 20, paddingTop: 8 }),
    [insets.bottom]
  );

  // ── Memoized render item — toggle uses proper removeMutation with rollback ─
  const renderItem = useCallback<ListRenderItem<Specialist>>(
    ({ item, index }) => (
      <SpecialistCard
        item={item}
        isFav
        index={index}
        onPress={() => router.push({ pathname: "/specialist/[id]", params: { id: item.id } })}
        onBook={() => router.push({ pathname: "/booking", params: { proId: item.id } })}
        onToggleFav={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          toggle(item.id);
        }}
      />
    ),
    [router, toggle]
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
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
          opacity: emptyFade1, transform: [{ translateY: emptySlide1 }],
        }}
      >
        Aucun favori
      </Animated.Text>

      <Animated.Text
        style={{
          fontSize: 14, color: Colors.mutedForeground, textAlign: "center",
          maxWidth: 280, lineHeight: 20, marginBottom: 32,
          opacity: emptyFade2, transform: [{ translateY: emptySlide2 }],
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
            flexDirection: "row", alignItems: "center", gap: 8,
            backgroundColor: Colors.primary,
            paddingHorizontal: 32, paddingVertical: 16,
            borderRadius: 32,
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
          }}>
            <Ionicons name="sparkles" size={20} color={Colors.white} />
            <Text style={{ color: Colors.white, fontSize: 16, fontWeight: "700" }}>
              Découvrir des pros
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 28, fontWeight: "800", color: Colors.foreground }}>
              Mes favoris
            </Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginTop: 4 }}>
              {favorites.length > 0
                ? `${favorites.length} experte${favorites.length > 1 ? "s" : ""} sauvegardée${favorites.length > 1 ? "s" : ""}`
                : "Retrouve ici tes expertes préférées"}
            </Text>
          </View>
          {isToggling && (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 4 }} />
          )}
        </View>

        {/* Body */}
        {isLoading && favorites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : favorites.length > 0 ? (
          <FlatList
            ref={listRef}
            data={favorites}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={contentStyle()}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={Colors.primary} />
            }
            removeClippedSubviews
          />
        ) : (
          renderEmpty()
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
