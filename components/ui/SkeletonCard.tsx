import React, { useRef, useEffect } from "react";
import { Animated, View } from "react-native";

export function SkeletonCard() {
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
      style={{
        opacity,
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(235,230,224,0.4)",
        minHeight: 130,
        marginBottom: 12,
      }}
    >
      <View style={{ width: 108, backgroundColor: "#EDE8E3", flexShrink: 0 }} />
      <View style={{ flex: 1, padding: 16, gap: 10 }}>
        <View style={{ height: 16, width: "75%", backgroundColor: "#EDE8E3", borderRadius: 8 }} />
        <View style={{ height: 12, width: "50%", backgroundColor: "#EDE8E3", borderRadius: 8 }} />
        <View style={{ height: 12, width: "65%", backgroundColor: "#EDE8E3", borderRadius: 8 }} />
        <View
          style={{
            height: 36,
            backgroundColor: "#EDE8E3",
            borderRadius: 12,
            marginTop: "auto" as any,
          }}
        />
      </View>
    </Animated.View>
  );
}
