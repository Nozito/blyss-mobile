import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const ONBOARDING_KEY = "onboarding_seen";

// ─── Slides data ──────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: "1",
    emoji: "🌸",
    title: "Ton bien-être,\nsimplifié",
    subtitle: "Réserve des soins près de chez toi en quelques secondes.",
  },
  {
    id: "2",
    emoji: "👩‍⚕️",
    title: "Des professionnels\nvérifiés",
    subtitle: "Esthéticiennes, coachs, thérapeutes — tous évalués par notre équipe.",
  },
  {
    id: "3",
    emoji: "📅",
    title: "Tu es\nprofessionnel ?",
    subtitle: "Gérez votre agenda, vos clients et vos paiements depuis l'app.",
  },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const markSeen = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  }, []);

  const handleSkip = useCallback(async () => {
    await markSeen();
    router.replace("/(auth)/welcome");
  }, [markSeen, router]);

  const handleNext = useCallback(async () => {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [activeIndex]);

  const handleRole = useCallback(
    async (role: "client" | "pro") => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await markSeen();
      router.push(`/(auth)/register?role=${role}`);
    },
    [markSeen, router]
  );

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Passer */}
      <View style={styles.header}>
        <AnimatedPressable onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>Passer</Text>
        </AnimatedPressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isLast}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Bottom zone */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {isLast ? (
          /* Last slide: 2 CTA buttons */
          <View style={styles.ctaGroup}>
            <AnimatedPressable
              onPress={() => handleRole("client")}
              style={styles.ctaPrimary}
            >
              <Text style={styles.ctaPrimaryText}>Je suis cliente</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => handleRole("pro")}
              style={styles.ctaOutline}
            >
              <Text style={styles.ctaOutlineText}>Je suis professionnelle</Text>
            </AnimatedPressable>
          </View>
        ) : (
          /* Next button */
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              handleNext();
            }}
            style={styles.ctaPrimary}
          >
            <Text style={styles.ctaPrimaryText}>Continuer</Text>
          </AnimatedPressable>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.mutedForeground,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 32,
  },
  emoji: {
    fontSize: Platform.OS === "ios" ? 96 : 80,
    marginBottom: 32,
    textAlign: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.foreground,
    textAlign: "center",
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: Colors.border,
  },
  ctaGroup: {
    gap: 12,
  },
  ctaPrimary: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  ctaOutline: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  ctaOutlineText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.primary,
  },
});
