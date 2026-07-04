import React, { useRef, useEffect } from "react";
import { Animated, View } from "react-native";
import { Colors } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function SkeletonCard() {
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
        backgroundColor: Colors.card,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(235,230,224,0.4)",
        minHeight: 130,
        marginBottom: 12,
      }}
    >
      <View style={{ width: 108, backgroundColor: Colors.muted, flexShrink: 0 }} />
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <View style={{ height: 16, width: "75%", backgroundColor: Colors.muted, borderRadius: 8 }} />
        <View style={{ height: 12, width: "50%", backgroundColor: Colors.muted, borderRadius: 8 }} />
        <View style={{ height: 12, width: "65%", backgroundColor: Colors.muted, borderRadius: 8 }} />
        <View
          style={{
            height: 36,
            backgroundColor: Colors.muted,
            borderRadius: 12,
            marginTop: "auto" as any,
          }}
        />
      </View>
    </Animated.View>
  );
}
