import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { BlyssLogoLoader } from "@/components/ui/BlyssLogoLoader";
import { SPLASH_BACKGROUND_COLOR } from "@/constants/splash";

interface SplashOverlayProps {
  logoSize?: number;
  style?: ViewStyle;
}

/**
 * Fond + logo animé partagés par le launch splash (app/_layout.tsx) et les transitions
 * in-app (TransitionContext) — un seul endroit pour la couleur et le traitement a11y.
 */
export function SplashOverlay({ logoSize = 160, style }: SplashOverlayProps) {
  return (
    <View
      style={[styles.fill, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <BlyssLogoLoader size={logoSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
});
