import React from "react";
import { View, ViewStyle } from "react-native";
import { BlyssLogoLoader } from "@/components/ui/BlyssLogoLoader";
import { SPLASH_BACKGROUND_COLOR, SPLASH_BACKGROUND_COLOR_DARK } from "@/constants/splash";
import { useIsDarkMode } from "@/hooks/useThemeColors";

interface SplashOverlayProps {
  logoSize?: number;
  style?: ViewStyle;
}

/**
 * Fond + logo animé partagés par le launch splash (app/_layout.tsx) et les transitions
 * in-app (TransitionContext) — un seul endroit pour la couleur et le traitement a11y.
 * Le choix light/dark suit le même système que le splash natif (expo-splash-screen
 * plugin, variante `dark` dans app.config.ts) pour éviter tout flash au hand-off.
 */
export function SplashOverlay({ logoSize = 160, style }: SplashOverlayProps) {
  const isDark = useIsDarkMode();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: isDark ? SPLASH_BACKGROUND_COLOR_DARK : SPLASH_BACKGROUND_COLOR, alignItems: "center", justifyContent: "center" },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <BlyssLogoLoader size={logoSize} />
    </View>
  );
}
