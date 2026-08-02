import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { ADMIN } from "@/constants/adminTheme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Adds the theme's soft elevation. Off by default — flat is the norm, reserve this for the one card per screen that should read as "primary". */
  elevated?: boolean;
}

/** The one card shape for admin. Flat surface, hairline border, no gradients/blur. */
export function Card({ children, style, elevated }: CardProps) {
  return (
    <View style={[
      {
        backgroundColor: ADMIN.surface,
        borderRadius: ADMIN.cardRadius,
        borderWidth: 1,
        borderColor: ADMIN.border,
        padding: ADMIN.space.lg,
        // Elevated cards keep overflow visible so their shadow isn't clipped;
        // they never hold square-cornered children. Flat cards clip, since
        // Row lists (padding: 0) rely on this to keep the border radius.
        overflow: elevated ? "visible" : "hidden",
      },
      elevated && { shadowColor: ADMIN.shadowColor, ...ADMIN.shadowOpts },
      style,
    ]}>
      {children}
    </View>
  );
}
