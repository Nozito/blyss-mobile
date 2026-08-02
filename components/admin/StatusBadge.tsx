import React from "react";
import { View, Text } from "react-native";
import { ADMIN } from "@/constants/adminTheme";

export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const TONE: Record<StatusTone, { color: string; bg: string }> = {
  success: { color: ADMIN.success, bg: ADMIN.successBg },
  danger:  { color: ADMIN.danger,  bg: ADMIN.dangerBg },
  warning: { color: ADMIN.warning, bg: ADMIN.warningBg },
  info:    { color: ADMIN.info,    bg: ADMIN.infoBg },
  neutral: { color: ADMIN.textSub, bg: ADMIN.surfaceHover },
};

/** The one badge shape used everywhere in admin. Color carries meaning only — never decoration. */
export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const { color, bg } = TONE[tone];
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: bg }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color }}>{label}</Text>
    </View>
  );
}
