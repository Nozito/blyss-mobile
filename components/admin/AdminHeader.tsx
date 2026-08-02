import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ADMIN } from "@/constants/adminTheme";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  /** At most one action — an icon button or a short text link. Never more. */
  action?: React.ReactNode;
  /** Set false to drop the safe-area top inset entirely, so the title sits flush against the very top of the screen. Defaults to true. */
  safeTop?: boolean;
}

/**
 * Every admin screen opens with this and nothing else: title, one-line
 * subtitle, one optional action. No search bars, filter pills, or stat
 * strips live here — those belong to the screen body, below the fold.
 */
export function AdminHeader({ title, subtitle, action, safeTop = true }: AdminHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      paddingTop: (safeTop ? insets.top : 0) + ADMIN.space.sm,
      paddingHorizontal: ADMIN.space.xl,
      paddingBottom: ADMIN.space.lg,
      backgroundColor: ADMIN.bg,
    }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...ADMIN.type.display, color: ADMIN.text }}>{title}</Text>
          {subtitle && (
            <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub, marginTop: 3 }}>{subtitle}</Text>
          )}
        </View>
        {action}
      </View>
    </View>
  );
}
