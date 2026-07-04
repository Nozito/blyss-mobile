import React from "react";
import { View, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Colors, withAlpha } from "@/constants/colors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

interface LockedFeatureProps {
  onUnlock: () => void;
  /** Label shown on the unlock button (default: "Débloquer") */
  ctaLabel?: string;
}

/**
 * Drop this component anywhere a feature requires a Pro subscription.
 * It renders a semi-transparent overlay on top of the locked content.
 *
 * Usage:
 *   const { isPro, showPaywall } = usePro();
 *   if (!isPro) return <LockedFeature onUnlock={showPaywall} />;
 */
export function LockedFeature({ onUnlock, ctaLabel = "Débloquer" }: LockedFeatureProps) {
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUnlock();
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Fonctionnalité Pro</Text>
        <Text style={styles.subtitle}>
          Cette fonctionnalité est réservée aux abonnés Blyss Pro.
        </Text>
        <AnimatedPressable onPress={handlePress} style={styles.btn}>
          <Text style={styles.btnText}>{ctaLabel}</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(Colors.background, 0.92),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderRadius: 16,
  },
  card: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.foreground,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.white,
  },
});
