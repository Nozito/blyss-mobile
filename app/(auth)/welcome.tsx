import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import * as Haptics from "expo-haptics";

const { height: SCREEN_H } = Dimensions.get("window");
const CARD_H = SCREEN_H * 0.38;

const FEATURES: Array<{ icon: "flash" | "people" | "shield-checkmark"; symbolName: SFSymbol; label: string }> = [
  { icon: "flash",             symbolName: "bolt.fill",        label: "Réservations" },
  { icon: "people",            symbolName: "person.2.fill",    label: "Clients fidèles" },
  { icon: "shield-checkmark",  symbolName: "lock.shield.fill", label: "Paiements sécurisés" },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // — Entrance —
  const heroOpacity    = useRef(new Animated.Value(0)).current;
  const heroY          = useRef(new Animated.Value(-20)).current;
  const logoBadgeScale = useRef(new Animated.Value(0.7)).current;
  const cardY          = useRef(new Animated.Value(CARD_H)).current;

  // — Pills stagger —
  const pill0O = useRef(new Animated.Value(0)).current;
  const pill0Y = useRef(new Animated.Value(20)).current;
  const pill1O = useRef(new Animated.Value(0)).current;
  const pill1Y = useRef(new Animated.Value(20)).current;
  const pill2O = useRef(new Animated.Value(0)).current;
  const pill2Y = useRef(new Animated.Value(20)).current;

  // — Press feedback —
  const ctaScale   = useRef(new Animated.Value(1)).current;
  const loginScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      // Hero fade + slide down
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.timing(heroY, { toValue: 0, duration: 600, delay: 100, useNativeDriver: true }),
      // Logo spring scale
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(logoBadgeScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]),
      // Card spring slide up
      Animated.sequence([
        Animated.delay(250),
        Animated.spring(cardY, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
      ]),
      // Pill 0
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(pill0O, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(pill0Y, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]),
      // Pill 1
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(pill1O, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(pill1Y, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]),
      // Pill 2
      Animated.sequence([
        Animated.delay(460),
        Animated.parallel([
          Animated.timing(pill2O, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(pill2Y, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  const pillAnims = [
    { opacity: pill0O, translateY: pill0Y },
    { opacity: pill1O, translateY: pill1Y },
    { opacity: pill2O, translateY: pill2Y },
  ];

  const springPress = (val: Animated.Value, to: number) =>
    Animated.spring(val, { toValue: to, damping: 15, stiffness: 300, useNativeDriver: true }).start();

  return (
    <View style={styles.root}>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#4A0030", "#9B0057", "#E8187A", "#FE5D9D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Orbs décoratifs */}
        <View style={styles.orb1} />
        <View style={styles.orb2} />
        <View style={styles.orb3} />

        {/* Contenu hero */}
        <Animated.View
          style={[
            styles.heroContent,
            { paddingTop: insets.top + 40 },
            { opacity: heroOpacity, transform: [{ translateY: heroY }] },
          ]}
        >
          {/* Logo badge */}
          <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoBadgeScale }] }]}>
            <Image source={require("@/assets/logo.png")} style={styles.logo} resizeMode="contain" />
          </Animated.View>

          {/* Brand */}
          <Text style={styles.brand}>Blyss</Text>
          <Text style={styles.tagline}>Beauté · Business · Sérénité</Text>

          {/* Feature pills — glassmorphism */}
          <View style={styles.pillRow}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.label}
                style={[
                  styles.pill,
                  { opacity: pillAnims[i].opacity, transform: [{ translateY: pillAnims[i].translateY }] },
                ]}
              >
                {Platform.OS === "ios"
                  ? <SymbolView name={f.symbolName} size={13} tintColor="#fff" />
                  : <Ionicons name={f.icon} size={13} color="#fff" />
                }
                <Text style={styles.pillLabel}>{f.label}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Fondu de transition vers la carte */}
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.0)", "#fff"]}
          style={styles.fadeTransition}
          pointerEvents="none"
        />
      </LinearGradient>

      {/* ── Carte ───────────────────────────────────────────────────────── */}
      <Animated.View style={[styles.card, { transform: [{ translateY: cardY }] }]}>
        {/* Drag indicator */}
        <View style={styles.dragHandle} />

        {/* CTA principal */}
        <Pressable
          onPressIn={() => {
            springPress(ctaScale, 0.96);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onPressOut={() => springPress(ctaScale, 1)}
          onPress={() => router.push("/(auth)/register")}
        >
          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
            <LinearGradient
              colors={["#E8187A", "#FE5D9D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Commencer gratuitement</Text>
              {Platform.OS === "ios"
                ? <SymbolView name="arrow.right" size={18} tintColor="#fff" />
                : <Ionicons name="arrow-forward" size={18} color="#fff" />
              }
            </LinearGradient>
          </Animated.View>
        </Pressable>

        {/* Connexion */}
        <Pressable
          onPressIn={() => springPress(loginScale, 0.97)}
          onPressOut={() => springPress(loginScale, 1)}
          onPress={() => router.push("/(auth)/login")}
        >
          <Animated.View style={[styles.loginBtn, { transform: [{ scale: loginScale }] }]}>
            <Text style={styles.loginText}>J'ai déjà un compte</Text>
          </Animated.View>
        </Pressable>

        {/* Légal */}
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
    backgroundColor: "#FE5D9D",
  },

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: {
    flex: 1,
    overflow: "hidden",
  },

  orb1: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  orb2: {
    position: "absolute",
    bottom: 120,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(254,93,157,0.25)",
  },
  orb3: {
    position: "absolute",
    top: 140,
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },

  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  logo: {
    width: 64,
    height: 64,
  },

  brand: {
    fontSize: 56,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -2,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 32,
  },

  // ── Pills ─────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
  },
  pillLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  // ── Fondu transition ───────────────────────────────────────────────────
  fadeTransition: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // ── Carte ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  dragHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
  },

  // ── CTA ───────────────────────────────────────────────────────────────
  ctaWrap: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#E8187A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaGradient: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },

  // ── Login ─────────────────────────────────────────────────────────────
  loginBtn: {
    height: 56,
    borderRadius: 20,
    backgroundColor: "rgba(232,24,122,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(232,24,122,0.20)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  loginText: {
    color: "#E8187A",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── Légal ─────────────────────────────────────────────────────────────
  legal: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    color: "#E8187A",
    fontWeight: "600",
  },
});
