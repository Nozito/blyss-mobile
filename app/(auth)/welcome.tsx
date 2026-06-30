import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Fonts } from "@/constants/fonts";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

// ─── Pills data ───────────────────────────────────────────────────────────────

const ROW1_BASE = ["Pose gel", "French manucure", "Nail art", "Capsules", "Prolongation", "Baby boomer"];
const ROW2_BASE = ["Agenda pro", "Vernis semi-permanent", "Clientes fidèles", "Stamping", "Décoration", "Gel UV"];
const ROW3_BASE = ["Paiement en ligne", "Résine", "Avis clients", "Ombré nails", "Nail piercing", "Extensions"];

const ROW1 = [...ROW1_BASE, ...ROW1_BASE];
const ROW2 = [...ROW2_BASE, ...ROW2_BASE];
const ROW3 = [...ROW3_BASE, ...ROW3_BASE];

const AVG_PILL_W = 160;

function pillVariant(index: number): "accent" | "outline" | "default" {
  if (index % 4 === 1) return "accent";
  if (index % 5 === 3) return "outline";
  return "default";
}

// ─── PillRow ─────────────────────────────────────────────────────────────────

const PillRow = React.memo(function PillRow({
  items,
  translateX,
}: {
  items: string[];
  translateX: Animated.Value;
}) {
  return (
    <View style={styles.pillRowClip}>
      <Animated.View style={[styles.pillRowInner, { transform: [{ translateX }] }]}>
        {items.map((label, i) => {
          const variant = pillVariant(i);
          return (
            <View
              key={i}
              style={[
                styles.pill,
                variant === "accent"  && styles.pillAccent,
                variant === "outline" && styles.pillOutline,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  variant === "accent"  && styles.pillTextAccent,
                  variant === "outline" && styles.pillTextOutline,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // — Entrée —
  const logoOpacity     = useRef(new Animated.Value(0)).current;
  const logoScale       = useRef(new Animated.Value(0.88)).current;
  const titleOpacity    = useRef(new Animated.Value(0)).current;
  const titleY          = useRef(new Animated.Value(18)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pillsOpacity    = useRef(new Animated.Value(0)).current;
  const buttonsOpacity  = useRef(new Animated.Value(0)).current;
  const buttonsY        = useRef(new Animated.Value(20)).current;

  // — Scroll pills —
  const scroll1 = useRef(new Animated.Value(0)).current;
  const scroll2 = useRef(new Animated.Value(0)).current;
  const scroll3 = useRef(new Animated.Value(0)).current;

  // — CTA press —
  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.spring(logoScale,   { toValue: 1, damping: 14, stiffness: 100, useNativeDriver: true }),
      ]),
      Animated.delay(50),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(titleY,       { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(30),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.delay(30),
      Animated.timing(pillsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.delay(30),
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(buttonsY, { toValue: 0, damping: 16, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();

    const t = setTimeout(() => {
      const half1 = ROW1_BASE.length * AVG_PILL_W;
      const half2 = ROW2_BASE.length * AVG_PILL_W;
      const half3 = ROW3_BASE.length * AVG_PILL_W;

      Animated.loop(
        Animated.timing(scroll1, { toValue: -half1, duration: 28000, useNativeDriver: true })
      ).start();

      scroll2.setValue(-half2);
      Animated.loop(
        Animated.timing(scroll2, { toValue: 0, duration: 34000, useNativeDriver: true })
      ).start();

      Animated.loop(
        Animated.timing(scroll3, { toValue: -half3, duration: 31000, useNativeDriver: true })
      ).start();
    }, 1200);

    return () => clearTimeout(t);
  }, []);

  const pressIn = () => {
    Animated.spring(ctaScale, { toValue: 0.96, damping: 15, stiffness: 300, useNativeDriver: true }).start();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  const pressOut = () =>
    Animated.spring(ctaScale, { toValue: 1, damping: 15, stiffness: 300, useNativeDriver: true }).start();

  return (
    <View style={styles.root}>

      {/* ── Logo ─────────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.logoBlock,
          { paddingTop: insets.top + 24 },
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image
          source={require("@/assets/logo.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <View style={styles.heroWrapper}>
        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }] }}>
          <Text style={styles.heroLine1}>Faites briller</Text>
          <Text style={styles.heroLine2}>vos ongles</Text>
        </Animated.View>
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle}>
            La plateforme des pros et de leurs clientes
          </Text>
        </Animated.View>
      </View>

      {/* ── Pills scrollantes ────────────────────────────────────────────────── */}
      <Animated.View style={[styles.pillsZone, { opacity: pillsOpacity }]}>
        <PillRow items={ROW1} translateX={scroll1} />
        <PillRow items={ROW2} translateX={scroll2} />
        <PillRow items={ROW3} translateX={scroll3} />

      </Animated.View>

      {/* ── Boutons ──────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.bottomZone,
          { paddingBottom: insets.bottom + 24 },
          { opacity: buttonsOpacity, transform: [{ translateY: buttonsY }] },
        ]}
      >
        <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={() => router.push("/(auth)/register")}>
          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
            <Text style={styles.ctaText}>Rejoindre Blyss</Text>
          </Animated.View>
        </Pressable>

        <Pressable onPress={() => router.push("/(auth)/login")} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>J'ai déjà un compte</Text>
        </Pressable>

        <Text style={styles.legal}>
          {"En continuant tu acceptes nos "}
          <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}>CGU</Text>
          {" et la "}
          <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}>Politique de confidentialité</Text>
        </Text>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Logo
  logoBlock: {
    alignItems: "center",
    paddingBottom: 0,
  },
  logoImg: {
    width: 130,
    height: 130,
  },

  // Hero
  heroWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  heroLine1: {
    fontSize: 46,
    fontWeight: "800",
    color: "#1A0010",
    letterSpacing: -1.4,
    lineHeight: 52,
  },
  heroLine2: {
    fontSize: 46,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: -1.4,
    lineHeight: 54,
    fontFamily: Fonts.serifItalic,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "500",
    color: "#A06070",
    lineHeight: 22,
  },

  // Pills
  pillsZone: {
    gap: 10,
    paddingBottom: 8,
  },
  pillRowClip: {
    overflow: "hidden",
  },
  pillRowInner: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingLeft: 16,
  },
  pill: {
    backgroundColor: Colors.white,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,94,160,0.18)",
  },
  pillAccent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,94,160,0.35)",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A0010",
    letterSpacing: -0.1,
  },
  pillTextAccent: {
    color: Colors.white,
  },
  pillTextOutline: {
    color: Colors.primary,
  },
  // Boutons
  bottomZone: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  ctaWrap: {
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 10,
  },
  ctaText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.60)",
    borderWidth: 1,
    borderColor: "rgba(255,94,160,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  legal: {
    fontSize: 11,
    color: "rgba(0,0,0,0.28)",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.primary,
    fontWeight: "600",
  },
});
