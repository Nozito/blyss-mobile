import React, { useState } from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import RNDateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

interface DatePickerProps {
  label?: string;
  value: Date | undefined;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: string;
  hint?: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function DatePicker({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Sélectionner une date",
  error,
  hint,
}: DatePickerProps) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [open, setOpen] = useState(false);
  // Temp value while user scrolls on iOS (confirmed on "Valider")
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (date) onChange(date);
    } else {
      if (date) setTempDate(date);
    }
  };

  const handleConfirmIOS = () => {
    onChange(tempDate);
    setOpen(false);
  };

  return (
    <View className="gap-1.5">
      {label && (
        <Text className="text-sm font-medium" style={{ color: colors.foreground }}>{label}</Text>
      )}

      <AnimatedPressable
        onPress={() => {
          setTempDate(value ?? new Date());
          setOpen(true);
        }}
        accessibilityLabel={label ?? "Sélectionner une date"}
        className="flex-row items-center h-11 px-3 rounded-md border"
        style={{ backgroundColor: colors.background, borderColor: error ? colors.destructive : colors.border }}
      >
        <Ionicons
          name="calendar-outline"
          size={16}
          color={colors.mutedForeground}
          style={{ marginRight: 6 }}
        />
        <Text
          className="flex-1 text-base"
          style={{ color: value ? colors.foreground : colors.mutedForeground }}
        >
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
      </AnimatedPressable>

      {error && <Text className="text-xs" style={{ color: colors.destructive }}>{error}</Text>}
      {!error && hint && (
        <Text className="text-xs" style={{ color: colors.mutedForeground }}>{hint}</Text>
      )}

      {/* Android: picker renders inline as system modal */}
      {Platform.OS === "android" && open && (
        <RNDateTimePicker
          mode="date"
          value={value ?? new Date()}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS: bottom-sheet modal with confirm button */}
      {Platform.OS === "ios" && (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            className="flex-1 bg-black/40"
            onPress={() => setOpen(false)}
          />
          <View className="rounded-t-3xl px-4 pt-4 pb-8" style={{ backgroundColor: colors.card }}>
            {/* Modal header */}
            <View className="flex-row items-center justify-between mb-2">
              <AnimatedPressable onPress={() => setOpen(false)} className="p-2">
                <Text className="text-base" style={{ color: colors.mutedForeground }}>Annuler</Text>
              </AnimatedPressable>
              <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                {label ?? "Choisir une date"}
              </Text>
              <AnimatedPressable onPress={handleConfirmIOS} className="p-2">
                <Text className="text-base font-semibold" style={{ color: colors.primary }}>Valider</Text>
              </AnimatedPressable>
            </View>

            <RNDateTimePicker
              mode="date"
              display="spinner"
              value={tempDate}
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              locale="fr-FR"
              themeVariant={isDark ? "dark" : "light"}
              style={{ height: 200 }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}
