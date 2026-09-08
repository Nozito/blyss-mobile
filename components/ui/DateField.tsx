import React, { useState } from "react";
import { View, Text, Platform } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Modal } from "@/components/ui/Modal";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";

/**
 * Champ "date" pour les bottom-sheets (NewAppointmentSheet, AbsenceSheet).
 *
 * Le picker n'est JAMAIS rendu dans le flux du ScrollView parent :
 *  - iOS  : présenté dans une petite Modal dédiée (barre Annuler / OK) —
 *           un seul picker à la fois, fermeture explicite, aucun conflit
 *           de geste avec le scroll de la feuille.
 *  - Android : dialog natif ; se referme sur "set" comme sur "dismissed".
 *
 * `onChange` n'est appelé qu'à la validation (jamais pendant le défilement
 * du calendrier), pour que le parent gère lui-même les dépendances
 * (ex. borne min de la date de fin).
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  formatValue,
  placeholder = "Sélectionner une date",
  accessibilityLabel,
}: {
  label?: string;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  formatValue: (d: Date) => string;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? minimumDate ?? new Date());

  const openPicker = () => {
    setDraft(value ?? minimumDate ?? new Date());
    setOpen(true);
  };

  const onAndroid = (e: DateTimePickerEvent, d?: Date) => {
    setOpen(false); // "set" ET "dismissed" ferment le dialog
    if (e.type === "set" && d) onChange(d);
  };

  const confirmIos = () => {
    setOpen(false);
    onChange(draft);
  };

  return (
    <View style={{ gap: label ? 8 : 0 }}>
      {label ? (
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {label}
        </Text>
      ) : null}

      <AnimatedPressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? "Choisir une date"}
        style={{
          height: 48,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: open ? colors.primary : colors.border,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: value ? "700" : "400",
            color: value ? colors.foreground : colors.mutedForeground,
            textTransform: value ? "capitalize" : "none",
          }}
        >
          {value ? formatValue(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
      </AnimatedPressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={onAndroid}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} onClose={() => setOpen(false)} bottomSheet>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 }}>
              <AnimatedPressable onPress={() => setOpen(false)} accessibilityLabel="Annuler" style={{ paddingVertical: 6, paddingRight: 12 }}>
                <Text style={{ fontSize: 15, color: colors.mutedForeground }}>Annuler</Text>
              </AnimatedPressable>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>{label ?? "Date"}</Text>
              <AnimatedPressable onPress={confirmIos} accessibilityLabel="Valider la date" style={{ paddingVertical: 6, paddingLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>OK</Text>
              </AnimatedPressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              onChange={(_, d) => { if (d) setDraft(d); }}
              themeVariant={isDark ? "dark" : "light"}
              accentColor={colors.primary}
              style={{ alignSelf: "stretch" }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
