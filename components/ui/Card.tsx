import React from "react";
import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export function Card({ children, className = "", elevated = false, ...props }: CardProps) {
  return (
    <View
      {...props}
      className={[
        "bg-card rounded-2xl p-4",
        elevated ? "shadow-sm" : "",
        className,
      ].join(" ")}
      style={[
        elevated && {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        props.style,
      ]}
    >
      {children}
    </View>
  );
}
