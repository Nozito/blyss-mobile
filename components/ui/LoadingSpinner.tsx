import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { BlyssLogoLoader } from "@/components/ui/BlyssLogoLoader";

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: "small" | "large";
  backgroundColor?: string;
  style?: ViewStyle;
}

const LOGO_SIZE = { small: 40, large: 64 } as const;

export function LoadingSpinner({ message, fullScreen = false, size = "large", backgroundColor, style }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={[backgroundColor ? { backgroundColor } : undefined, style]}
      >
        <BlyssLogoLoader size={LOGO_SIZE[size]} />
        {message && (
          <Text className="mt-3 text-sm text-muted-foreground">{message}</Text>
        )}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-8">
      <BlyssLogoLoader size={LOGO_SIZE[size]} />
      {message && (
        <Text className="mt-2 text-sm text-muted-foreground">{message}</Text>
      )}
    </View>
  );
}
