import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useCitySearch, type CityValidation } from "@/hooks/useCitySearch";

export type { CityValidation };

/**
 * Champ ville avec suggestions de vraies communes françaises + statut de
 * validation exposé au parent (`onValidationChange`) pour bloquer une
 * sauvegarde sur "invalid" sans jamais bloquer sur "unknown" (API externe
 * injoignable — cf. `degraded` dans la réponse backend). Reste un champ
 * texte au fond : la saisie n'est jamais interceptée, seules les
 * suggestions et le statut sont informatifs.
 */
export function CityAutocomplete({
  value,
  onChangeText,
  onValidationChange,
  label = "Ville",
  placeholder = "Ex. Nantes",
}: {
  value: string;
  onChangeText: (city: string) => void;
  onValidationChange?: (status: CityValidation) => void;
  label?: string;
  placeholder?: string;
}) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const { debouncedQuery, suggestions, loading, validation, setSuggestions } = useCitySearch(value, focused);

  useEffect(() => {
    onValidationChange?.(validation);
  }, [validation, onValidationChange]);

  // On ne compare pas à la valeur exacte : la pro peut avoir tapé "paris"
  // et la suggestion canonique est "Paris" — pas de raison de re-proposer
  // la même ville qu'elle vient de choisir.
  const showList = focused && debouncedQuery.length >= 2 && (loading || suggestions.length > 0);

  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)} // laisse le tap sur une suggestion arriver avant de fermer
        placeholder={placeholder}
        leftIcon="location-outline"
        autoCapitalize="words"
      />
      {showList && (
        <View style={{ marginTop: 8, backgroundColor: colors.muted, borderRadius: 14, overflow: "hidden" }}>
          {loading ? (
            <View style={{ padding: 14, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            suggestions.map((s, i) => (
              <AnimatedPressable
                key={`${s.nom}-${s.codePostal ?? i}`}
                onPress={() => {
                  onChangeText(s.nom);
                  setSuggestions([]);
                  setFocused(false);
                  onValidationChange?.("valid");
                }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                }}
              >
                <Ionicons name="location-outline" size={15} color={colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }} numberOfLines={1}>{s.nom}</Text>
                {!!s.codePostal && (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{s.codePostal}</Text>
                )}
              </AnimatedPressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}
