import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
} from "react-native";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "style"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: "bg-primary active:opacity-80",
    text: "text-white font-semibold",
  },
  secondary: {
    container: "bg-secondary active:opacity-80",
    text: "text-white font-semibold",
  },
  outline: {
    container: "border border-primary bg-transparent active:bg-primary/10",
    text: "text-primary font-semibold",
  },
  ghost: {
    container: "bg-transparent active:bg-black/5",
    text: "text-primary font-medium",
  },
  destructive: {
    container: "bg-destructive active:opacity-80",
    text: "text-white font-semibold",
  },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: "h-9 px-3 rounded-xl", text: "text-sm" },
  md: { container: "h-12 px-5 rounded-2xl", text: "text-base" },
  lg: { container: "h-14 px-6 rounded-2xl", text: "text-lg" },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  style,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled ?? loading;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={style}
      className={[
        "flex-row items-center justify-center",
        v.container,
        s.container,
        fullWidth ? "w-full" : "self-start",
        isDisabled ? "opacity-50" : "",
      ].join(" ")}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text className={`${v.text} ${s.text}`}>{children}</Text>
      )}
    </Pressable>
  );
}
