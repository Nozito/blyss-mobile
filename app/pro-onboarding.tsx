import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useAppTransition } from "@/contexts/TransitionContext";
import { buildOnboardingSlides } from "@/lib/proOnboardingContent";

const STORAGE_KEY = "pro_onboarding_done";

function isRCPlan(value: string | undefined): value is RCPlan {
  return value === "start" || value === "serenite" || value === "signature";
}

export default function ProOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ plan?: string; previousPlan?: string; preview?: string }>();
  const { activePlan, refreshActivePlan } = useRevenueCat();
  const { showTransition, hideTransition } = useAppTransition();

  const isPreview = params.preview === "1";
  // Arrivée directe depuis l'écran de succès d'un achat (pas un rebond
  // automatique "onboarding jamais vu") : on connaît le plan acheté et,
  // le cas échéant, le plan précédent — donc pas de vérification du flag.
  const isPurchaseFlow = !isPreview && isRCPlan(params.plan);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [ready, setReady] = useState(isPreview || isPurchaseFlow);

  // Entrée "à froid" (ouverture de l'app / dashboard sans onboarding vu) —
  // seul cas où on consulte encore le flag pour décider d'afficher ou non.
  useEffect(() => {
    if (isPreview || isPurchaseFlow) return;
    AsyncStorage.getItem(STORAGE_KEY).then((done) => {
      if (done === "true") {
        router.replace("/(pro)/dashboard");
      } else {
        setReady(true);
      }
    });
  }, [isPreview, isPurchaseFlow]);

  const slides = useMemo(() => {
    if (isPurchaseFlow) {
      const plan = params.plan as RCPlan;
      const previousPlan = isRCPlan(params.previousPlan) ? params.previousPlan : null;
      return buildOnboardingSlides(plan, previousPlan, colors);
    }
    if (isPreview) {
      const plan = isRCPlan(params.plan) ? params.plan : "signature";
      return buildOnboardingSlides(plan, null, colors);
    }
    // Entrée à froid : on ne connaît pas le contexte d'achat, on part du
    // plan actif (ou "start" par défaut) comme si c'était la 1re fois.
    return buildOnboardingSlides(activePlan ?? "start", null, colors);
  }, [isPurchaseFlow, isPreview, params.plan, params.previousPlan, activePlan, colors]);

  const isLast = currentSlide === slides.length - 1;
  const slide = slides[currentSlide] ?? slides[0];

  const finish = async () => {
    if (isPreview) {
      showTransition();
      router.replace("/(pro)/(profile)");
      hideTransition();
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, "true");
    // Ensure activePlan is up-to-date before entering the pro tabs
    await refreshActivePlan();
    showTransition();
    router.replace("/(pro)/dashboard");
    hideTransition();
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!isLast) {
      setCurrentSlide((p) => p + 1);
    } else {
      await finish();
    }
  };

  const handleSkip = async () => {
    await finish();
  };

  if (!ready || !slide) return null;

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      {isPreview && (
        <View style={[styles.previewBadge, { top: insets.top + 12 }]}>
          <Text style={styles.previewBadgeText}>Aperçu admin</Text>
        </View>
      )}

      {/* Skip */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AnimatedPressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: `${slide.color}80` }]}>Passer</Text>
        </AnimatedPressable>
      </View>

      {/* Slide content */}
      <View style={styles.slideContent}>
        <View style={styles.mockupFrame}>
          {slide.image ? (
            <Image source={slide.image} style={styles.mockupImage} resizeMode="cover" />
          ) : (
            <View style={[styles.mockupPlaceholder, { backgroundColor: `${slide.color}0C` }]}>
              <View style={[styles.mockupIconWrap, { backgroundColor: `${slide.color}18` }]}>
                <Ionicons name={slide.icon} size={44} color={slide.color} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.caption}>
          <Text style={[styles.title, { color: colors.foreground }]}>{slide.title}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {slide.description}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <AnimatedPressable
              key={i}
              onPress={() => setCurrentSlide(i)}
              hitSlop={8}
              accessibilityLabel={`Aller à l'étape ${i + 1}`}
            >
              <View
                style={[
                  styles.dot,
                  {
                    width: i === currentSlide ? 22 : 7,
                    backgroundColor:
                      i === currentSlide ? slide.color : `${slide.color}35`,
                  },
                ]}
              />
            </AnimatedPressable>
          ))}
        </View>

        {/* CTA */}
        <AnimatedPressable
          onPress={handleNext}
          style={[
            styles.cta,
            {
              backgroundColor: slide.color,
              shadowColor: slide.color,
            },
          ]}
        >
          <Text style={styles.ctaText}>
            {isLast ? "C'est parti !" : "Suivant"}
          </Text>
          <Ionicons
            name={isLast ? "rocket-outline" : "arrow-forward"}
            size={20}
            color="#FFFFFF"
          />
        </AnimatedPressable>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    previewBadge: {
      position: "absolute",
      left: 24,
      zIndex: 1,
      backgroundColor: "#0A0A0F",
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    previewBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFFFFF",
      letterSpacing: 0.3,
    },
    header: {
      alignItems: "flex-end",
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    skipBtn: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    skipText: {
      fontSize: 14,
      fontWeight: "600",
    },
    slideContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      gap: 28,
    },
    mockupFrame: {
      width: "82%",
      aspectRatio: 0.82,
      borderRadius: 32,
      overflow: "hidden",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    },
    mockupImage: {
      width: "100%",
      height: "100%",
    },
    mockupPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    mockupIconWrap: {
      width: 84,
      height: 84,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    caption: {
      alignItems: "center",
      paddingHorizontal: 8,
      gap: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: -0.4,
    },
    description: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 16,
      gap: 20,
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    dot: {
      height: 7,
      borderRadius: 4,
    },
    cta: {
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 5,
    },
    ctaText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 17,
    },
  });
}
