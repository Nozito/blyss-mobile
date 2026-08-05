import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={32} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: colors.foreground,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={{
            fontSize: 13,
            color: colors.mutedForeground,
            textAlign: "center",
            maxWidth: 260,
            lineHeight: 19,
          }}
        >
          {description}
        </Text>
      )}
      {ctaLabel && onCta && (
        <Button variant="primary" size="lg" onPress={onCta} style={{ marginTop: 8 }}>
          {ctaLabel}
        </Button>
      )}
    </View>
  );
}
