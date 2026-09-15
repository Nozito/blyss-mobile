/**
 * Sous-étape de configuration d'une prestation (variantes/options) — moteur
 * de prestations V1. Insérée dans l'étape 1 du booking, entre la sélection
 * de la prestation et la sélection du créneau (doc §14.2). Le prix/la durée
 * calculés ici sont INDICATIFS pour l'affichage — le backend recalcule tout
 * et fait toujours foi (doc §5.2).
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import type { VariantGroup, PrestationOption } from "@/types/prestation";

interface Props {
  prestationName: string;
  basePrice: number;
  baseDurationMinutes: number;
  isLoading: boolean;
  variantGroups: VariantGroup[];
  options: PrestationOption[];
  selectedVariantValueByGroup: Record<number, number>;
  selectedOptionIds: Set<number>;
  onSelectVariantValue: (groupId: number, valueId: number) => void;
  onToggleOption: (optionId: number) => void;
}

export function computeIndicativePricing(
  basePrice: number,
  baseDurationMinutes: number,
  variantGroups: VariantGroup[],
  options: PrestationOption[],
  selectedVariantValueByGroup: Record<number, number>,
  selectedOptionIds: Set<number>
): { price: number; durationMinutes: number } {
  let price = basePrice;
  let durationMinutes = baseDurationMinutes;
  for (const group of variantGroups) {
    const valueId = selectedVariantValueByGroup[group.id];
    const value = group.values.find((v) => v.id === valueId);
    if (value) {
      price += Number(value.price_delta);
      durationMinutes += Number(value.duration_delta);
    }
  }
  for (const option of options) {
    if (selectedOptionIds.has(option.id)) {
      price += Number(option.price_delta);
      durationMinutes += Number(option.duration_delta);
    }
  }
  return { price: Math.round(price * 100) / 100, durationMinutes };
}

export function isConfigComplete(variantGroups: VariantGroup[], selectedVariantValueByGroup: Record<number, number>): boolean {
  return variantGroups
    .filter((g) => g.required && g.active)
    .every((g) => selectedVariantValueByGroup[g.id] != null);
}

export function PrestationConfigurator({
  prestationName,
  basePrice,
  baseDurationMinutes,
  isLoading,
  variantGroups,
  options,
  selectedVariantValueByGroup,
  selectedOptionIds,
  onSelectVariantValue,
  onToggleOption,
}: Props) {
  const colors = useThemeColors();

  const indicative = useMemo(
    () => computeIndicativePricing(basePrice, baseDurationMinutes, variantGroups, options, selectedVariantValueByGroup, selectedOptionIds),
    [basePrice, baseDurationMinutes, variantGroups, options, selectedVariantValueByGroup, selectedOptionIds]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingBottom: 24, gap: 20 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.4 }}>
            Personnalise ta prestation
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{prestationName}</Text>
        </View>

        {variantGroups.map((group) => (
          <View key={group.id} style={{ gap: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
              {group.name}
              {group.required && <Text style={{ color: colors.primary }}> · requis</Text>}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
              {group.values.map((value) => {
                const selected = selectedVariantValueByGroup[group.id] === value.id;
                return (
                  <AnimatedPressable
                    key={value.id}
                    onPress={() => onSelectVariantValue(group.id, value.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 14,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}15` : colors.white,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? colors.primary : colors.foreground }}>
                      {value.label}
                      {value.price_delta !== 0 && ` (${value.price_delta > 0 ? "+" : ""}${value.price_delta}€)`}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        ))}

        {options.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Options</Text>
            <View style={{ gap: 8 }}>
              {options.map((option) => {
                const selected = selectedOptionIds.has(option.id);
                return (
                  <AnimatedPressable
                    key={option.id}
                    onPress={() => onToggleOption(option.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: colors.white,
                      ...Shadows.card,
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.foreground }}>{option.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.mutedForeground }}>
                      {option.price_delta > 0 ? "+" : ""}{option.price_delta}€
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        )}

        <View
          style={{
            marginTop: 4,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.white,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            ...Shadows.card,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Total estimé</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
            {indicative.price.toFixed(2)}€ · {indicative.durationMinutes}min
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
