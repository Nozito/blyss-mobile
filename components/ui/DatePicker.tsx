import React, { useState } from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import RNDateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

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
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      )}

      <Pressable
        onPress={() => {
          setTempDate(value ?? new Date());
          setOpen(true);
        }}
        accessibilityLabel={label ?? "Sélectionner une date"}
        className={[
          "flex-row items-center h-10 px-3 bg-background rounded-md border",
          error ? "border-destructive" : "border-input",
        ].join(" ")}
      >
        <Ionicons
          name="calendar-outline"
          size={16}
          color={Colors.mutedForeground}
          style={{ marginRight: 6 }}
        />
        <Text
          className={`flex-1 text-base ${value ? "text-foreground" : "text-muted-foreground"}`}
        >
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.mutedForeground} />
      </Pressable>

      {error && <Text className="text-xs text-destructive">{error}</Text>}
      {!error && hint && (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
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
          <View className="bg-card rounded-t-3xl px-4 pt-4 pb-8">
            {/* Modal header */}
            <View className="flex-row items-center justify-between mb-2">
              <Pressable onPress={() => setOpen(false)} className="p-2">
                <Text className="text-base text-muted-foreground">Annuler</Text>
              </Pressable>
              <Text className="text-base font-semibold text-foreground">
                {label ?? "Choisir une date"}
              </Text>
              <Pressable onPress={handleConfirmIOS} className="p-2">
                <Text className="text-base font-semibold text-primary">Valider</Text>
              </Pressable>
            </View>

            <RNDateTimePicker
              mode="date"
              display="spinner"
              value={tempDate}
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              locale="fr-FR"
              style={{ height: 200 }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}
