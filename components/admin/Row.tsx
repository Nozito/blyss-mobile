import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ADMIN } from "@/constants/adminTheme";

/** Same vocabulary as StatusBadge, plus "accent" for a primary (non-destructive) action. */
export type RowTone = "accent" | "success" | "danger" | "warning" | "info" | "neutral";

/** Exported so other action-oriented layouts (e.g. an icon grid) can reuse the exact same tone colors. */
export const ROW_TONE: Record<RowTone, { color: string; bg: string }> = {
  accent:  { color: ADMIN.accent,  bg: ADMIN.accentBg },
  success: { color: ADMIN.success, bg: ADMIN.successBg },
  danger:  { color: ADMIN.danger,  bg: ADMIN.dangerBg },
  warning: { color: ADMIN.warning, bg: ADMIN.warningBg },
  info:    { color: ADMIN.info,    bg: ADMIN.infoBg },
  neutral: { color: ADMIN.textSub, bg: ADMIN.surfaceHover },
};

interface RowProps {
  /** Avatar, initial circle, or small icon — fixed 36×36 slot. Ignored if `icon` is set. */
  leading?: React.ReactNode;
  /** Icon name for a tinted 32×32 leading circle — the tone-driven alternative to `leading`. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Colors the icon circle and, for action rows, the title. Defaults to neutral. */
  tone?: RowTone;
  /** Who/what this row is. One line, truncated. */
  title: string;
  /** One line max — the second fact a reader needs. */
  subtitle?: string;
  /** Right side: a StatusBadge, an amount, or a chevron. Never more than one. */
  trailing?: React.ReactNode;
  /** Small text under the trailing slot — e.g. a date. */
  trailingMeta?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  dimmed?: boolean;
  showChevron?: boolean;
  showDivider?: boolean;
  accessibilityLabel?: string;
}

/**
 * The single list-row shape for the whole admin surface — flat, one hairline
 * divider, minimum 44pt tap target. Transparent background: it always sits
 * inside whatever surface its container already painted (screen bg or a
 * Card), never its own. A row answers who/what and status/action at a
 * glance; it is never a card and never grows past this.
 */
export function Row({
  leading, icon, tone = "neutral", title, subtitle, trailing, trailingMeta,
  onPress, onLongPress, dimmed, showChevron, showDivider = true,
  accessibilityLabel,
}: RowProps) {
  const { color, bg } = ROW_TONE[tone];
  const isActionTone = !!icon && tone !== "neutral";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: ADMIN.space.md,
        paddingHorizontal: ADMIN.space.xl,
        paddingVertical: ADMIN.space.md,
        minHeight: 44,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: ADMIN.border,
        opacity: dimmed ? 0.5 : pressed ? 0.6 : 1,
        backgroundColor: "transparent",
      })}
    >
      {icon ? (
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      ) : leading && (
        <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>{leading}</View>
      )}

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...ADMIN.type.title, fontSize: 15, color: isActionTone ? color : ADMIN.text }} numberOfLines={1}>{title}</Text>
        {subtitle && (
          <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      {(trailing || trailingMeta) && (
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          {trailing}
          {trailingMeta && <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted }}>{trailingMeta}</Text>}
        </View>
      )}

      {showChevron && <Ionicons name="chevron-forward" size={15} color={ADMIN.textMuted} />}
    </Pressable>
  );
}
