import React from "react";
import { ActivityIndicator, Pressable, Text, type ViewStyle } from "react-native";
import { Colors } from "@/constants/colors";

interface LoadingButtonProps {
  loading: boolean;
  onPress: () => void;
  label: string;
  variant?: "primary" | "destructive" | "success" | "ghost";
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const BG: Record<string, string> = {
  primary: Colors.primary,
  destructive: Colors.destructive,
  success: Colors.success,
  ghost: "transparent",
};

export function LoadingButton({
  loading,
  onPress,
  label,
  variant = "primary",
  disabled,
  style,
  fullWidth = true,
}: LoadingButtonProps) {
  const isDisabled = disabled || loading;
  const bg = BG[variant] ?? Colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          height: 52,
          borderRadius: 16,
          backgroundColor: variant === "ghost" ? "transparent" : bg,
          borderWidth: variant === "ghost" ? 1.5 : 0,
          borderColor: variant === "ghost" ? Colors.border : "transparent",
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.6 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "ghost" ? Colors.foreground : Colors.white} />
      ) : (
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: variant === "ghost" ? Colors.foreground : Colors.white,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
