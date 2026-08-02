import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ADMIN } from "@/constants/adminTheme";
import type { StatusTone } from "@/components/admin/StatusBadge";

export interface OverviewItem {
  label: string;
  count: number;
  tone: StatusTone;
  onPress?: () => void;
}

const DOT_COLOR: Record<StatusTone, string> = {
  success: ADMIN.success, danger: ADMIN.danger, warning: ADMIN.warning,
  info: ADMIN.info, neutral: ADMIN.textMuted,
};

/**
 * "What needs my attention right now" — a 3-second read, not a metrics grid.
 * Bare content (no outer padding/card) so it composes inside any container —
 * a Card on the dashboard today, a plain section elsewhere tomorrow.
 * Items with count 0 are omitted; an all-clear state says so plainly.
 */
export function TodayOverview({ items }: { items: OverviewItem[] }) {
  const visible = items.filter((i) => i.count > 0);

  if (visible.length === 0) {
    return <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub }}>Rien à signaler — tout est à jour.</Text>;
  }

  return (
    <View>
      {visible.map((item, i) => {
        const Wrapper = item.onPress ? Pressable : View;
        return (
          <Wrapper
            key={item.label}
            onPress={item.onPress}
            accessibilityLabel={`${item.count} ${item.label}`}
            style={{
              flexDirection: "row", alignItems: "center", gap: ADMIN.space.sm,
              paddingVertical: ADMIN.space.sm,
              borderTopWidth: i > 0 ? 1 : 0, borderTopColor: ADMIN.border,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: DOT_COLOR[item.tone] }} />
            <Text style={{ ...ADMIN.type.body, color: ADMIN.text, flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>{item.count}</Text> {item.label}
            </Text>
            {item.onPress && <Ionicons name="chevron-forward" size={14} color={ADMIN.textMuted} />}
          </Wrapper>
        );
      })}
    </View>
  );
}
