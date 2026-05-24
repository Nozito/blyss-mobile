import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

interface Props {
  width: number | string;
  height: number;
  borderRadius?: number;
}

export function SkeletonBox({ width, height, borderRadius = 8 }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{ width, height, borderRadius, backgroundColor: "#E4E4E7", opacity }}
    />
  );
}
