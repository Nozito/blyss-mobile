import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, StyleSheet, Dimensions, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, { FadeIn } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";
import { useAppTransition } from "@/contexts/TransitionContext";
import { requestAndRegisterPush } from "@/contexts/NotificationContext";
import { buildOnboardingSlides } from "@/lib/proOnboardingContent";
import { PillButton, Ribbon, StepHeader, fieldColors, useRibbon } from "@/components/onboarding/kit";

const STORAGE_KEY = "pro_onboarding_done";

// Les PNG de mockup sont hauts (~0.49) : on les borne par une fraction de la
// hauteur d'écran pour garder un budget fixe à la légende quel que soit l'appareil.
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MOCKUP_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.4;

function isRCPlan(value: string | undefined): value is RCPlan {
  return value === "start" || value === "serenite" || value === "signature";
}

export default function ProOnboardingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(), []);
  const params = useLocalSearchParams<{ plan?: string; previousPlan?: string; preview?: string }>();
  const { activePlan, refreshActivePlan } = useRevenueCat();
  const { showTransition, hideTransition } = useAppTransition();
  const ribbon = useRibbon();

  const isPreview = params.preview === "1";
  const isPurchaseFlow = !isPreview && isRCPlan(params.plan);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [ready, setReady] = useState(isPreview || isPurchaseFlow);

  useEffect(() => {
    if (isPreview || isPurchaseFlow) return;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((done) => {
        if (done === "true") router.replace("/(pro)/dashboard");
        else setReady(true);
      })
      .catch(() => setReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return buildOnboardingSlides(activePlan ?? "start", null, colors);
  }, [isPurchaseFlow, isPreview, params.plan, params.previousPlan, activePlan, colors]);

  const isLast = currentSlide === slides.length - 1;
  const slide = slides[currentSlide] ?? slides[0];
  const field = slide ? fieldColors(slide.tone, colors) : null;

  const finish = async () => {
    if (isPreview) {
      showTransition();
      router.replace("/(pro)/(profile)");
      hideTransition();
      return;
    }
    // Un échec de persistance ou de refresh ne doit jamais bloquer l'entrée
    // dans l'espace pro — au pire l'onboarding se re-proposera.
    await AsyncStorage.setItem(STORAGE_KEY, "true").catch(() => {});
    // Dernière étape franchie : on demande les notifs pour ne pas rater de résa.
    await requestAndRegisterPush().catch(() => {});
    await refreshActivePlan().catch(() => {});
    showTransition();
    router.replace("/(pro)/dashboard");
    hideTransition();
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isLast) {
      void finish();
    } else {
      ribbon.go(() => setCurrentSlide((p) => p + 1));
    }
  };

  if (!ready || !slide || !field) return null;

  const ink = field.ink;

  return (
    <View style={{ flex: 1, backgroundColor: field.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <StepHeader
          step={currentSlide + 1}
          total={slides.length}
          ink={ink}
          onBack={currentSlide > 0 ? () => setCurrentSlide((p) => p - 1) : undefined}
          right={
            <Text
              onPress={() => void finish()}
              style={{ color: ink, opacity: 0.62, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 }}
            >
              Passer
            </Text>
          }
        />

        {isPreview && (
          <View style={[styles.previewBadge, { borderColor: withAlpha(ink, 0.4) }]}>
            <Text style={[styles.previewBadgeText, { color: ink }]}>Aperçu admin</Text>
          </View>
        )}

        <Reanimated.View
          key={currentSlide}
          entering={ribbon.reduceMotion ? undefined : FadeIn.duration(200)}
          style={styles.slideContent}
        >
          {slide.image ? (
            <View style={styles.mockupImageWrap}>
              <Image source={slide.image} style={styles.mockupImage} resizeMode="contain" />
            </View>
          ) : (
            <View style={[styles.iconFrame, { borderColor: withAlpha(ink, 0.25) }]}>
              <Ionicons name={slide.icon} size={52} color={slide.color} />
            </View>
          )}

          <View style={styles.caption}>
            {slide.tierLabel ? (
              <View style={[styles.tierPill, { backgroundColor: slide.color }]}>
                <Text style={styles.tierPillText}>{slide.tierLabel} débloqué</Text>
              </View>
            ) : null}
            <Text style={[styles.title, { color: ink }]}>{slide.title}</Text>
            <Text style={[styles.description, { color: ink }]}>{slide.description}</Text>
          </View>
        </Reanimated.View>

        <View style={styles.footer}>
          <PillButton
            label={isLast ? "C'est parti →" : "Suivant →"}
            onPress={handleNext}
            bg={field.pill.bg}
            fg={field.pill.fg}
          />
        </View>
      </SafeAreaView>

      <Ribbon x={ribbon.x} width={width} rose={colors.primary} />
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    previewBadge: {
      alignSelf: "center",
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginBottom: 4,
    },
    previewBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    slideContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 24,
    },
    mockupImageWrap: {
      height: MOCKUP_IMAGE_HEIGHT,
      aspectRatio: 0.494,
      alignSelf: "center",
    },
    mockupImage: {
      width: "100%",
      height: "100%",
    },
    iconFrame: {
      width: 120,
      height: 120,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    caption: {
      alignItems: "flex-start",
      alignSelf: "stretch",
      gap: 10,
    },
    tierPill: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tierPillText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    title: {
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -1,
      textTransform: "uppercase",
      lineHeight: 31,
    },
    description: {
      fontSize: 14,
      lineHeight: 21,
      opacity: 0.9,
      maxWidth: 340,
    },
    footer: {
      paddingHorizontal: 22,
      paddingBottom: 10,
      paddingTop: 8,
    },
  });
}
