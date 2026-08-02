import React from "react";
import { View, Text } from "react-native";
import { ADMIN } from "@/constants/adminTheme";

interface SectionLabelProps {
  children: string;
  trailing?: string;
}

/**
 * Sober uppercase section marker — no icon, no color, no card.
 * No horizontal padding of its own: callers already sit inside a padded
 * wrapper alongside the card it labels, so it aligns flush with that card.
 */
export function SectionLabel({ children, trailing }: SectionLabelProps) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: ADMIN.space.sm,
    }}>
      <Text style={{
        ...ADMIN.type.caption, color: ADMIN.textMuted,
        textTransform: "uppercase", letterSpacing: 0.8,
      }}>
        {children}
      </Text>
      {trailing && (
        <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted }}>{trailing}</Text>
      )}
    </View>
  );
}
