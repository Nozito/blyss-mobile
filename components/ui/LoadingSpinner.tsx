import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { BlyssLogoLoader } from "@/components/ui/BlyssLogoLoader";
import { useThemeColors } from "@/hooks/useThemeColors";

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: "small" | "large";
  backgroundColor?: string;
  style?: ViewStyle;
}

const LOGO_SIZE = { small: 40, large: 64 } as const;

export function LoadingSpinner({ message, fullScreen = false, size = "large", backgroundColor, style }: LoadingSpinnerProps) {
  const colors = useThemeColors();

  if (fullScreen) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={[{ backgroundColor: backgroundColor ?? colors.background }, style]}
      >
        <BlyssLogoLoader size={LOGO_SIZE[size]} />
        {message && (
          <Text className="mt-3 text-sm" style={{ color: colors.mutedForeground }}>{message}</Text>
        )}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-8">
      <BlyssLogoLoader size={LOGO_SIZE[size]} />
      {message && (
        <Text className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>{message}</Text>
      )}
    </View>
  );
}
