import React, { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, Text, type ViewStyle } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";

interface LoadingButtonProps {
  loading: boolean;
  onPress: () => void;
  label: string;
  variant?: "primary" | "destructive" | "success" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function LoadingButton({
  loading,
  onPress,
  label,
  variant = "primary",
  disabled,
  style,
  fullWidth = true,
}: LoadingButtonProps) {
  const colors = useThemeColors();
  const BG: Record<string, string> = {
    primary: colors.primary,
    destructive: colors.destructive,
    success: colors.success,
    ghost: "transparent",
  };
  const isDisabled = disabled || loading;
  const bg = BG[variant] ?? colors.primary;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], alignSelf: fullWidth ? "stretch" : "auto" }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          {
            height: 56,
            borderRadius: 16,
            backgroundColor: variant === "ghost" ? "transparent" : bg,
            borderWidth: variant === "ghost" ? 1.5 : 0,
            borderColor: variant === "ghost" ? colors.border : "transparent",
            alignItems: "center",
            justifyContent: "center",
            opacity: isDisabled ? 0.6 : 1,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variant === "ghost" ? colors.foreground : "#FFFFFF"} />
        ) : (
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: variant === "ghost" ? colors.foreground : "#FFFFFF",
            }}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
