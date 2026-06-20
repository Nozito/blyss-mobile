import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface Props extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Scale-down on press — for cards and large buttons
export function AnimatedPressable({ onPress, style, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();

  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} accessibilityRole="button" {...rest}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

// Bounce on press — for icon buttons (back, close, action icons)
export function AnimatedIconButton({ onPress, style, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const bounce = () =>
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 80, bounciness: 4 }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 60, bounciness: 0 }),
    ]).start();

  return (
    <Pressable
      onPress={() => { bounce(); (onPress as (() => void) | undefined)?.(); }}
      style={style}
      accessibilityRole="button"
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
