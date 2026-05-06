import React from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 18, readonly = false }: StarRatingProps) {
  return (
    <View className="flex-row gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => !readonly && onChange?.(star)}
          disabled={readonly}
        >
          <Ionicons
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={star <= value ? Colors.secondary : Colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}
