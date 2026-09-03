import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";

/**
 * Configuration d'affichage des statuts de rendez-vous (libellé, couleur,
 * fond, icône). Point d'entrée unique — consommé par le badge et par les
 * éléments qui reprennent la couleur du statut (pastille d'avatar…).
 */
export function getStatusCfg(
  colors: ReturnType<typeof useThemeColors>
): Record<string, { label: string; color: string; bg: string; icon: string }> {
  return {
    completed:    { label: "Terminé",    color: colors.successText,  bg: withAlpha(colors.successText, 0.12),  icon: "checkmark-circle-outline" },
    cancelled:    { label: "Annulé",     color: colors.destructive,  bg: withAlpha(colors.destructive, 0.12),  icon: "close-circle-outline" },
    pending:      { label: "À venir",    color: colors.warning,      bg: withAlpha(colors.warning, 0.12),      icon: "time-outline" },
    ongoing:      { label: "En cours",   color: colors.info,         bg: withAlpha(colors.info, 0.12),         icon: "radio-button-on-outline" },
    past_pending: { label: "À valider",  color: colors.pro,          bg: withAlpha(colors.pro, 0.12),          icon: "alert-circle-outline" },
    no_show:      { label: "Absent",     color: colors.destructive,  bg: withAlpha(colors.destructive, 0.12),  icon: "person-remove-outline" },
  };
}

/**
 * Badge de statut d'un rendez-vous. `inline` = pastille + libellé (listes),
 * `pill` = capsule pleine (détail du jour).
 */
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

  if (variant === "pill") {
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: cfg.bg }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
      <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
    </View>
  );
}
