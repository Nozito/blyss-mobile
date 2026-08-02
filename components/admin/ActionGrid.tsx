import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ADMIN } from "@/constants/adminTheme";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ROW_TONE, type RowTone } from "@/components/admin/Row";

export interface ActionTileData {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: RowTone;
  label: string;
  onPress: () => void;
  loading?: boolean;
}

function ActionTile({ icon, tone, label, onPress, loading }: ActionTileData) {
  const { color, bg } = ROW_TONE[tone];
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: "center", gap: ADMIN.space.sm, opacity: loading ? 0.5 : 1 }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={20} color={color} />}
      </View>
      <Text style={{ ...ADMIN.type.caption, color: ADMIN.text, textAlign: "center" }} numberOfLines={1}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Icon-over-label action tiles, 3 per row. Splits a flat action list into rows of 3, padding the last row with invisible spacers so tiles stay left-aligned instead of stretching. */
export function ActionGrid({ tiles }: { tiles: ActionTileData[] }) {
  const rows: ActionTileData[][] = [];
  for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));

  return (
    <View style={{ gap: ADMIN.space.lg }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: ADMIN.space.md }}>
          {row.map(({ key, ...tile }) => <ActionTile key={key} {...tile} />)}
          {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, j) => <View key={`spacer-${j}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}
