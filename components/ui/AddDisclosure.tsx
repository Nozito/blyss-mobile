import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";

interface AddDisclosureProps {
  label: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}

/** Déclencheur discret "+ Ajouter X" — le formulaire ne s'affiche qu'au tap,
 * pour ne pas noyer une liste sous des champs vides en permanence. */
export function AddDisclosure({ label, open, onOpenChange, children }: AddDisclosureProps) {
  const colors = useThemeColors();
  if (!open) {
    return (
      <Pressable onPress={() => onOpenChange(true)} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={14} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.primary }}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <View>
      {children}
      <Pressable onPress={() => onOpenChange(false)} accessibilityRole="button" style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 11.5, color: colors.mutedForeground, fontWeight: "600" }}>Annuler</Text>
      </Pressable>
    </View>
  );
}
