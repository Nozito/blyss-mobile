import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { formatDuration } from "@/lib/dateUtils";

export interface Prestation {
  id: number;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
}

export interface ConditionItem {
  text: string;
  accepted: boolean;
}

interface Props {
  prestations: Prestation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  proName: string;
  proCity: string | null;
  conditions: ConditionItem[] | null;
}

export function ServiceSelector({
  prestations,
  selectedId,
  onSelect,
  proName,
  proCity,
  conditions,
}: Props) {
  const colors = useThemeColors();
  const activeConditions = (conditions ?? []).filter((c) => c.text.trim());

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingBottom: 24, gap: 20 }}>
        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
            Choisis ta prestation
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            Avec {proName}
            {proCity ? ` à ${proCity}` : ""}
          </Text>
        </View>

        {/* Conditions de réservation */}
        {activeConditions.length > 0 && (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: 16,
              padding: 16,
              gap: 12,
              ...Shadows.card,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                Conditions de réservation
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {activeConditions.map((c, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    backgroundColor: c.accepted ? colors.successLight : colors.destructiveLight,
                    borderColor: c.accepted ? colors.successBorder : withAlpha(colors.destructive, 0.3),
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: c.accepted ? colors.success : colors.destructive,
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons
                      name={c.accepted ? "checkmark" : "close"}
                      size={11}
                      color={colors.white}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      lineHeight: 18,
                      flex: 1,
                      color: c.accepted ? colors.successTextDark : colors.destructiveText,
                    }}
                  >
                    {c.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Prestations list */}
        <View style={{ gap: 12 }}>
          {prestations.map((prestation) => {
            const isSelected = selectedId === prestation.id;
            return (
              <AnimatedPressable
                key={prestation.id}
                onPress={() => onSelect(prestation.id)}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.border,
                  ...Shadows.card,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", fontSize: 15, color: colors.foreground, marginBottom: 4 }}>
                      {prestation.name}
                    </Text>
                    {prestation.description && (
                      <Text
                        style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8, lineHeight: 18 }}
                        numberOfLines={2}
                      >
                        {prestation.description}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                          {formatDuration(prestation.duration_minutes)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                          {prestation.price.toFixed(2)}€
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: isSelected ? colors.primary : colors.cream,
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
