import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Reanimated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { PLAN_RANK } from "@/constants/plans";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";
import { CREAM, PRUNE, PillButton, Ribbon } from "@/components/onboarding/kit";
import { hasNewFeatures } from "@/lib/proOnboardingContent";

function isRCPlan(value: string | undefined): value is RCPlan {
  return value === "start" || value === "serenite" || value === "signature";
}

const PLAN_LABELS: Record<RCPlan, string> = {
  start: "Start",
  serenite: "Sérénité",
  signature: "Signature",
};

// Ce que l'abonnement rapporte, formulé en gains pour l'activité d'une
// prothésiste — pas en noms de fonctionnalités (cf. voix « zéro lapin »).
const TIER_GAINS: Record<RCPlan, string[]> = {
  start: [
    "Un agenda qui se remplit en ligne",
    "Zéro lapin, zéro relance",
    "Payée d'avance, à chaque résa",
  ],
  serenite: [
    "De nouvelles clientes via ton portfolio",
    "Tes chiffres d'activité chaque semaine",
  ],
  signature: [
    "Ton chiffre d'affaires prévu à l'avance",
    "Un rapport clair chaque semaine",
  ],
};
const TIER_ORDER: RCPlan[] = ["start", "serenite", "signature"];

/** 1re souscription → le socle (ce que ça change concrètement).
 *  Upgrade → seulement les gains que le passage vient d'ouvrir. */
function gains(plan: RCPlan, previousPlan: RCPlan | null): string[] {
  if (!previousPlan) return TIER_GAINS.start;
  const to = PLAN_RANK[plan];
  const from = PLAN_RANK[previousPlan];
  const out: string[] = [];
  for (const tier of TIER_ORDER) {
    if (PLAN_RANK[tier] > from && PLAN_RANK[tier] <= to) out.push(...TIER_GAINS[tier]);
  }
  return out.slice(0, 4);
}

export default function ProSubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ plan?: string; previousPlan?: string; preview?: string }>();
  const plan = isRCPlan(params.plan) ? params.plan : "start";
  const previousPlan = isRCPlan(params.previousPlan) ? params.previousPlan : null;
  const isPreview = params.preview === "1";
  const isUpgrade = previousPlan !== null;
  const { refreshActivePlan } = useRevenueCat();
  const reduceMotion = useReducedMotion();

  const planLabel = PLAN_LABELS[plan];
  const items = useMemo(() => gains(plan, previousPlan), [plan, previousPlan]);

  // Deux temps forts : la rubalise découvre l'écran, puis « CONFIRMÉ »
  // s'écrase comme un tampon (léger dépassement + tic haptique lourd).
  const ribbonX = useSharedValue(reduceMotion ? -2.2 : -0.16);
  const stamp = useSharedValue(reduceMotion ? 1 : 0);
  const bar = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    ribbonX.value = withDelay(110, withTiming(-2.2, { duration: 480, easing: Easing.in(Easing.cubic) }));
    stamp.value = withDelay(
      430,
      withTiming(1, { duration: 300, easing: Easing.bezier(0.2, 1.6, 0.3, 1) }, (finished) => {
        if (finished) runOnJS(thunk)();
      })
    );
    bar.value = withDelay(660, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPreview) return;
    refreshActivePlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview]);

  const thunk = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isPreview) {
      router.replace({ pathname: "/pro-onboarding", params: { plan, preview: "1" } });
    } else if (hasNewFeatures(plan, previousPlan)) {
      router.replace({ pathname: "/pro-onboarding", params: { plan, previousPlan: previousPlan ?? "" } });
    } else {
      router.replace("/(pro)/dashboard");
    }
  };

  const stampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, 0.12, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [1.55, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-5, 0])}deg` },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: bar.value }] }));

  const listBase = 720;
  const listStep = 85;

  return (
    <View style={{ flex: 1, backgroundColor: PRUNE }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 24,
        }}
      >
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ flexDirection: "row" }}>
            <View style={s.tag}>
              <Text style={s.tagText}>{planLabel} · Actif</Text>
            </View>
          </View>

          <Text style={s.kicker}>C'est</Text>
          <Reanimated.Text style={[s.stampWord, stampStyle]}>Confirmé</Reanimated.Text>

          <Reanimated.View
            style={[s.bar, { backgroundColor: colors.primary }, barStyle]}
          />

          <Reanimated.Text
            entering={reduceMotion ? undefined : FadeIn.delay(560).duration(320)}
            style={s.lede}
          >
            {isUpgrade
              ? `Formule ${planLabel}, dès maintenant.`
              : "Dès ton 1er rendez-vous, ton abonnement est remboursé."}
          </Reanimated.Text>

          <Reanimated.Text
            entering={reduceMotion ? undefined : FadeIn.delay(listBase - 60).duration(280)}
            style={s.recapLabel}
          >
            {isUpgrade ? "Ce que tu débloques" : "Ce que ça change pour toi"}
          </Reanimated.Text>

          {items.map((it, i) => (
            <Reanimated.View
              key={it}
              entering={
                reduceMotion
                  ? undefined
                  : FadeInDown.delay(listBase + i * listStep).duration(320).springify().damping(16)
              }
              style={[s.row, i > 0 && s.rowLine]}
            >
              <View style={[s.dot, { backgroundColor: colors.primary }]} />
              <Text style={s.rowText}>{it}</Text>
            </Reanimated.View>
          ))}
        </View>

        <Reanimated.View
          entering={
            reduceMotion ? undefined : FadeInDown.delay(listBase + items.length * listStep + 120).duration(320)
          }
        >
          <PillButton
            label={isUpgrade ? "Voir ce qui change →" : "Configurer mon agenda →"}
            onPress={goNext}
            bg={CREAM}
            fg={PRUNE}
          />
        </Reanimated.View>
      </View>

      <Ribbon x={ribbonX} width={width} rose={colors.primary} />
    </View>
  );
}

const s = StyleSheet.create({
  tag: {
    backgroundColor: CREAM,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  tagText: {
    color: PRUNE,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  kicker: {
    color: withAlpha(CREAM, 0.85),
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    textTransform: "uppercase",
    lineHeight: 30,
  },
  stampWord: {
    color: CREAM,
    fontSize: 58,
    fontWeight: "900",
    letterSpacing: -2.6,
    lineHeight: 56,
    textTransform: "uppercase",
    alignSelf: "flex-start",
  },
  bar: {
    height: 6,
    width: 72,
    borderRadius: 3,
    marginTop: 16,
    alignSelf: "flex-start",
  },
  lede: {
    color: CREAM,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 18,
    maxWidth: 320,
  },
  recapLabel: {
    color: withAlpha(CREAM, 0.5),
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 26,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  rowLine: {
    borderTopWidth: 1,
    borderTopColor: withAlpha(CREAM, 0.12),
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  rowText: {
    color: CREAM,
    fontSize: 14.5,
    fontWeight: "600",
    flex: 1,
  },
});
