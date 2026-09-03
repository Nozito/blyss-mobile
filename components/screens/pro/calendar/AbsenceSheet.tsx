import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal } from "@/components/ui/Modal";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { toLocalDate } from "@/lib/dateUtils";
import { proApi } from "@/lib/api";

export type Unavailability = {
  id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
};

/**
 * Bottom-sheet de gestion des absences (périodes d'indisponibilité).
 * Aucune logique de rendez-vous ici : uniquement l'API absences
 * (`/api/pro/unavailabilities`). Le parent détient la liste et la met à
 * jour via `onChanged`.
 */
export function AbsenceSheet({
  visible,
  onClose,
  unavailabilities,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  unavailabilities: Unavailability[];
  onChanged: (list: Unavailability[]) => void;
}) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const { showToast } = useToast();

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setStartDate(null);
    setEndDate(null);
    setReason("");
    setShowStartPicker(false);
    setShowEndPicker(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const createUnavailability = async () => {
    setError(null);
    if (!startDate || !endDate) {
      setError("Sélectionne une période");
      return;
    }
    const startStr = toLocalDate(startDate);
    const endStr = toLocalDate(endDate);
    if (endStr < startStr) {
      setError("La date de fin doit être après le début");
      return;
    }
    setSaving(true);
    try {
      await proApi.createUnavailability({ start_date: startStr, end_date: endStr, reason: reason || undefined });
      const res = await proApi.getUnavailabilities();
      if (res.success && res.data) onChanged(res.data as Unavailability[]);
      resetForm();
      onClose();
    } catch {
      setError("Impossible d'enregistrer la période");
    } finally {
      setSaving(false);
    }
  };

  const removeUnavailability = async (id: number) => {
    const backup = [...unavailabilities];
    onChanged(unavailabilities.filter((u) => u.id !== id));
    try {
      const res = await proApi.deleteUnavailability(id);
      if (!res.success) throw new Error(res.error);
    } catch {
      onChanged(backup);
      showToast("Impossible de supprimer cette absence", "error");
    }
  };

  return (
    <Modal visible={visible} onClose={handleClose} bottomSheet noPadding maxHeight="90%">
      <View style={{ overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28, flex: 1 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="moon-outline" size={22} color={colors.foreground} />
              </View>
              <View>
                <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground }}>Absences</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>Bloque une journée ou une période</Text>
              </View>
            </View>
            <AnimatedIconButton
              onPress={handleClose}
              accessibilityLabel="Fermer"
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={18} color={colors.foreground} />
            </AnimatedIconButton>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, gap: 16 }}>
          <View style={{ gap: 12 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Du
              </Text>
              <AnimatedPressable
                onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }}
                style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showStartPicker ? colors.primary : colors.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ fontSize: 14, color: startDate ? colors.foreground : colors.mutedForeground, fontWeight: startDate ? "700" : "400" }}>
                  {startDate ? startDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </AnimatedPressable>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    if (Platform.OS === "android") setShowStartPicker(false);
                    if (date) {
                      setStartDate(date);
                      if (endDate && endDate < date) setEndDate(null);
                    }
                  }}
                  themeVariant={isDark ? "dark" : "light"}
                  accentColor={colors.primary}
                />
              )}
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Au
              </Text>
              <AnimatedPressable
                onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }}
                style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showEndPicker ? colors.primary : colors.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ fontSize: 14, color: endDate ? colors.foreground : colors.mutedForeground, fontWeight: endDate ? "700" : "400" }}>
                  {endDate ? endDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </AnimatedPressable>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate ?? startDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={startDate ?? new Date()}
                  onChange={(_, date) => {
                    if (Platform.OS === "android") setShowEndPicker(false);
                    if (date) setEndDate(date);
                  }}
                  themeVariant={isDark ? "dark" : "light"}
                  accentColor={colors.primary}
                />
              )}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Raison (optionnel)
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Vacances, maladie…"
                placeholderTextColor={colors.mutedForeground}
                style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, fontSize: 14, color: colors.foreground, backgroundColor: colors.muted }}
              />
            </View>
          </View>

          {unavailabilities.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Absences planifiées ({unavailabilities.length})
              </Text>
              {unavailabilities
                .slice()
                .sort((a, b) => a.start_date.localeCompare(b.start_date))
                .map((u) => (
                <View key={u.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                      {new Date(u.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      {u.start_date !== u.end_date
                        ? ` → ${new Date(u.end_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                        : ` (${new Date(u.start_date + "T12:00:00").getFullYear()})`}
                    </Text>
                    {u.reason && <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{u.reason}</Text>}
                  </View>
                  <AnimatedIconButton
                    onPress={() => removeUnavailability(u.id)}
                    accessibilityLabel="Supprimer cette période d'absence"
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(colors.destructive, 0.10), alignItems: "center", justifyContent: "center", marginLeft: 8 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                  </AnimatedIconButton>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
          {error && <ErrorMessage message={error} />}
          <LoadingButton
            loading={saving}
            onPress={createUnavailability}
            disabled={!startDate || !endDate}
            label={!startDate || !endDate ? "Sélectionne les dates" : "Bloquer la période"}
            style={{ backgroundColor: (!startDate || !endDate) ? colors.disabled : colors.primary }}
          />
        </View>
      </View>
    </Modal>
  );
}
