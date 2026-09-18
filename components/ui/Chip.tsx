import React from "react";
import { View, Text, Pressable, type DimensionValue } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  large?: boolean;
  /** Occupe toute la largeur de son conteneur — pour une grille régulière (voir ChipGrid). */
  fill?: boolean;
}

export function Chip({ label, selected, onPress, large, fill }: ChipProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        width: fill ? "100%" : undefined,
        flexGrow: !fill && large ? 1 : 0,
        minHeight: large ? 48 : 40,
        paddingHorizontal: large ? 12 : 14,
        paddingVertical: large ? 10 : 9,
        borderRadius: large ? 14 : 12,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}15` : colors.cream,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: large ? 13.5 : 12.5, fontWeight: "700", color: selected ? colors.primary : colors.mutedForeground }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Grille régulière de chips (3 par ligne par défaut) — évite le dernier rang
 * déséquilibré d'un simple `flexWrap` quand les libellés ont des tailles très
 * différentes (ex: "30min" à "2h", "Aucun" à "30min"). */
export function ChipGrid({ children, columns = 3 }: { children: React.ReactNode; columns?: number }) {
  const gap = 8;
  const basis = `${100 / columns}%` as DimensionValue;
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -gap / 2 }}>
      {React.Children.map(children, (child) => (
        <View style={{ width: basis, paddingHorizontal: gap / 2, marginBottom: gap }}>{child}</View>
      ))}
    </View>
  );
}
