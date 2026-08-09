import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Fonts } from "@/constants/fonts";
import * as Haptics from "expo-haptics";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

// ─── Pills data ───────────────────────────────────────────────────────────────

const ROW1_BASE = ["Pose gel", "French manucure", "Nail art", "Capsules", "Prolongation", "Baby boomer"];
const ROW2_BASE = ["Agenda pro", "Vernis semi-permanent", "Clientes fidèles", "Stamping", "Décoration", "Gel UV"];
const ROW3_BASE = ["Paiement en ligne", "Résine", "Avis clients", "Ombré nails", "Nail piercing", "Extensions"];

const ROW1 = [...ROW1_BASE, ...ROW1_BASE];
const ROW2 = [...ROW2_BASE, ...ROW2_BASE];
const ROW3 = [...ROW3_BASE, ...ROW3_BASE];

// Constant scroll speed shared by all three rows (px/ms) — each row's loop
// duration is derived from its own measured width so every row visibly
// moves at the same rate despite having different label lengths.
const PILLS_SPEED_PX_MS = 0.035;

function pillVariant(index: number): "accent" | "outline" | "default" {
  if (index % 4 === 1) return "accent";
  if (index % 5 === 3) return "outline";
  return "default";
}

// ─── PillRow ─────────────────────────────────────────────────────────────────

const PillRow = React.memo(function PillRow({
  items,
  translateX,
  styles,
  onMeasureWidth,
}: {
  items: string[];
  translateX: Animated.Value;
  styles: ReturnType<typeof createStyles>;
  onMeasureWidth: (width: number) => void;
}) {
  return (
    <View style={styles.pillRowClip}>
      <Animated.View
        style={[styles.pillRowInner, { transform: [{ translateX }] }]}
        // `items` holds two back-to-back copies of the base labels (the
        // seamless-marquee trick) — measuring the real laid-out width here
        // and halving it gives the exact distance of one copy, instead of
        // guessing from a fixed average pill width that never matches the
        // actual text length. A mismatch there is what caused the visible
        // snap/jump at the end of every loop.
        onLayout={(e) => onMeasureWidth(e.nativeEvent.layout.width)}
      >
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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();

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
  const rowWidths = useRef<[number, number, number]>([0, 0, 0]);
  const [widthsReady, setWidthsReady] = useState(false);
  const handleMeasureWidth = useCallback((idx: 0 | 1 | 2) => (width: number) => {
    if (rowWidths.current[idx] === width) return;
    rowWidths.current[idx] = width;
    if (rowWidths.current.every((w) => w > 0)) setWidthsReady(true);
  }, []);

  // — CTA press —
  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      titleOpacity.setValue(1);
      titleY.setValue(0);
      subtitleOpacity.setValue(1);
      pillsOpacity.setValue(1);
      buttonsOpacity.setValue(1);
      buttonsY.setValue(0);
      return;
    }

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
  }, [reduceMotion]);

  // Scroll animation starts only once every row has reported its real
  // rendered width (via onLayout) — using a fixed guessed width here is what
  // caused the loop to visibly jump/snap back instead of scrolling smoothly.
  // All three rows share the same px/ms speed so they never look out of sync.
  useEffect(() => {
    if (reduceMotion || !widthsReady) return;

    const [w1, w2, w3] = rowWidths.current;
    const half1 = w1 / 2;
    const half2 = w2 / 2;
    const half3 = w3 / 2;

    const anim1 = Animated.loop(
      Animated.timing(scroll1, {
        toValue: -half1,
        duration: half1 / PILLS_SPEED_PX_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    scroll2.setValue(-half2);
    const anim2 = Animated.loop(
      Animated.timing(scroll2, {
        toValue: 0,
        duration: half2 / PILLS_SPEED_PX_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const anim3 = Animated.loop(
      Animated.timing(scroll3, {
        toValue: -half3,
        duration: half3 / PILLS_SPEED_PX_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [reduceMotion, widthsReady]);

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
          { paddingTop: insets.top + 8 },
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
          <Text style={styles.heroLine1}>Fais briller</Text>
          <Text style={styles.heroLine2}>tes ongles</Text>
        </Animated.View>
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle}>
            La plateforme des pros et de leurs clientes
          </Text>
        </Animated.View>
      </View>

      {/* ── Pills scrollantes ────────────────────────────────────────────────── */}
      <Animated.View style={[styles.pillsZone, { opacity: pillsOpacity }]}>
        <PillRow items={ROW1} translateX={scroll1} styles={styles} onMeasureWidth={handleMeasureWidth(0)} />
        <PillRow items={ROW2} translateX={scroll2} styles={styles} onMeasureWidth={handleMeasureWidth(1)} />
        <PillRow items={ROW3} translateX={scroll3} styles={styles} onMeasureWidth={handleMeasureWidth(2)} />

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

        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push("/(auth)/login");
          }}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryBtnText}>J'ai déjà un compte</Text>
        </AnimatedPressable>

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

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Logo
    logoBlock: {
      alignItems: "center",
      paddingBottom: 0,
    },
    logoImg: {
      width: 88,
      height: 88,
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
      color: colors.foreground,
      letterSpacing: -1.4,
      lineHeight: 52,
    },
    heroLine2: {
      fontSize: 46,
      fontWeight: "700",
      color: colors.primary,
      letterSpacing: -1.4,
      lineHeight: 54,
      fontFamily: Fonts.serifItalic,
    },
    subtitle: {
      marginTop: 14,
      fontSize: 15,
      fontWeight: "500",
      color: colors.mutedForeground,
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
      // Without this, the default cross-axis "stretch" from pillRowClip
      // forces this row to the screen's width instead of letting it hug its
      // (much wider, intentionally overflowing) content — which made the
      // onLayout-measured width wrong and broke the loop.
      alignSelf: "flex-start",
    },
    pill: {
      backgroundColor: colors.white,
      borderRadius: 99,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.primary, 0.18),
    },
    pillAccent: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillOutline: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: withAlpha(colors.primary, 0.35),
    },
    pillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
      letterSpacing: -0.1,
    },
    pillTextAccent: {
      color: colors.onColor,
    },
    pillTextOutline: {
      color: colors.primary,
    },
    // Boutons
    bottomZone: {
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    ctaWrap: {
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.40,
      shadowRadius: 18,
      elevation: 10,
    },
    ctaText: {
      color: colors.onColor,
      fontWeight: "800",
      fontSize: 16,
      letterSpacing: -0.2,
    },
    secondaryBtn: {
      marginTop: 12,
      height: 56,
      borderRadius: 20,
      backgroundColor: withAlpha(colors.white, 0.6),
      borderWidth: 1,
      borderColor: withAlpha(colors.primary, 0.20),
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 15,
    },
    legal: {
      fontSize: 11,
      color: withAlpha(colors.foreground, 0.28),
      textAlign: "center",
      marginTop: 12,
      lineHeight: 18,
    },
    legalLink: {
      color: colors.primary,
      fontWeight: "600",
    },
  });
}
