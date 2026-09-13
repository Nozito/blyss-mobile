import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useDebounce } from "@/hooks/useDebounce";
import { geoApi, type CitySuggestion } from "@/lib/api";

/**
 * Champ ville avec suggestions de vraies communes françaises (#5) — avant
 * ce composant, la ville des préférences client était du texte libre, sans
 * garantie de correspondre à un lieu réel. Reste un champ texte au fond
 * (on ne bloque jamais la saisie) : les suggestions n'apparaissent qu'en
 * complément, jamais de couche bloquante.
 */
export function CityAutocomplete({
  value,
  onChangeText,
  label = "Ville",
  placeholder = "Ex. Nantes",
}: {
  value: string;
  onChangeText: (city: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebounce(value.trim(), 250);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!focused || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    geoApi
      .searchCities(debouncedQuery)
      .then((res) => {
        if (cancelled) return;
        setSuggestions(res.success && res.data ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [focused, debouncedQuery]);

  // On ne compare pas à la valeur exacte : la cliente peut avoir tapé "paris"
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
