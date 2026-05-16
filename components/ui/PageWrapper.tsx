import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";

interface PageWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
}

export function PageWrapper({ children, style }: PageWrapperProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {children}
    </View>
  );
}
