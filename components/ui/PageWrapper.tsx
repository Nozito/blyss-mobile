import React from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { StyleProp, ViewStyle } from "react-native";

interface PageWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export function PageWrapper({ children, style, delay = 0 }: PageWrapperProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(320)
        .delay(delay)
        .springify()
        .damping(22)
        .stiffness(200)}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}
