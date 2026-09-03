import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";

/**
 * Trois rôles visuels — jamais la couleur seule :
 *   primary : état actif / "live"        (En cours)
 *   neutral : structure, états passés    (À venir, Terminé, Annulé)
 *   alert   : action requise / anomalie  (À valider, Absent)
 *
 * La distinction se fait aussi par l'icône, le barré (Annulé) et l'opacité
 * réduite (Terminé).
 */
export type StatusRole = "primary" | "neutral" | "alert";

type StatusMeta = {
  label: string;
  role: StatusRole;
  icon: string;
  strikethrough?: boolean;
  dim?: boolean;
};

const STATUS_META: Record<string, StatusMeta> = {
  pending:      { label: "À venir",   role: "neutral", icon: "time-outline" },
  ongoing:      { label: "En cours",  role: "primary", icon: "ellipse" },
  past_pending: { label: "À valider", role: "alert",   icon: "alert-circle" },
  completed:    { label: "Terminé",   role: "neutral", icon: "checkmark-circle-outline", dim: true },
  cancelled:    { label: "Annulé",    role: "neutral", icon: "close-circle-outline", strikethrough: true },
  no_show:      { label: "Absent",    role: "alert",   icon: "person-remove-outline" },
};

export type StatusCfg = StatusMeta & { color: string; bg: string };

export function getStatusCfg(
  colors: ReturnType<typeof useThemeColors>
): Record<string, StatusCfg> {
  // alert : texte foncé (warningTextDark) sur warningLight → contraste AA
  // (~5:1 clair, élevé en sombre), au lieu de l'ambre vif sous-contrasté.
  const color = (r: StatusRole) =>
    r === "primary" ? colors.primary : r === "alert" ? colors.warningTextDark : colors.mutedForeground;
  const bg = (r: StatusRole) =>
    r === "primary"
      ? withAlpha(colors.primary, 0.12)
      : r === "alert"
        ? colors.warningLight
        : colors.muted;

  const out: Record<string, StatusCfg> = {};
  for (const [key, m] of Object.entries(STATUS_META)) {
    out[key] = { ...m, color: color(m.role), bg: bg(m.role) };
  }
  return out;
}

export function StatusBadge({
  statusKey,
  variant,
}: {
  statusKey: string;
  variant: "inline" | "pill";
}) {
  const colors = useThemeColors();
  const STATUS_CFG = useMemo(() => getStatusCfg(colors), [colors]);
  const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.pending;

  const label = (
    <Text
      style={{
        fontSize: 10,
        fontWeight: "700",
        color: cfg.color,
        textDecorationLine: cfg.strikethrough ? "line-through" : "none",
      }}
    >
      {cfg.label}
    </Text>
  );

  if (variant === "pill") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 20,
          backgroundColor: cfg.bg,
          opacity: cfg.dim ? 0.7 : 1,
        }}
      >
        <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={11} color={cfg.color} />
        {label}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: cfg.dim ? 0.7 : 1 }}>
      <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={11} color={cfg.color} />
      {label}
    </View>
  );
}
