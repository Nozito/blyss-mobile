import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useAddressSearch, type AddressValidation } from "@/hooks/useAddressSearch";
import type { AddressSuggestion } from "@/lib/api";

export type { AddressValidation };

/**
 * Champ "Adresse" avec suggestions de vraies adresses françaises (Base
 * Adresse Nationale) + statut de validation combinant adresse ET code
 * postal (onValidationChange). Sélectionner une suggestion remplit aussi le
 * code postal via onSelectAddress — le composant ne gère pas lui-même le
 * champ code postal, géré séparément par l'écran appelant.
 */
export function AddressAutocomplete({
  addressLine,
  onChangeAddressLine,
  postalCode,
  onSelectAddress,
  onValidationChange,
  label = "Adresse *",
  placeholder = "Ex. 12 Rue de la Paix",
}: {
  addressLine: string;
  onChangeAddressLine: (value: string) => void;
  postalCode: string;
  onSelectAddress: (suggestion: AddressSuggestion) => void;
  onValidationChange?: (status: AddressValidation) => void;
  label?: string;
  placeholder?: string;
}) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const { debouncedQuery, suggestions, loading, validation, setSuggestions } = useAddressSearch(
    addressLine,
    postalCode,
    focused
  );

  useEffect(() => {
    onValidationChange?.(validation);
  }, [validation, onValidationChange]);

  const showList = focused && debouncedQuery.length >= 3 && (loading || suggestions.length > 0);

  return (
    <View>
      <Input
        label={label}
        value={addressLine}
        onChangeText={onChangeAddressLine}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        leftIcon="pin-outline"
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
                key={`${s.fullLabel}-${i}`}
                onPress={() => {
                  onSelectAddress(s);
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
                <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }} numberOfLines={1}>{s.fullLabel}</Text>
              </AnimatedPressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}
