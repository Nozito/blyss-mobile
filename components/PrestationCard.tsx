/**
 * Carte prestation — DA de référence côté client (extraite de
 * ServiceSelector.tsx pour être partagée). Réutilisée telle quelle par
 * l'écran pro d'édition (service-form.tsx) comme "aperçu cliente" : c'est la
 * carte réelle que verra la cliente, pas une reconstitution.
 */
import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { formatDuration } from "@/lib/dateUtils";
import type { PricingMode } from "@/types/prestation";

export interface PrestationCardData {
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  /** "from" → la prestation a des variantes/options, le prix affiché est un minimum ("À partir de"). Omis = prix fixe. */
  pricing_mode?: PricingMode;
}

interface PrestationCardProps {
  prestation: PrestationCardData;
  /** Sélectionnable (flow de réservation) : cercle radio + bordure accentuée. Omis = affichage seul. */
  selected?: boolean;
  onPress?: () => void;
  inactive?: boolean;
}

export function PrestationCard({ prestation, selected, onPress, inactive }: PrestationCardProps) {
  const colors = useThemeColors();
  // Les colonnes NUMERIC/DECIMAL Postgres reviennent en `string` via l'API
  // (comportement par défaut du driver node-postgres) — `.toFixed` planterait
  // sinon dès que le prix vient directement des données serveur.
  const price = Number(prestation.price) || 0;
  const selectable = onPress !== undefined;

  return (
    <AnimatedPressable
      onPress={onPress ?? (() => {})}
      disabled={!selectable}
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        opacity: inactive ? 0.55 : 1,
        ...Shadows.card,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", fontSize: 15, color: colors.foreground, marginBottom: 4 }}>
            {prestation.name}
          </Text>
          {prestation.description && (
            <Text
              style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8, lineHeight: 18 }}
              numberOfLines={2}
            >
              {prestation.description}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {formatDuration(prestation.duration_minutes)}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
              {prestation.pricing_mode === "from" ? "À partir de " : ""}{price.toFixed(2)}€
            </Text>
          </View>
        </View>

        {selectable && (
          <View
            style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: selected ? colors.primary : colors.cream,
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
        )}

        {inactive && !selectable && (
          <View
            style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
              backgroundColor: colors.muted, flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Inactive
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}
