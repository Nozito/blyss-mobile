import React, { useRef, useEffect } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";

interface Props {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonLine({ width = "100%", height = 12, style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });

  return (
    <Animated.View
      style={[
        {
          opacity,
          width: width as any,
          height,
          backgroundColor: Colors.border,
          borderRadius: height / 2,
        },
        style,
      ]}
    />
  );
}
