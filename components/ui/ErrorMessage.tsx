import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

interface ErrorMessageProps {
  message: string;
  /** true → inline banner, false → centered full-block */
  inline?: boolean;
}

export function ErrorMessage({ message, inline = true }: ErrorMessageProps) {
  const colors = useThemeColors();
  if (inline) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.destructiveLight,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
        <Text style={{ fontSize: 13, color: colors.destructiveText, flex: 1, lineHeight: 18 }}>
          {message}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
}
