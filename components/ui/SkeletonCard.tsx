import React, { useRef, useEffect } from "react";
import { Animated, View } from "react-native";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function SkeletonCard() {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const shimmer = useRef(new Animated.Value(reduceMotion ? 0.7 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduceMotion]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });

  return (
    <Animated.View
      style={{
        opacity,
        flexDirection: "row",
        backgroundColor: colors.card,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: withAlpha(colors.border, 0.4),
        minHeight: 130,
        marginBottom: 12,
      }}
    >
      <View style={{ width: 108, backgroundColor: colors.muted, flexShrink: 0 }} />
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <View style={{ height: 16, width: "75%", backgroundColor: colors.muted, borderRadius: 8 }} />
        <View style={{ height: 12, width: "50%", backgroundColor: colors.muted, borderRadius: 8 }} />
        <View style={{ height: 12, width: "65%", backgroundColor: colors.muted, borderRadius: 8 }} />
        <View
          style={{
            height: 36,
            backgroundColor: colors.muted,
            borderRadius: 12,
            marginTop: "auto" as any,
          }}
        />
      </View>
    </Animated.View>
  );
}
