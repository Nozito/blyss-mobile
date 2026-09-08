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
      marginBottom: ADMIN.space.md,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.sm }}>
        {/* Tiret rose — accent de section */}
        <View style={{ width: 14, height: 3, backgroundColor: ADMIN.accent }} />
        <Text style={{ ...ADMIN.type.title, color: ADMIN.text }}>{children}</Text>
      </View>
      {trailing && (
        <Text style={{ ...ADMIN.type.label, color: ADMIN.textSub }}>{trailing}</Text>
      )}
    </View>
  );
}
