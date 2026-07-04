import React, { useRef } from "react";
import { View, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readonly?: boolean;
}

function Star({
  star,
  value,
  size,
  readonly,
  onChange,
}: {
  star: number;
  value: number;
  size: number;
  readonly: boolean;
  onChange?: (value: number) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (readonly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 80 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
    onChange?.(star);
  };

  return (
    <Pressable onPress={handlePress} disabled={readonly} hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={star <= value ? "star" : "star-outline"}
          size={size}
          color={star <= value ? Colors.secondary : Colors.border}
        />
      </Animated.View>
    </Pressable>
  );
}

export function StarRating({ value, onChange, size = 18, readonly = false }: StarRatingProps) {
  return (
    <View className="flex-row gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} star={star} value={value} size={size} readonly={readonly} onChange={onChange} />
      ))}
    </View>
  );
}
