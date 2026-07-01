import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  width?: number | string; // BLYSS-FIX: 2.3 — optional, defaults to "100%"
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function SkeletonBox({ width = "100%", height, borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.95, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: Colors.muted,
          opacity,
        },
        style as any,
      ]}
    />
  );
}