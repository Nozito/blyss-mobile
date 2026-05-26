import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_H } = Dimensions.get("window");

const FEATURES = [
  { icon: "flash-outline" as const,             label: "Réservations",       color: "#FE5D9D", bg: "#FFF0F5" },
  { icon: "people-outline" as const,            label: "Clients fidèles",    color: "#10B981", bg: "#F0FFF4" },
  { icon: "shield-checkmark-outline" as const,  label: "Paiements sécurisés", color: "#3B82F6", bg: "#EFF6FF" },
] as const;

const CARD_H = SCREEN_H * 0.46;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Slide-up de la carte blanche
  const cardY = useRef(new Animated.Value(CARD_H)).current;
  // Fade-in du hero
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 520,
        delay: 80,
        useNativeDriver: true,
      }),
      Animated.timing(heroY, {
        toValue: 0,
        duration: 520,
        delay: 80,
        useNativeDriver: true,
      }),
      Animated.spring(cardY, {
        toValue: 0,
        delay: 200,
        speed: 14,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      {/* ── Hero gradient ───────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#E8187A", "#FE5D9D", "#FF8EC4"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.hero}
      >
        {/* Cercles décoratifs */}
        <View style={styles.circle1} />
        <View style={styles.circle2} />

        <Animated.View
          style={[
            styles.heroContent,
            { paddingTop: insets.top + 32 },
            { opacity: heroOpacity, transform: [{ translateY: heroY }] },
          ]}
        >
          <View style={styles.logoBadge}>
            <Image
              source={require("@/assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.brand}>Blyss</Text>
          <Text style={styles.tagline}>Beauté. Business. Sérénité.</Text>
          <Text style={styles.heroSub}>
            La plateforme tout-en-un{"\n"}pour les pros du nail art
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* ── Carte blanche (slide-up) ────────────────────────────────────── */}
      <Animated.View
        style={[styles.card, { transform: [{ translateY: cardY }] }]}
      >
        {/* Features pills */}
        <View style={styles.pillRow}>
          {FEATURES.map((f) => (
            <View key={f.label} style={[styles.pill, { backgroundColor: f.bg }]}>
              <Ionicons name={f.icon} size={14} color={f.color} />
              <Text style={[styles.pillLabel, { color: f.color }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA principal */}
        <Pressable
          onPress={() => router.push("/(auth)/register")}
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
        >
          <LinearGradient
            colors={["#E8187A", "#FE5D9D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>Commencer gratuitement</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </Pressable>

        {/* Connexion */}
        <Pressable
          onPress={() => router.push("/(auth)/login")}
          style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.loginText}>J'ai déjà un compte</Text>
        </Pressable>

        {/* Footer légal */}
        <Text style={[styles.legal, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {"En continuant, tu acceptes nos "}
          <Text style={styles.legalLink}>Conditions générales</Text>
          {" et la "}
          <Text style={styles.legalLink}>Politique de confidentialité</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E8187A",
  },

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: {
    flex: 1,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -80,
    right: -80,
  },
  circle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: 60,
    left: -60,
  },
  heroContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.30)",
  },
  logo: {
    width: 58,
    height: 58,
  },
  brand: {
    fontSize: 42,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.90)",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.70)",
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Carte ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 10,
  },

  // ── Pills ─────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 28,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── CTA ───────────────────────────────────────────────────────────────
  ctaBtn: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaGradient: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.3,
  },

  // ── Login ─────────────────────────────────────────────────────────────
  loginBtn: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },
  loginText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 15,
  },

  // ── Legal ─────────────────────────────────────────────────────────────
  legal: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    textDecorationLine: "underline",
    color: "#6B7280",
  },
});
