import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, withAlpha } from "@/constants/colors";
import { useRevenueCat, type RCPlan } from "@/contexts/RevenueCatContext";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hasNewFeatures, buildOnboardingSlides } from "@/lib/proOnboardingContent";

function isRCPlan(value: string | undefined): value is RCPlan {
  return value === "start" || value === "serenite" || value === "signature";
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const PLAN_LABELS: Record<RCPlan, string> = {
  start: "Start",
  serenite: "Sérénité",
  signature: "Signature",
};

// Alignées sur les icônes/couleurs déjà utilisées pour ces formules dans
// subscription-settings.tsx — même identité visuelle partout dans l'app.
const PLAN_ICON: Record<RCPlan, keyof typeof Ionicons.glyphMap> = {
  start: "flash-outline",
  serenite: "heart-outline",
  signature: "sparkles-outline",
};

const PLAN_COLOR: Record<RCPlan, string> = {
  start: Colors.primary,
  serenite: Colors.pro,
  signature: Colors.secondary,
};

const PLAN_NEXT_STEP: Record<RCPlan, string> = {
  start: "Ajoute tes premiers créneaux pour commencer à recevoir des réservations.",
  serenite: "Configure ton agenda et importe tes clientes régulières.",
  signature: "Configure ton agenda, tes services et mets ta page en avant.",
};

export default function ProSubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ plan?: string; previousPlan?: string; preview?: string }>();
  const plan = isRCPlan(params.plan) ? params.plan : "start";
  const previousPlan = isRCPlan(params.previousPlan) ? params.previousPlan : null;
  const isPreview = params.preview === "1";
  const { refreshActivePlan } = useRevenueCat();
  const reduceMotion = useReducedMotion();
  const badgeScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.6)).current;
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const planColor = PLAN_COLOR[plan];

  // Aperçu concret de ce qui arrive juste après, plutôt qu'un badge décoratif —
  // ça prépare la pro à l'onboarding qui suit au lieu de la surprendre.
  const upcomingSlides = useMemo(() => {
    if (isPreview) return buildOnboardingSlides(plan, null).slice(0, -1);
    if (!hasNewFeatures(plan, previousPlan)) return [];
    return buildOnboardingSlides(plan, previousPlan).slice(0, -1);
  }, [isPreview, plan, previousPlan]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(badgeScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [badgeScale, contentOpacity]);

  // Pas de redirection automatique — la pro avance elle-même via le CTA,
  // le temps de lire ce qui vient d'être activé.
  useEffect(() => {
    if (isPreview) return;
    refreshActivePlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview]);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Animated.View
        style={[
          styles.content,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40, opacity: contentOpacity },
        ]}
      >
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: planColor, shadowColor: planColor, transform: [{ scale: badgeScale }] },
          ]}
        >
          <Ionicons name={PLAN_ICON[plan]} size={26} color={Colors.white} />
        </Animated.View>

        <Text style={[styles.eyebrow, { color: planColor }]}>Abonnement confirmé</Text>
        <Text style={[styles.title, { color: Colors.foreground }]}>
          Formule {PLAN_LABELS[plan]} activée
        </Text>
        <Text style={[styles.body, { color: Colors.mutedForeground }]}>
          {PLAN_NEXT_STEP[plan]}
        </Text>

        {upcomingSlides.length > 0 && (
          <View style={styles.upcoming}>
            <Text style={styles.upcomingLabel}>À découvrir juste après</Text>
            {chunk(upcomingSlides, 3).map((row, rowIndex) => (
              <View key={rowIndex} style={styles.upcomingRow}>
                {row.map((s, i) => (
                  <View key={i} style={styles.upcomingItem}>
                    <View style={[styles.upcomingIcon, { backgroundColor: withAlpha(s.color, 0.14) }]}>
                      <Ionicons name={s.icon} size={17} color={s.color} />
                    </View>
                    <Text style={styles.upcomingText} numberOfLines={2}>
                      {s.title}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <AnimatedPressable
          onPress={() => {
            if (isPreview) {
              router.replace({ pathname: "/pro-onboarding", params: { plan, preview: "1" } });
            } else if (hasNewFeatures(plan, previousPlan)) {
              router.replace({
                pathname: "/pro-onboarding",
                params: { plan, previousPlan: previousPlan ?? "" },
              });
            } else {
              router.replace("/(pro)/dashboard");
            }
          }}
          style={[styles.cta, { backgroundColor: planColor }]}
        >
          <Text style={styles.ctaText}>
            {isPreview || upcomingSlides.length > 0 ? "Découvrir les nouveautés" : "Aller au dashboard"}
          </Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 280,
  },
  upcoming: {
    width: "100%",
    marginBottom: 32,
  },
  upcomingLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.mutedForeground,
    textAlign: "center",
    marginBottom: 14,
  },
  upcomingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginBottom: 14,
  },
  upcomingItem: {
    alignItems: "center",
    width: 76,
    gap: 8,
  },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 14,
  },
  cta: {
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
});
