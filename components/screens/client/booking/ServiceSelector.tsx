import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";

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

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h${mins}`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

export function ServiceSelector({
  prestations,
  selectedId,
  onSelect,
  proName,
  proCity,
  conditions,
}: Props) {
  const activeConditions = (conditions ?? []).filter((c) => c.text.trim());

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingBottom: 24, gap: 20 }}>
        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 }}>
            Choisis ta prestation
          </Text>
          <Text style={{ fontSize: 14, color: "#6D6D78" }}>
            Avec {proName}
            {proCity ? ` à ${proCity}` : ""}
          </Text>
        </View>

        {/* Conditions de réservation */}
        {activeConditions.length > 0 && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 16,
              gap: 12,
              ...Shadows.card,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#6D6D78" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#09090B" }}>
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
                    backgroundColor: c.accepted ? "#F0FDF4" : "#FFF1F2",
                    borderColor: c.accepted ? "#BBF7D0" : "#FECDD3",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: c.accepted ? "#22C55E" : "#FB7185",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons
                      name={c.accepted ? "checkmark" : "close"}
                      size={11}
                      color="#fff"
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      lineHeight: 18,
                      flex: 1,
                      color: c.accepted ? "#166534" : "#9F1239",
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
              <Pressable
                key={prestation.id}
                onPress={() => onSelect(prestation.id)}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: isSelected ? "#FE5D9D" : "#EBE6E0",
                  ...Shadows.card,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", fontSize: 15, color: "#09090B", marginBottom: 4 }}>
                      {prestation.name}
                    </Text>
                    {prestation.description && (
                      <Text
                        style={{ fontSize: 12, color: "#6D6D78", marginBottom: 8, lineHeight: 18 }}
                        numberOfLines={2}
                      >
                        {prestation.description}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="time-outline" size={14} color="#FE5D9D" />
                        <Text style={{ fontSize: 12, color: "#6D6D78" }}>
                          {formatDuration(prestation.duration_minutes)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="sparkles-outline" size={14} color="#FE5D9D" />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#09090B" }}>
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
                      backgroundColor: isSelected ? "#FE5D9D" : "#F8F5F1",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
