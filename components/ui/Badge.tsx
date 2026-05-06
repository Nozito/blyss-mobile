import React from "react";
import { View, Text } from "react-native";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "secondary" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  destructive: "bg-destructive/10",
  secondary: "bg-secondary/10",
  outline: "border border-border bg-transparent",
};

const textStyles: Record<BadgeVariant, string> = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  secondary: "text-secondary",
  outline: "text-foreground",
};

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  return (
    <View
      className={[
        "rounded-full items-center justify-center",
        size === "sm" ? "px-2 py-0.5" : "px-3 py-1",
        variantStyles[variant],
      ].join(" ")}
    >
      <Text
        className={[
          "font-medium",
          size === "sm" ? "text-xs" : "text-sm",
          textStyles[variant],
        ].join(" ")}
      >
        {children}
      </Text>
    </View>
  );
}
