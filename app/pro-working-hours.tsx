import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { proApi, type WorkingHoursDay, type WorkingHoursRange } from "@/lib/api";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { safeBack } from "@/lib/navigation";
import {
  WORKING_HOURS_DAY_LABELS as DAY_LABELS,
  WORKING_HOURS_DAY_ORDER as DAY_ORDER,
  WORKING_HOURS_TIMES as TIMES,
  timeToMinutes as toMin,
  validateWorkingHours as validateDays,
  emptyWorkingWeek as emptyWeek,
} from "@/lib/workingHours";

// NOTE: route top-level (et non app/(pro)/settings/working-hours) car
// (pro)/_layout.tsx est un NativeTabs qui ne gère pas les sous-dossiers.
// Même pattern que pro-subscription. Navigable via router.push("/pro-working-hours").
export default function ProWorkingHoursScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["working-hours"],
    queryFn: async () => {
      const res = await proApi.getWorkingHours();
      if (!res.success || !res.data) throw new Error(res.error ?? "Chargement impossible");
      return res.data.days;
    },
  });

  const [week, setWeek] = useState<WorkingHoursDay[]>(emptyWeek());
  const [error, setError] = useState<string | null>(null);
  // Édition d'une plage : { weekday, index (-1 = nouvelle) }
  const [editing, setEditing] = useState<{ weekday: number; index: number } | null>(null);
  const [draft, setDraft] = useState<WorkingHoursRange>({ start_time: "09:00", end_time: "18:00" });

  useEffect(() => {
    if (!data) return;
    const byWeekday = new Map(data.map((d) => [d.weekday, d.ranges]));
    setWeek(DAY_ORDER.map((weekday) => ({ weekday, ranges: byWeekday.get(weekday) ?? [] })));
  }, [data]);

  const dayOf = (weekday: number) => week.find((d) => d.weekday === weekday)!;

  const setRanges = (weekday: number, ranges: WorkingHoursRange[]) => {
    setError(null);
    setWeek((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, ranges: [...ranges].sort((a, b) => toMin(a.start_time) - toMin(b.start_time)) }
          : d
      )
    );
  };

  const openEditor = (weekday: number, index: number) => {
    const existing = index >= 0 ? dayOf(weekday).ranges[index] : { start_time: "09:00", end_time: "18:00" };
    setDraft(existing);
    setEditing({ weekday, index });
  };

  const commitEditor = () => {
    if (!editing) return;
    if (toMin(draft.end_time) <= toMin(draft.start_time)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const day = dayOf(editing.weekday);
    const next = [...day.ranges];
    if (editing.index >= 0) next[editing.index] = draft;
    else next.push(draft);
    setRanges(editing.weekday, next);
    setEditing(null);
  };

  const removeRange = (weekday: number, index: number) => {
    setRanges(weekday, dayOf(weekday).ranges.filter((_, i) => i !== index));
  };

  const copyMondayToAll = () => {
    const monday = dayOf(1).ranges;
    setError(null);
    setWeek((prev) => prev.map((d) => (d.weekday === 0 ? d : { ...d, ranges: monday.map((r) => ({ ...r })) })));
    showToast("Lundi copié sur mardi → samedi", "success");
  };

  const totalRanges = useMemo(() => week.reduce((n, d) => n + d.ranges.length, 0), [week]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const v = validateDays(week);
      if (v) throw new Error(v);
      const res = await proApi.setWorkingHours(week);
      if (!res.success) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["working-hours"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
      showToast(
        res.migrated
          ? "Horaires enregistrés — le nouveau moteur de disponibilités est activé"
          : "Horaires enregistrés",
        "success"
      );
      safeBack(router, "/(pro)/calendar");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Horaires d'ouverture</Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
            Tes créneaux réservables en découlent automatiquement.
          </Text>
        </View>
        <AnimatedIconButton
          onPress={() => safeBack(router, "/(pro)/calendar")}
          accessibilityLabel="Fermer"
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={18} color={colors.foreground} />
        </AnimatedIconButton>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
          {DAY_ORDER.map((weekday) => {
            const day = dayOf(weekday);
            const open = day.ranges.length > 0;
            return (
              <View key={weekday} style={{ backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: open ? colors.primary : colors.border }} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{DAY_LABELS[weekday]}</Text>
                  </View>
                  {!open && (
                    <AnimatedPressable
                      onPress={() => setRanges(weekday, [{ start_time: "09:00", end_time: "18:00" }])}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Ouvrir</Text>
                    </AnimatedPressable>
                  )}
                </View>

                {!open ? (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 6 }}>Fermé</Text>
                ) : (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {day.ranges.map((r, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <AnimatedPressable
                          onPress={() => openEditor(weekday, i)}
                          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                        >
                          <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                            {r.start_time} – {r.end_time}
                          </Text>
                        </AnimatedPressable>
                        <AnimatedIconButton
                          onPress={() => removeRange(weekday, i)}
                          accessibilityLabel="Retirer la plage"
                          style={{ width: 34, height: 34, borderRadius: 9, marginLeft: 8, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.destructive, 0.1) }}
                        >
                          <Ionicons name="close" size={15} color={colors.destructive} />
                        </AnimatedIconButton>
                      </View>
                    ))}
                    <AnimatedPressable
                      onPress={() => openEditor(weekday, -1)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
                    >
                      <Ionicons name="add" size={15} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Ajouter une plage</Text>
                    </AnimatedPressable>
                  </View>
                )}
              </View>
            );
          })}

          <AnimatedPressable
            onPress={copyMondayToAll}
            disabled={dayOf(1).ranges.length === 0}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, opacity: dayOf(1).ranges.length === 0 ? 0.4 : 1 }}
          >
            <Ionicons name="copy-outline" size={16} color={colors.foreground} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Copier lundi → mardi-samedi</Text>
          </AnimatedPressable>

          {error && <ErrorMessage message={error} />}

          <LoadingButton
            loading={saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
            label={totalRanges === 0 ? "Enregistrer (aucun horaire)" : "Enregistrer"}
          />
        </ScrollView>
      )}

      <Modal visible={editing !== null} onClose={() => setEditing(null)} bottomSheet noPadding maxHeight="70%">
        <View style={{ padding: 24, gap: 18 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center" }} />
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>
            {editing && editing.index >= 0 ? "Modifier la plage" : "Nouvelle plage"}
            {editing ? ` · ${DAY_LABELS[editing.weekday]}` : ""}
          </Text>

          {(["start_time", "end_time"] as const).map((field) => (
            <View key={field} style={{ gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6 }}>
                {field === "start_time" ? "Début" : "Fin"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {TIMES.map((t) => {
                    const active = draft[field] === t;
                    return (
                      <AnimatedPressable
                        key={t}
                        onPress={() => setDraft((d) => ({ ...d, [field]: t }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: active ? colors.primary : colors.muted }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.onColor : colors.foreground }}>{t}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ))}

          <LoadingButton loading={false} onPress={commitEditor} label="Valider la plage" />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
