import React from "react";
import { Platform, Text } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";

/**
 * Capsule flottante sobre façon Liquid Glass (matériau flou translucide) —
 * matériau visuel commun à toutes les notifications flottantes de l'app
 * (hors connexion, erreur d'action…). Purement présentationnel.
 */
export function NoticeCapsule({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();

  // La teinte translucide est peinte sous le flou : la capsule reste correcte
  // même si Android ne rend pas le blur.
  const surface = isDark ? "rgba(28,28,30,0.72)" : "rgba(255,255,255,0.72)";
  const hairline = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)";

  // Message court (hors connexion) → pilule 1 ligne. Message long (erreur) → le
  // texte passe à la ligne et la capsule s'agrandit, jamais tronqué.
  const oneLine = text.length <= 32;

  return (
    <BlurView
      intensity={Platform.OS === "ios" ? 40 : 20}
      tint={isDark ? "dark" : "light"}
      style={{
        flexDirection: "row",
        alignItems: oneLine ? "center" : "flex-start",
        gap: 8,
        maxWidth: "92%",
        paddingVertical: oneLine ? 9 : 11,
        paddingHorizontal: 16,
        borderRadius: oneLine ? 999 : 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: hairline,
        backgroundColor: surface,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.4 : 0.12,
        shadowRadius: 16,
        elevation: 6,
      }}
    >
      <Ionicons
        name={icon}
        size={15}
        color={colors.foreground}
        style={{ marginTop: oneLine ? 0 : 2 }}
      />
      <Text
        accessibilityRole="alert"
        numberOfLines={3}
        style={{ flexShrink: 1, fontSize: 13, fontWeight: "600", lineHeight: 18, color: colors.foreground }}
      >
        {text}
      </Text>
    </BlurView>
  );
}
