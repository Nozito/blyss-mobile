import React, { useRef, useEffect, useState } from "react";
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

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const SLIDES: Array<{
  title: string;
  subtitle: string;
  cta: string;
  illustrationColor: string;
  decorIcons: [IoniconName, IoniconName, IoniconName];
}> = [
  {
    title: "Réservez en quelques secondes",
    subtitle: "Trouvez les meilleurs pros du nail art près de chez vous.",
    cta: "Continuer",
    illustrationColor: "#FE5D9D",
    decorIcons: ["sparkles", "heart", "star"],
  },
  {
    title: "Gérez votre activité pro",
    subtitle: "Agenda, clients, paiements — tout au même endroit.",
    cta: "Continuer",
    illustrationColor: "#A855F7",
    decorIcons: ["briefcase", "calendar", "bar-chart"],
  },
  {
    title: "Beauté · Business · Sérénité",
    subtitle: "Rejoins des milliers de pros et clients qui font confiance à Blyss.",
    cta: "Commencer",
    illustrationColor: "#E8187A",
    decorIcons: ["ribbon", "diamond", "sparkles"],
  },
];

const CONTAINER_SIZE = 240;
const LOGO_SIZE      = 110;
const ORBIT_SIZE     = 44;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  // — Animations d'entrée —
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY       = useRef(new Animated.Value(-16)).current;
  const illustScale   = useRef(new Animated.Value(0.9)).current;
  const illustOpacity = useRef(new Animated.Value(0)).current;
  const cardY         = useRef(new Animated.Value(60)).current;

  // — Logo float —
  const logoFloatY = useRef(new Animated.Value(0)).current;

  // — Orbital pulses —
  const orbScale0 = useRef(new Animated.Value(1)).current;
  const orbScale1 = useRef(new Animated.Value(1)).current;
  const orbScale2 = useRef(new Animated.Value(1)).current;

  // — Pagination dots — useNativeDriver: false (propriété layout)
  const dotWidth0 = useRef(new Animated.Value(24)).current;
  const dotWidth1 = useRef(new Animated.Value(8)).current;
  const dotWidth2 = useRef(new Animated.Value(8)).current;
  const dotWidths = [dotWidth0, dotWidth1, dotWidth2];

  // — Transition entre slides —
  const textOpacity       = useRef(new Animated.Value(1)).current;
  const textY             = useRef(new Animated.Value(0)).current;
  const illustTransOpacity = useRef(new Animated.Value(1)).current;
  const illustTransX      = useRef(new Animated.Value(0)).current;

  // — CTA press —
  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrée globale
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerY,       { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(illustScale,   { toValue: 1, damping: 16, stiffness: 120, useNativeDriver: true }),
          Animated.timing(illustOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(cardY, { toValue: 0, damping: 18, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();

    // Float logo — démarre après l'entrée
    const floatTimer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloatY, { toValue: -8, duration: 1000, useNativeDriver: true }),
          Animated.timing(logoFloatY, { toValue:  0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }, 600);

    // Pulsations orbitales — stagger 300ms
    const startOrb = (val: Animated.Value, delay: number) => {
      const t = setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(val, { toValue: 1.12, duration: 700, useNativeDriver: true }),
            Animated.timing(val, { toValue: 1.00, duration: 700, useNativeDriver: true }),
          ])
        ).start();
      }, delay);
      return t;
    };
    const t0 = startOrb(orbScale0, 700);
    const t1 = startOrb(orbScale1, 1000);
    const t2 = startOrb(orbScale2, 1300);

    return () => {
      clearTimeout(floatTimer);
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const goToSlide = (next: number) => {
    const prev = currentSlide;

    // Dot widths (layout — useNativeDriver: false)
    Animated.spring(dotWidths[prev], { toValue: 8,  useNativeDriver: false }).start();
    Animated.spring(dotWidths[next], { toValue: 24, useNativeDriver: false }).start();

    // Fade-out contenu
    Animated.parallel([
      Animated.timing(textOpacity,        { toValue: 0,   duration: 180, useNativeDriver: true }),
      Animated.timing(textY,              { toValue: -12, duration: 180, useNativeDriver: true }),
      Animated.timing(illustTransOpacity, { toValue: 0,   duration: 150, useNativeDriver: true }),
      Animated.timing(illustTransX,       { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      // Change le slide quand tout est invisible
      setCurrentSlide(next);
      textY.setValue(12);
      illustTransX.setValue(30);

      // Fade-in nouveau contenu
      Animated.parallel([
        Animated.timing(textOpacity,        { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(textY,              { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(illustTransOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(illustTransX,       { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const springPress = (val: Animated.Value, to: number) =>
    Animated.spring(val, { toValue: to, damping: 15, stiffness: 300, useNativeDriver: true }).start();

  const slide  = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
          { opacity: headerOpacity, transform: [{ translateY: headerY }] },
        ]}
      >
        <Text style={styles.headerBrand}>Blyss</Text>
        <Pressable onPress={() => router.push("/(auth)/login")} style={styles.loginPill}>
          <Text style={styles.loginPillText}>Connexion</Text>
        </Pressable>
      </Animated.View>

      {/* ── Zone illustration ────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.illustrationZone,
          { opacity: illustOpacity, transform: [{ scale: illustScale }] },
        ]}
      >
        <Animated.View
          style={[
            styles.illustrationContent,
            { opacity: illustTransOpacity, transform: [{ translateX: illustTransX }] },
          ]}
        >
          {/* Fond dégradé dynamique */}
          <LinearGradient
            colors={[slide.illustrationColor + "18", "#FFF0F5"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Logo + orbitaux */}
          <View style={styles.orbitContainer}>
            {/* Orbitaux */}
            <Animated.View style={[styles.orbital, styles.orbitalTL, { shadowColor: slide.illustrationColor, transform: [{ scale: orbScale0 }] }]}>
              <Ionicons name={slide.decorIcons[0]} size={20} color={slide.illustrationColor} />
            </Animated.View>
            <Animated.View style={[styles.orbital, styles.orbitalTR, { shadowColor: slide.illustrationColor, transform: [{ scale: orbScale1 }] }]}>
              <Ionicons name={slide.decorIcons[1]} size={20} color={slide.illustrationColor} />
            </Animated.View>
            <Animated.View style={[styles.orbital, styles.orbitalBot, { shadowColor: slide.illustrationColor, transform: [{ scale: orbScale2 }] }]}>
              <Ionicons name={slide.decorIcons[2]} size={20} color={slide.illustrationColor} />
            </Animated.View>

            {/* Logo badge flottant */}
            <Animated.View
              style={[
                styles.logoBadge,
                {
                  backgroundColor: slide.illustrationColor + "20",
                  borderColor:     slide.illustrationColor + "40",
                  shadowColor:     slide.illustrationColor,
                  transform: [{ translateY: logoFloatY }],
                },
              ]}
            >
              <Image source={require("@/assets/logo.png")} style={styles.logo} resizeMode="contain" />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* ── Carte bas ────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.bottomCard,
          { paddingBottom: Math.max(insets.bottom + 16, 28) },
          { transform: [{ translateY: cardY }] },
        ]}
      >
        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidths[i],
                  backgroundColor: i === currentSlide
                    ? "#E8187A"
                    : "rgba(232,24,122,0.20)",
                },
              ]}
            />
          ))}
        </View>

        {/* Texte slide */}
        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textY }] }}>
          <Text style={styles.slideTitle}>{slide.title}</Text>
          <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
        </Animated.View>

        {/* CTA */}
        <Pressable
          onPressIn={() => {
            springPress(ctaScale, 0.96);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          onPressOut={() => springPress(ctaScale, 1)}
          onPress={() => {
            if (isLast) router.push("/(auth)/register");
            else goToSlide(currentSlide + 1);
          }}
        >
          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
            <LinearGradient
              colors={["#E8187A", "#FE5D9D"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>{slide.cta}</Text>
              {isLast && (
                Platform.OS === "ios"
                  ? <SymbolView name={"checkmark" as SFSymbol} size={18} tintColor="#fff" />
                  : <Ionicons name="checkmark" size={18} color="#fff" />
              )}
            </LinearGradient>
          </Animated.View>
        </Pressable>

        {/* Légal — slide 3 uniquement */}
        {currentSlide === 2 && (
          <Text style={styles.legal}>
            {"En continuant, tu acceptes nos "}
            <Text style={styles.legalLink}>CGU</Text>
            {" et la "}
            <Text style={styles.legalLink}>Politique de confidentialité</Text>
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFBFC",
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1A0010",
    letterSpacing: -0.5,
  },
  loginPill: {
    backgroundColor: "rgba(232,24,122,0.10)",
    borderWidth: 1,
    borderColor: "rgba(232,24,122,0.20)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
  },
  loginPillText: {
    color: "#E8187A",
    fontWeight: "700",
    fontSize: 14,
  },

  // ── Illustration ──────────────────────────────────────────────────────
  illustrationZone: {
    flex: 1,
    overflow: "hidden",
  },
  illustrationContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  orbitContainer: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },

  logoBadge: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 30,
    elevation: 8,
  },
  logo: {
    width: 72,
    height: 72,
  },

  orbital: {
    position: "absolute",
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  orbitalTL: {
    top: 16,
    left: 14,
  },
  orbitalTR: {
    top: 16,
    right: 14,
  },
  orbitalBot: {
    bottom: 16,
    left: (CONTAINER_SIZE - ORBIT_SIZE) / 2,
  },

  // ── Carte bas ─────────────────────────────────────────────────────────
  bottomCard: {
    backgroundColor: "#FFFBFC",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 32,
    shadowColor: "#E8187A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },

  // ── Pagination dots ───────────────────────────────────────────────────
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 28,
    alignSelf: "flex-start",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // ── Texte slide ───────────────────────────────────────────────────────
  slideTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1A0010",
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  slideSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(0,0,0,0.45)",
    lineHeight: 22,
    marginBottom: 32,
  },

  // ── CTA ───────────────────────────────────────────────────────────────
  ctaWrap: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#E8187A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
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

  // ── Légal ─────────────────────────────────────────────────────────────
  legal: {
    fontSize: 11,
    color: "rgba(0,0,0,0.35)",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 14,
  },
  legalLink: {
    color: "#E8187A",
    fontWeight: "600",
  },
});
