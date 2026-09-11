import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemeColors } from "@/hooks/useThemeColors";

interface FillLoaderProps {
  /** Durée du remplissage, en ms. */
  duration?: number;
  /** Texte affiché sous la barre — laisser vide pour n'afficher que la barre. */
  label?: string;
  width?: number;
}

/**
 * Barre de chargement qui se remplit une fois, linéairement, sur `duration`
 * — pas un spinner indéfini : on l'utilise quand on connaît le temps qu'on
 * fait patienter (ex. confirmation de paiement) et qu'on veut que la barre
 * "termine" pile quand l'écran suivant apparaît.
 */
export function FillLoader({ duration = 3000, label, width = 200 }: FillLoaderProps) {
  const colors = useThemeColors();
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [duration, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { width, backgroundColor: colors.primaryLight }]}>
        <Animated.View style={[styles.fill, { backgroundColor: colors.primary }, fillStyle]} />
      </View>
      {!!label && <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 14 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  label: { fontSize: 13, fontWeight: "600" },
});
