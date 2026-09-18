import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

interface AccordionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

/** Section repliable — icône encadrée, titre, résumé, chevron. Partagée par
 * l'édition de prestation (prix/durée, battement) et Variantes & options. */
export function Accordion({ icon, title, subtitle, open, onToggle, children }: AccordionProps) {
  const colors = useThemeColors();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 10 }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={17} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.foreground }}>{title}</Text>
          <Text style={{ fontSize: 11.5, color: colors.mutedForeground, marginTop: 1 }}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }} />
      </Pressable>
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>{children}</View>}
    </View>
  );
}
