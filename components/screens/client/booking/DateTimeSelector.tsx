import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { toLocalDateStr } from "@/lib/bookingUtils";
import { formatDuration } from "@/lib/dateUtils";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export interface Slot {
  id: number;
  time: string;
  duration: number;
}

interface Props {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  availableDates: Set<string>;
  isLoadingDates: boolean;
  availableSlots: Slot[];
  isLoadingSlots: boolean;
  onMonthChange: (date: Date) => void;
}


function CalendarGrid({
  selectedDate,
  onSelectDate,
  availableDates,
  onMonthChange,
}: {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  availableDates: Set<string>;
  onMonthChange: (date: Date) => void;
}) {
  const colors = useThemeColors();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const screenWidth = Dimensions.get("window").width;
  // Screen paddingH: 20, card paddingH: 20 → 80 total → available = screenWidth - 80
  const calendarWidth = screenWidth - 80;
  const cellSize = Math.floor(calendarWidth / 7);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isFirstDayOfCurrentMonth = () => {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfCurrent = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return firstOfCurrent <= firstOfMonth;
  };

  const goToPrev = () => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    setCurrentMonth(prev);
    onMonthChange(prev);
  };

  const goToNext = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    setCurrentMonth(next);
    onMonthChange(next);
  };

  const getDays = (): (Date | null)[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= lastDate; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const isSelected = (date: Date) =>
    selectedDate !== null &&
    date.getDate() === selectedDate.getDate() &&
    date.getMonth() === selectedDate.getMonth() &&
    date.getFullYear() === selectedDate.getFullYear();

  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isPast = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  // Salon fermé le dimanche — non réservable côté cliente, quelle que soit
  // la donnée renvoyée par l'API (même règle que le calendrier pro, qui
  // exclut déjà le dimanche de sa propre grille).
  const isSunday = (date: Date) => date.getDay() === 0;

  const days = getDays();

  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 20,
        ...Shadows.card,
      }}
    >
      {/* Month header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <AnimatedIconButton
          onPress={goToPrev}
          disabled={isFirstDayOfCurrentMonth()}
          accessibilityLabel="Mois précédent"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.cream,
            alignItems: "center",
            justifyContent: "center",
            opacity: isFirstDayOfCurrentMonth() ? 0.3 : 1,
          }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.foreground} />
        </AnimatedIconButton>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <AnimatedIconButton
          onPress={goToNext}
          accessibilityLabel="Mois suivant"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.cream,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
        </AnimatedIconButton>
      </View>

      {/* Day names */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {DAY_NAMES.map((d) => (
          <View key={d} style={{ width: cellSize, alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Days grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((date, i) => {
          if (!date) {
            return <View key={`e-${i}`} style={{ width: cellSize, height: cellSize + 12 }} />;
          }

          const past = isPast(date);
          const sunday = isSunday(date);
          const available = !sunday && availableDates.has(toLocalDateStr(date));
          const selected = isSelected(date);
          const today_ = isToday(date);
          const selectable = !past && available;

          return (
            <View key={date.toISOString()} style={{ width: cellSize, alignItems: "center", marginBottom: 4 }}>
              <AnimatedPressable
                onPress={() => selectable && onSelectDate(new Date(date))}
                disabled={!selectable}
                style={{
                  width: cellSize - 4,
                  height: cellSize - 4,
                  borderRadius: (cellSize - 4) / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected
                    ? colors.primary
                    : today_ && !selected
                    ? "transparent"
                    : "transparent",
                  borderWidth: today_ && !selected ? 2 : 0,
                  borderColor: today_ && !selected ? colors.primary : "transparent",
                  opacity: past || (!past && !available) ? 0.3 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: selected ? colors.white : past ? colors.mutedForeground : colors.foreground,
                  }}
                >
                  {date.getDate()}
                </Text>
              </AnimatedPressable>
              {/* Availability dot */}
              {available && !selected && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.primary,
                    marginTop: 2,
                  }}
                />
              )}
              {(!available || selected) && <View style={{ height: 6 }} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DateTimeSelector({
  selectedDate,
  onSelectDate,
  selectedTime,
  onSelectTime,
  availableDates,
  isLoadingDates,
  availableSlots,
  isLoadingSlots,
  onMonthChange,
}: Props) {
  const colors = useThemeColors();
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingBottom: 24, gap: 20 }}>
        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
            Quand ?
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>
            Choisis la date et l'horaire qui t'arrangent
          </Text>
        </View>

        {/* Calendar */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Date</Text>
          </View>
          <CalendarGrid
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            availableDates={availableDates}
            onMonthChange={onMonthChange}
          />
          {/* Sans ce message, un mois sans aucun créneau publié affichait un
              calendrier entièrement grisé sans aucune explication — la
              cliente ne pouvait rien sélectionner et ne savait pas pourquoi. */}
          {!isLoadingDates && availableDates.size === 0 && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: colors.cream, borderRadius: 14, padding: 14,
            }}>
              <Ionicons name="calendar-clear-outline" size={18} color={colors.mutedForeground} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
                Aucun créneau publié ce mois-ci pour cette pro. Essaie un autre mois ou reviens un peu plus tard.
              </Text>
            </View>
          )}
        </View>

        {/* Time slots */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Horaire</Text>
          </View>

          {isLoadingSlots ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : availableSlots.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 32,
                backgroundColor: colors.white,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                {selectedDate
                  ? "Aucun créneau disponible pour cette date"
                  : "Sélectionne d'abord une date"}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {availableSlots.map((slot) => {
                const active = selectedTime === slot.time;
                return (
                  <AnimatedPressable
                    key={slot.id}
                    onPress={() => onSelectTime(slot.time)}
                    style={{
                      width: "47%",
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      alignItems: "center",
                      gap: 2,
                      backgroundColor: active ? colors.primary : colors.white,
                      borderWidth: active ? 0 : 1,
                      borderColor: colors.border,
                      ...(active ? Shadows.soft : Shadows.card),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: "800",
                        lineHeight: 20,
                        color: active ? colors.white : colors.foreground,
                      }}
                    >
                      {slot.time}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "500",
                        color: active ? withAlpha(colors.onColor, 0.7) : colors.mutedForeground,
                      }}
                    >
                      {formatDuration(slot.duration)}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
