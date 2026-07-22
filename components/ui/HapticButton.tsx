import React from "react";
import * as Haptics from "expo-haptics";
import { AnimatedPressable } from "./AnimatedPressable";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";

interface HapticButtonProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

// AnimatedPressable + automatic haptic feedback — use for confirm/important actions
export function HapticButton({
  onPress,
  hapticStyle = Haptics.ImpactFeedbackStyle.Medium,
  ...rest
}: HapticButtonProps) {
  const handlePress = (event: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
    Haptics.impactAsync(hapticStyle);
    (onPress as (e: typeof event) => void)?.(event);
  };

  return <AnimatedPressable onPress={handlePress} {...rest} />;
}
