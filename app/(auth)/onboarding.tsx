/**
 * Intro — 3 slides au style « poster » (kit onboarding). Affichée par
 * app/index.tsx à chaque lancement non connecté, juste avant l'accueil.
 * Toujours skippable ; se termine sur /(auth)/welcome.
 */
import React, { useCallback, useState } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { PillButton, Ribbon, StepHeader, fieldColors, useRibbon, type FieldTone } from "@/components/onboarding/kit";

const SLIDES: { tone: FieldTone; title: string; body: string }[] = [
  { tone: "rose", title: "Trouve la main qui fera tes ongles", body: "Les prothésistes ongulaires près de chez toi — leur vrai travail, leurs vraies dispos." },
  { tone: "prune", title: "Réserve en 3 taps", body: "Les créneaux réels de chaque pro, 24/7. Pas d'appel, pas de DM." },
  { tone: "cream", title: "Des pros vérifiées", body: "Chaque prothésiste est validée par notre équipe. Avis authentiques, rien d'inventé." },
];

export default function IntroScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const ribbon = useRibbon();
  const [index, setIndex] = useState(0);

  const slide = SLIDES[index];
  const field = fieldColors(slide.tone, colors);
  const ink = field.ink;
  const isLast = index === SLIDES.length - 1;

  const leave = useCallback(() => router.replace("/(auth)/welcome"), [router]);

  const skip = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    leave();
  }, [leave]);

  const enter = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    leave();
  }, [leave]);

  return (
    <View style={{ flex: 1, backgroundColor: field.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <StepHeader
          step={index + 1}
          total={SLIDES.length}
          ink={ink}
          right={
            <Text
              onPress={skip}
              style={{ color: ink, opacity: 0.62, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 8 }}
            >
              Passer
            </Text>
          }
        />

        <Reanimated.View key={index} entering={ribbon.reduceMotion ? undefined : FadeIn.duration(180)} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
            <Text style={{ color: ink, fontWeight: "900", fontSize: 38, lineHeight: 38, letterSpacing: -1, textTransform: "uppercase" }}>
              {slide.title}
            </Text>
            <Text style={{ color: ink, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 16, maxWidth: 320 }}>{slide.body}</Text>
          </View>
        </Reanimated.View>

        <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8 }}>
          <PillButton
            label={isLast ? "Découvrir Blyss →" : "Suivant →"}
            onPress={isLast ? enter : () => ribbon.go(() => setIndex((i) => i + 1))}
            bg={field.pill.bg}
            fg={field.pill.fg}
          />
        </View>
      </SafeAreaView>

      <Ribbon x={ribbon.x} width={width} rose={colors.primary} />
    </View>
  );
}
