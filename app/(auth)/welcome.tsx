import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import * as Haptics from "expo-haptics";

const FEATURES: Array<{ icon: "flash" | "people" | "shield-checkmark"; symbolName: SFSymbol; label: string }> = [
  { icon: "flash",            symbolName: "bolt.fill",        label: "Réservations" },
  { icon: "people",           symbolName: "person.2.fill",    label: "Clients fidèles" },
  { icon: "shield-checkmark", symbolName: "lock.shield.fill", label: "Paiements sécurisés" },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // — Entrée hero —
  const heroOpacity    = useRef(new Animated.Value(0)).current;
  const heroY          = useRef(new Animated.Value(-20)).current;
  const logoBadgeScale = useRef(new Animated.Value(0.7)).current;

  // — Entrée boutons —
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const bottomY       = useRef(new Animated.Value(24)).current;

  // — Pills stagger —
  const pill0O = useRef(new Animated.Value(0)).current;
  const pill0Y = useRef(new Animated.Value(20)).current;
  const pill1O = useRef(new Animated.Value(0)).current;
  const pill1Y = useRef(new Animated.Value(20)).current;
  const pill2O = useRef(new Animated.Value(0)).current;
  const pill2Y = useRef(new Animated.Value(20)).current;

  // — Press —
  const ctaScale   = useRef(new Animated.Value(1)).current;
  const loginScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.timing(heroY,       { toValue: 0, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(logoBadgeScale, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
      ]),
      Animated.timing(bottomOpacity, { toValue: 1, duration: 500, delay: 350, useNativeDriver: true }),
      Animated.timing(bottomY,       { toValue: 0, duration: 500, delay: 350, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(pill0O, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(pill0Y, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(380),
        Animated.parallel([
          Animated.timing(pill1O, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(pill1Y, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]),
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
    <LinearGradient
      colors={["#4A0030", "#9B0057", "#E8187A", "#FE5D9D"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      {/* Orbs décoratifs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      {/* ── Contenu central ─────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.hero,
          { paddingTop: insets.top + 40 },
          { opacity: heroOpacity, transform: [{ translateY: heroY }] },
        ]}
      >
        <Animated.View style={[styles.logoBadge, { transform: [{ scale: logoBadgeScale }] }]}>
          <Image source={require("@/assets/logo.png")} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.brand}>Blyss</Text>
        <Text style={styles.tagline}>Beauté · Business · Sérénité</Text>

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

      {/* ── Boutons bas ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom + 8, 28) },
          { opacity: bottomOpacity, transform: [{ translateY: bottomY }] },
        ]}
      >
        {/* Séparateur subtil */}
        <View style={styles.divider} />

        {/* CTA — blanc solide, texte rose */}
        <Pressable
          onPressIn={() => {
            springPress(ctaScale, 0.96);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onPressOut={() => springPress(ctaScale, 1)}
          onPress={() => router.push("/(auth)/register")}
        >
          <Animated.View style={[styles.ctaBtn, { transform: [{ scale: ctaScale }] }]}>
            <Text style={styles.ctaText}>Créer mon compte</Text>
            {Platform.OS === "ios"
              ? <SymbolView name="arrow.right" size={17} tintColor="#C0185C" />
              : <Ionicons name="arrow-forward" size={17} color="#C0185C" />
            }
          </Animated.View>
        </Pressable>

        {/* Login — transparent, texte blanc */}
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
        <Text style={styles.legal}>
          {"En continuant, tu acceptes nos "}
          <Text style={styles.legalLink}>Conditions générales</Text>
          {" et la "}
          <Text style={styles.legalLink}>Politique de confidentialité</Text>
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // ── Orbs ──────────────────────────────────────────────────────────────
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
    top: "35%",
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(254,93,157,0.20)",
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

  // ── Hero ──────────────────────────────────────────────────────────────
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 32,
  },

  // ── Pills ─────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-start",
    alignSelf: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
  },
  pillLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  // ── Bottom ────────────────────────────────────────────────────────────
  bottom: {
    paddingHorizontal: 24,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 24,
  },

  // ── CTA ───────────────────────────────────────────────────────────────
  ctaBtn: {
    height: 60,
    borderRadius: 20,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    color: "#C0185C",
    fontWeight: "800",
    fontSize: 16,
  },

  // ── Login ─────────────────────────────────────────────────────────────
  loginBtn: {
    height: 50,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.40)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  loginText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // ── Légal ─────────────────────────────────────────────────────────────
  legal: {
    fontSize: 11,
    color: "rgba(255,255,255,0.40)",
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    color: "rgba(255,255,255,0.60)",
  },
});
