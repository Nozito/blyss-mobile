import React from "react";
import { View, ActivityIndicator, Text, ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: "small" | "large";
  backgroundColor?: string;
  style?: ViewStyle;
}

export function LoadingSpinner({ message, fullScreen = false, size = "large", backgroundColor, style }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={[backgroundColor ? { backgroundColor } : undefined, style]}
      >
        <ActivityIndicator size={size} color={Colors.primary} />
        {message && (
          <Text className="mt-3 text-sm text-muted-foreground">{message}</Text>
        )}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-8">
      <ActivityIndicator size={size} color={Colors.primary} />
      {message && (
        <Text className="mt-2 text-sm text-muted-foreground">{message}</Text>
      )}
    </View>
  );
}
