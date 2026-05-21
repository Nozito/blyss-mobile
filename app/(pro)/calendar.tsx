import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal as RNModal,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { proApi, nailTechApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type TimeSlot = {
  id: string;
  time: string;
  duration: number;
  isActive: boolean;
  isAvailable: boolean;
  isPast: boolean;
};

type Appointment = {
  id: number;
  date: string;
  time: string;
  duration: number | string;
  status: string;
  client_name?: string;
  client_first_name?: string;
  client_last_name?: string;
  prestation_name?: string;
  price?: number;
};

type Unavailability = {
  id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

const toLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseDuration = (v: unknown): number => {
  if (typeof v === "number") return Math.abs(v);
  if (typeof v === "string") return Math.abs(parseInt(v.replace(/[^\d-]/g, ""), 10)) || 0;
  return 0;
};

const formatDuration = (min: number): string => {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${m}` : `${h}h`;
  }
  return `${min}min`;
};

const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const checkOverlap = (slots: TimeSlot[], time: string, duration: number, excludeId?: string) => {
  const s = timeToMin(time);
  const e = s + duration;
  for (const slot of slots) {
    if (excludeId && slot.id === excludeId) continue;
    if (slot.isPast) continue;
    const ss = timeToMin(slot.time);
    const se = ss + parseDuration(slot.duration);
    if ((s >= ss && s < se) || (e > ss && e <= se) || (s <= ss && e >= se)) return true;
  }
  return false;
};

const canCreate = (date: string, time: string) =>
  new Date(`${date}T${time}:00`) > new Date();

const mapSlot = (s: Record<string, unknown>): TimeSlot => ({
  id: String(s.id),
  time: String(s.time),
  duration: parseDuration(s.duration),
  isActive: Boolean(s.is_active ?? s.isActive),
  isAvailable: Boolean(s.is_available ?? s.isAvailable),
  isPast: s.computed_status === "past" || Boolean(s.is_past),
});

const QUICK_TIMES = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00","19:00",
];

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  completed: { label: "Terminé",    color: "#16A34A", bg: "rgba(22,163,74,0.12)",  icon: "checkmark-circle-outline" },
  cancelled:  { label: "Annulé",    color: "#EF4444", bg: "rgba(239,68,68,0.12)",  icon: "close-circle-outline" },
  pending:    { label: "À venir",   color: "#F59E0B", bg: "rgba(245,158,11,0.12)", icon: "time-outline" },
  ongoing:    { label: "En cours",  color: "#3B82F6", bg: "rgba(59,130,246,0.12)", icon: "radio-button-on-outline" },
  past_pending: { label: "À valider", color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", icon: "alert-circle-outline" },
  no_show:    { label: "Absent",    color: "#EF4444", bg: "rgba(239,68,68,0.12)",  icon: "person-remove-outline" },
};

function getAptStatus(apt: Appointment): string {
  if (apt.status === "completed") return "completed";
  if (apt.status === "cancelled" || apt.status === "no_show") return apt.status;
  const now = new Date();
  const aptDate = new Date(apt.date);
  const [h, m] = String(apt.time).split(":");
  aptDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  const diffMin = (aptDate.getTime() - now.getTime()) / 60000;
  const dur = parseDuration(apt.duration);
  if (diffMin > 0) return "pending";
  if (diffMin <= 0 && diffMin >= -dur) return "ongoing";
  return "past_pending";
}

// ─── CALENDAR GRID ───────────────────────────────────────────────────────────

const CELL_SIZE = (Dimensions.get("window").width - 40 - 12) / 7;

function CalendarGrid({
  currentDate,
  selectedDate,
  appointments,
  unavailabilities,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onToday,
}: {
  currentDate: Date;
  selectedDate: Date;
  appointments: Appointment[];
  unavailabilities: Unavailability[];
  onSelectDay: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = Array(startOffset).fill(null);
    for (let i = 1; i <= total; i++) arr.push(i);
    return arr;
  }, [year, month]);

  const hasApt = useCallback(
    (day: number) => {
      const key = toLocalDate(new Date(year, month, day));
      return appointments.some((a) => toLocalDate(new Date(a.date)) === key);
    },
    [appointments, year, month]
  );

  const isUnavail = useCallback(
    (day: number) => {
      const key = toLocalDate(new Date(year, month, day));
      return unavailabilities.some((u) => key >= u.start_date && key <= u.end_date);
    },
    [unavailabilities, year, month]
  );

  const today = new Date();

  return (
    <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <AnimatedIconButton onPress={onPrevMonth} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={18} color={Colors.foreground} />
        </AnimatedIconButton>
        <Pressable onPress={onToday}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground }}>
            {MONTHS[month]} {year}
          </Text>
        </Pressable>
        <AnimatedIconButton onPress={onNextMonth} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-forward" size={18} color={Colors.foreground} />
        </AnimatedIconButton>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {DAYS_SHORT.map((d) => (
          <View key={d} style={{ width: CELL_SIZE, alignItems: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day, i) => {
          if (!day) return <View key={`empty-${i}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;

          const thisDate = new Date(year, month, day);
          const isSel = toLocalDate(thisDate) === toLocalDate(selectedDate);
          const isTod = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasA = hasApt(day);
          const isU = isUnavail(day);

          return (
            <Pressable
              key={day}
              onPress={() => onSelectDay(thisDate)}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: isSel ? Colors.primary : isU ? "#FEF2F2" : "transparent",
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: isSel || isTod ? "800" : "500",
                color: isSel ? "#fff" : isTod ? Colors.primary : isU ? "#EF4444" : Colors.foreground,
              }}>
                {day}
              </Text>
              {hasA && !isSel && (
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isTod ? Colors.primary : Colors.mutedForeground, marginTop: 1 }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function ProCalendarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Modals
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [showUnavailModal, setShowUnavailModal] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);

  // Add slot form
  const [newSlotTime, setNewSlotTime] = useState("09:00");
  const [newSlotDuration, setNewSlotDuration] = useState(60);

  // Edit slot
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("09:00");
  const [editDur, setEditDur] = useState(60);

  // Unavailability form
  const [unavailStartDate, setUnavailStartDate] = useState<Date | null>(null);
  const [unavailEndDate, setUnavailEndDate] = useState<Date | null>(null);
  const [unavailReason, setUnavailReason] = useState("");
  const [unavailSaving, setUnavailSaving] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Weekly planning
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [planningSlots, setPlanningSlots] = useState<string[]>(["09:00", "14:00"]);
  const [weeklyPlanSaving, setWeeklyPlanSaving] = useState(false);
  const [weeklyPlanSuccess, setWeeklyPlanSuccess] = useState(false);
  const [showPlanTimePicker, setShowPlanTimePicker] = useState(false);
  const [newPlanTime, setNewPlanTime] = useState(new Date());

  // View mode
  type ViewMode = "month" | "week" | "list";
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showViewPicker, setShowViewPicker] = useState(false);

  // ── data fetching
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = toLocalDate(selectedDate);
      const month = selectedDate.getMonth();
      const year = selectedDate.getFullYear();
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const to = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

      const [calRes, slotRes, unavailRes] = await Promise.all([
        proApi.getCalendar({ from, to }),
        proApi.getSlots({ date: dateStr }),
        proApi.getUnavailabilities(),
      ]);

      if (calRes.success && calRes.data) setAppointments(calRes.data as Appointment[]);
      if (slotRes.success && slotRes.data) setSlots((slotRes.data as Record<string, unknown>[]).map(mapSlot));
      if (unavailRes.success && unavailRes.data) setUnavailabilities(unavailRes.data as Unavailability[]);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await proApi.getSlots({ date: toLocalDate(selectedDate) });
      if (res.success && res.data) setSlots((res.data as Record<string, unknown>[]).map(mapSlot));
    } catch {
      // silent
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleSelectDate = (d: Date) => {
    setSelectedDate(d);
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // ── filtered appointments for selected day
  const dayAppointments = useMemo(() => {
    let list = appointments.filter(
      (a) => toLocalDate(new Date(a.date)) === toLocalDate(selectedDate)
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          (a.client_name ?? `${a.client_first_name ?? ""} ${a.client_last_name ?? ""}`).toLowerCase().includes(q) ||
          (a.prestation_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [appointments, selectedDate, searchQuery]);

  // ── slot actions
  const toggleSlot = async (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot || slot.isPast || !slot.isAvailable) return;
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !s.isActive } : s));
    try {
      await proApi.updateSlot(parseInt(id), { status: slot.isActive ? "blocked" : "available" });
    } catch {
      setSlots((prev) => prev.map((s) => s.id === id ? { ...s, isActive: slot.isActive } : s));
      Alert.alert("Erreur", "Impossible de mettre à jour le créneau");
    }
  };

  const addSlot = async () => {
    const date = toLocalDate(selectedDate);
    if (!canCreate(date, newSlotTime)) {
      Alert.alert("Erreur", "Impossible de créer un créneau dans le passé");
      return;
    }
    if (checkOverlap(slots, newSlotTime, newSlotDuration)) {
      Alert.alert("Erreur", "Ce créneau chevauche un créneau existant");
      return;
    }
    try {
      await proApi.createSlot({ date, start_time: newSlotTime, duration: newSlotDuration } as any);
      await fetchSlots();
      setShowAddSlot(false);
    } catch {
      Alert.alert("Erreur", "Impossible d'ajouter le créneau");
    }
  };

  const confirmEditSlot = async () => {
    if (!editingSlotId) return;
    const date = toLocalDate(selectedDate);
    if (!canCreate(date, editTime)) {
      Alert.alert("Erreur", "Heure déjà passée");
      return;
    }
    if (checkOverlap(slots, editTime, editDur, editingSlotId)) {
      Alert.alert("Erreur", "Chevauchement avec un autre créneau");
      return;
    }
    setEditingSlotId(null);
    try {
      await proApi.updateSlot(parseInt(editingSlotId), { date, time: editTime, duration: editDur });
      await fetchSlots();
    } catch {
      Alert.alert("Erreur", "Impossible de modifier le créneau");
    }
  };

  const deleteSlot = async (id: string) => {
    const backup = [...slots];
    setSlots((prev) => prev.filter((s) => s.id !== id));
    try {
      await proApi.deleteSlot(parseInt(id));
    } catch {
      setSlots(backup);
      Alert.alert("Erreur", "Impossible de supprimer le créneau");
    }
  };

  // ── appointment actions
  const handleComplete = async (apt: Appointment) => {
    setSelectedApt(null);
    setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "completed" } : a));
    try {
      await proApi.updateReservationStatus(apt.id, "completed");
    } catch {
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: apt.status } : a));
    }
  };

  const handleCancel = async (apt: Appointment) => {
    setSelectedApt(null);
    setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "cancelled" } : a));
    try {
      await proApi.updateReservationStatus(apt.id, "cancelled");
    } catch {
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: apt.status } : a));
    }
  };

  const handleNoShow = async (apt: Appointment) => {
    setSelectedApt(null);
    setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "no_show" } : a));
    try {
      await nailTechApi.markNoShow(apt.id);
    } catch {
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: apt.status } : a));
    }
  };

  // ── unavailability actions
  const createUnavailability = async () => {
    if (!unavailStartDate || !unavailEndDate) {
      Alert.alert("Erreur", "Sélectionne une période");
      return;
    }
    const startStr = toLocalDate(unavailStartDate);
    const endStr = toLocalDate(unavailEndDate);
    if (endStr < startStr) {
      Alert.alert("Erreur", "La date de fin doit être après le début");
      return;
    }
    setUnavailSaving(true);
    try {
      await proApi.createUnavailability({ start_date: startStr, end_date: endStr, reason: unavailReason || undefined });
      const res = await proApi.getUnavailabilities();
      if (res.success && res.data) setUnavailabilities(res.data as Unavailability[]);
      setUnavailStartDate(null); setUnavailEndDate(null); setUnavailReason("");
      setShowUnavailModal(false);
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer la période");
    } finally {
      setUnavailSaving(false);
    }
  };

  // ── weekly planning
  const applyWeeklyPlanning = async () => {
    setWeeklyPlanSaving(true);
    try {
      await (proApi as any).applyWeeklyTemplate({
        days: activeDays,
        slots: planningSlots.map((t) => ({ time: t })),
      });
      setWeeklyPlanSuccess(true);
      setTimeout(() => setWeeklyPlanSuccess(false), 2500);
    } catch {
      Alert.alert("Erreur", "Impossible d'appliquer le planning");
    } finally {
      setWeeklyPlanSaving(false);
    }
  };

  const removeUnavailability = async (id: number) => {
    const backup = [...unavailabilities];
    setUnavailabilities((prev) => prev.filter((u) => u.id !== id));
    try {
      await proApi.deleteUnavailability(id);
    } catch {
      setUnavailabilities(backup);
    }
  };

  // ── selected apt status
  const aptStatusKey = selectedApt ? getAptStatus(selectedApt) : "pending";
  const aptStatusCfg = STATUS_CFG[aptStatusKey] ?? STATUS_CFG.pending;

  const selectedDateLabel = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      {/* ── HEADER ── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
              Agenda
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 1, textTransform: "capitalize" }}>
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setIsSearchOpen((v) => !v)}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", ...Shadows.card }}
            >
              <Ionicons name={isSearchOpen ? "close" : "search-outline"} size={18} color={Colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => setShowViewPicker(true)}
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: viewMode !== "month" ? Colors.primary : "#FFFFFF",
                alignItems: "center", justifyContent: "center",
                ...Shadows.card,
              }}
            >
              <Ionicons
                name={
                  viewMode === "month" ? "calendar-outline"
                  : viewMode === "week" ? "grid-outline"
                  : "list-outline"
                }
                size={18}
                color={viewMode !== "month" ? "#fff" : Colors.foreground}
              />
            </Pressable>
          </View>
        </View>

        {isSearchOpen && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 14, height: 44, ...Shadows.card, marginTop: 8 }}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher une cliente, une prestation…"
              placeholderTextColor={Colors.mutedForeground}
              style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
              autoFocus
            />
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
      >
        {/* ── CALENDAR GRID ── */}
        {viewMode === "month" && (
          <CalendarGrid
            currentDate={currentDate}
            selectedDate={selectedDate}
            appointments={appointments}
            unavailabilities={unavailabilities}
            onSelectDay={handleSelectDate}
            onPrevMonth={() => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
            onNextMonth={() => setCurrentDate((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
            onToday={() => {
              const t = new Date();
              setSelectedDate(t);
              setCurrentDate(new Date(t.getFullYear(), t.getMonth(), 1));
            }}
          />
        )}

        {viewMode === "week" && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
            {/* Header semaine : flèches + label plage */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <AnimatedIconButton
                onPress={() => {
                  const p = new Date(selectedDate);
                  p.setDate(p.getDate() - 7);
                  handleSelectDate(p);
                }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chevron-back" size={18} color={Colors.foreground} />
              </AnimatedIconButton>
              <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.foreground }}>
                {(() => {
                  const mon = new Date(selectedDate);
                  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
                  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
                  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                  return `${fmt(mon)} – ${fmt(sun)}`;
                })()}
              </Text>
              <AnimatedIconButton
                onPress={() => {
                  const n = new Date(selectedDate);
                  n.setDate(n.getDate() + 7);
                  handleSelectDate(n);
                }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chevron-forward" size={18} color={Colors.foreground} />
              </AnimatedIconButton>
            </View>

            {/* 7 colonnes jours */}
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: 7 }, (_, i) => {
                const base = new Date(selectedDate);
                base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + i);
                const isActive = toLocalDate(base) === toLocalDate(selectedDate);
                const isToday  = toLocalDate(base) === toLocalDate(new Date());
                const hasApt   = appointments.some(a => toLocalDate(new Date(a.date)) === toLocalDate(base));
                return (
                  <Pressable
                    key={i}
                    onPress={() => handleSelectDate(new Date(base))}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14,
                      backgroundColor: isActive ? Colors.primary : isToday ? "rgba(254,93,157,0.1)" : "transparent" }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "700", color: isActive ? "#fff" : Colors.mutedForeground,
                      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      {["L","M","M","J","V","S","D"][i]}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800",
                      color: isActive ? "#fff" : isToday ? Colors.primary : Colors.foreground }}>
                      {base.getDate()}
                    </Text>
                    {hasApt && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3,
                        backgroundColor: isActive ? "#fff" : Colors.primary }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {viewMode === "list" && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.foreground }}>
              {selectedDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).replace(/^\w/, c => c.toUpperCase())}
            </Text>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2 }}>
              Vue liste — navigue via le header de l'agenda
            </Text>
          </View>
        )}

        {/* ── PLANNING & ABSENCES CARDS ── */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <Pressable
            onPress={() => setShowPlanningModal(true)}
            style={{ flex: 1, backgroundColor: "#F0FDF4", borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: "#BBF7D0" }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#16A34A20", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-number-outline" size={20} color="#16A34A" />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#15803D" }}>Planning</Text>
            <Text style={{ fontSize: 11, color: "#16A34A", lineHeight: 15 }}>Semaine type & horaires</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowUnavailModal(true)}
            style={{ flex: 1, backgroundColor: "#FFF7ED", borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: "#FED7AA" }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F59E0B20", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="moon-outline" size={20} color="#D97706" />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#B45309" }}>Absences</Text>
            <Text style={{ fontSize: 11, color: "#D97706", lineHeight: 15 }}>Congés & indisponibilités</Text>
          </Pressable>
        </View>

        {/* ── SELECTED DAY LABEL ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingHorizontal: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 4, height: 20, backgroundColor: Colors.primary, borderRadius: 2 }} />
            <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.foreground, textTransform: "capitalize" }}>
              {selectedDateLabel}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowAddSlot(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Créneau</Text>
          </Pressable>
        </View>

        {/* ── SLOTS ── */}
        {slotsLoading ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : slots.length === 0 ? (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, marginBottom: 16, gap: 6 }}>
            <Ionicons name="time-outline" size={36} color="#D1D5DB" />
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>Aucun créneau ce jour</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>Appuie sur « + Créneau » pour en ajouter</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", ...Shadows.card, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
              Créneaux ({slots.length})
            </Text>
            {slots.map((slot, i) => {
              const isBooked = !slot.isAvailable && !slot.isPast;
              const isOpen = slot.isAvailable && slot.isActive && !slot.isPast;
              const isEditing = editingSlotId === slot.id;
              const endMin = timeToMin(slot.time) + parseDuration(slot.duration);
              const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

              return (
                <View key={slot.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: Colors.border, marginHorizontal: 16 }} />}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isEditing ? "rgba(254,93,157,0.05)" : undefined }}>
                    {isEditing ? (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              {QUICK_TIMES.map((t) => (
                                <Pressable
                                  key={t}
                                  onPress={() => setEditTime(t)}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 10,
                                    backgroundColor: editTime === t ? Colors.primary : "#F8F5F1",
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: "600", color: editTime === t ? "#fff" : Colors.foreground }}>
                                    {t}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {[30, 45, 60, 90, 120].map((d) => (
                            <Pressable
                              key={d}
                              onPress={() => setEditDur(d)}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: editDur === d ? Colors.primary : "#F8F5F1" }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "600", color: editDur === d ? "#fff" : Colors.foreground }}>
                                {formatDuration(d)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => setEditingSlotId(null)}
                            style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
                          </Pressable>
                          <Pressable
                            onPress={confirmEditSlot}
                            style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Confirmer</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: slot.isPast ? Colors.border : isBooked ? "#3B82F6" : isOpen ? Colors.primary : Colors.mutedForeground,
                          }} />
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: slot.isPast ? Colors.mutedForeground : Colors.foreground }}>
                              {slot.time} – {endTime}
                            </Text>
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>
                              {formatDuration(parseDuration(slot.duration))}
                              {" · "}
                              <Text style={{ color: isBooked ? "#3B82F6" : isOpen ? Colors.primary : Colors.mutedForeground }}>
                                {slot.isPast ? "Passé" : isBooked ? "Réservé" : isOpen ? "Ouvert" : "Bloqué"}
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {!slot.isPast && !isBooked && (
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <Pressable
                              onPress={() => toggleSlot(slot.id)}
                              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isOpen ? "rgba(254,93,157,0.1)" : "#F8F5F1", alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name={isOpen ? "lock-open-outline" : "lock-closed-outline"} size={16} color={isOpen ? Colors.primary : Colors.mutedForeground} />
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                setEditTime(slot.time);
                                setEditDur(parseDuration(slot.duration));
                                setEditingSlotId(slot.id);
                              }}
                              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name="pencil-outline" size={16} color={Colors.mutedForeground} />
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                Alert.alert("Supprimer", "Supprimer ce créneau ?", [
                                  { text: "Annuler", style: "cancel" },
                                  { text: "Supprimer", style: "destructive", onPress: () => deleteSlot(slot.id) },
                                ])
                              }
                              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── APPOINTMENTS ── */}
        <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingHorizontal: 2 }}>
          Rendez-vous ({dayAppointments.length})
        </Text>

        {loading ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : dayAppointments.length === 0 ? (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, gap: 6 }}>
            <Ionicons name="calendar-outline" size={36} color="#D1D5DB" />
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>
              Aucun rendez-vous
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>
              Tes clientes pourront réserver via les créneaux ouverts
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {dayAppointments.map((apt) => {
              const statusKey = getAptStatus(apt);
              const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.pending;
              const clientName =
                apt.client_name ?? `${apt.client_first_name ?? ""} ${apt.client_last_name ?? ""}`.trim();
              const canAct = ["pending", "ongoing", "past_pending"].includes(statusKey);

              return (
                <Pressable
                  key={apt.id}
                  onPress={() => canAct && setSelectedApt(apt)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 16,
                    padding: 16,
                    ...Shadows.card,
                    borderLeftWidth: 3,
                    borderLeftColor: cfg.color,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.primary }}>
                      {apt.time}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: cfg.bg }}>
                      <Ionicons name={cfg.icon as React.ComponentProps<typeof Ionicons>["name"]} size={12} color={cfg.color} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>{clientName}</Text>
                  {apt.prestation_name && (
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>{apt.prestation_name}</Text>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color={Colors.mutedForeground} />
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                        {formatDuration(parseDuration(apt.duration))}
                      </Text>
                    </View>
                    {apt.price != null && (
                      <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.primary }}>
                        {Number(apt.price).toFixed(2).replace(".", ",")} €
                      </Text>
                    )}
                  </View>
                  {canAct && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                      <Ionicons name="ellipsis-horizontal" size={14} color={Colors.mutedForeground} />
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Appuie pour gérer</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── VIEW PICKER MODAL ── */}
      <RNModal visible={showViewPicker} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowViewPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} onPress={() => setShowViewPicker(false)} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: "#fff",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 16,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB",
            alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground,
            textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 24, marginBottom: 8 }}>
            Vue de l'agenda
          </Text>

          {([
            { key: "month", icon: "calendar-outline",  label: "Mois",    sub: "Calendrier mensuel"  },
            { key: "week",  icon: "grid-outline",       label: "Semaine", sub: "7 jours glissants"   },
            { key: "list",  icon: "list-outline",       label: "Liste",   sub: "Créneaux du jour"    },
          ] as const).map(({ key, icon, label, sub }) => (
            <Pressable
              key={key}
              onPress={() => { setViewMode(key); setShowViewPicker(false); }}
              style={{
                flexDirection: "row", alignItems: "center", gap: 14,
                paddingHorizontal: 24, paddingVertical: 14,
                backgroundColor: viewMode === key ? "rgba(254,93,157,0.06)" : "transparent",
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: viewMode === key ? Colors.primary : "#F8F5F1",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name={icon} size={20} color={viewMode === key ? "#fff" : Colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>{label}</Text>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 1 }}>{sub}</Text>
              </View>
              {viewMode === key && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              )}
            </Pressable>
          ))}
        </View>
      </RNModal>

      {/* ── ADD SLOT MODAL ── */}
      <RNModal visible={showAddSlot} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowAddSlot(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} onPress={() => setShowAddSlot(false)} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: "#fff",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 16,
          maxHeight: "85%",
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 8 }} />

          <View style={{ paddingHorizontal: 24, gap: 20, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>
                  Ajouter un créneau
                </Text>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                  {selectedDateLabel} · {slots.length} créneau{slots.length !== 1 ? "x" : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowAddSlot(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={Colors.foreground} />
              </Pressable>
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Heure
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {QUICK_TIMES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setNewSlotTime(t)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                        backgroundColor: newSlotTime === t ? Colors.primary : "#F8F5F1",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: newSlotTime === t ? "#fff" : Colors.foreground }}>
                        {t}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Durée
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[30, 45, 60, 75, 90, 120].map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setNewSlotDuration(d)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: newSlotDuration === d ? Colors.primary : "#F8F5F1",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: newSlotDuration === d ? "#fff" : Colors.foreground }}>
                      {formatDuration(d)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              onPress={addSlot}
              style={{ height: 52, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
                Créer le créneau {newSlotTime} · {formatDuration(newSlotDuration)}
              </Text>
            </Pressable>
          </View>
        </View>
      </RNModal>

      {/* ── APPOINTMENT ACTIONS MODAL ── */}
      <RNModal visible={selectedApt != null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSelectedApt(null)}>
        {selectedApt && (
          <>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} onPress={() => setSelectedApt(null)} />
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: "#fff",
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 16,
              maxHeight: "85%",
            }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 8 }} />

              <View style={{ paddingHorizontal: 24, gap: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground }}>
                      {selectedApt.client_name ?? `${selectedApt.client_first_name ?? ""} ${selectedApt.client_last_name ?? ""}`.trim()}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                      {selectedApt.time} · {selectedApt.prestation_name ?? "—"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedApt(null)}
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={18} color={Colors.foreground} />
                  </Pressable>
                </View>

                <View style={{ height: 1, backgroundColor: Colors.border }} />

                {["pending", "ongoing", "past_pending"].includes(getAptStatus(selectedApt)) && (
                  <Pressable
                    onPress={() => handleComplete(selectedApt)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(22,163,74,0.12)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Marquer comme terminé</Text>
                  </Pressable>
                )}

                {getAptStatus(selectedApt) === "past_pending" && (
                  <Pressable
                    onPress={() =>
                      Alert.alert("Absent", "Enregistrer l'absence de cette cliente ?", [
                        { text: "Non", style: "cancel" },
                        { text: "Confirmer", style: "destructive", onPress: () => handleNoShow(selectedApt) },
                      ])
                    }
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.12)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="person-remove-outline" size={20} color="#F59E0B" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Absence — cliente non venue</Text>
                  </Pressable>
                )}

                {getAptStatus(selectedApt) === "pending" && (
                  <Pressable
                    onPress={() =>
                      Alert.alert("Annuler", "Annuler ce rendez-vous ?", [
                        { text: "Non", style: "cancel" },
                        { text: "Annuler le RDV", style: "destructive", onPress: () => handleCancel(selectedApt) },
                      ])
                    }
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#EF4444" }}>Annuler le rendez-vous</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}
      </RNModal>

      {/* ── UNAVAILABILITY MODAL ── */}
      <Modal visible={showUnavailModal} onClose={() => setShowUnavailModal(false)} bottomSheet noPadding maxHeight="85%">
        <View style={{ overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

          {/* Orange header */}
          <View style={{ backgroundColor: "#FFF7ED", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "#FED7AA" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#F59E0B20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="moon-outline" size={22} color="#D97706" />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#B45309" }}>Absences & congés</Text>
                  <Text style={{ fontSize: 12, color: "#D97706", marginTop: 1 }}>Bloque des périodes d'indisponibilité</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowUnavailModal(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#FED7AA50", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color="#B45309" />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 16 }}>
            {/* Date pickers */}
            <View style={{ gap: 12 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Du
                </Text>
                <Pressable
                  onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showStartPicker ? "#D97706" : Colors.border, paddingHorizontal: 14, backgroundColor: "#FFF7ED", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ fontSize: 14, color: unavailStartDate ? "#B45309" : Colors.mutedForeground, fontWeight: unavailStartDate ? "700" : "400" }}>
                    {unavailStartDate ? unavailStartDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#D97706" />
                </Pressable>
                {showStartPicker && (
                  <DateTimePicker
                    value={unavailStartDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    minimumDate={new Date()}
                    onChange={(_, date) => {
                      if (Platform.OS === "android") setShowStartPicker(false);
                      if (date) setUnavailStartDate(date);
                    }}
                    themeVariant="light"
                    accentColor="#D97706"
                  />
                )}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Au
                </Text>
                <Pressable
                  onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showEndPicker ? "#D97706" : Colors.border, paddingHorizontal: 14, backgroundColor: "#FFF7ED", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ fontSize: 14, color: unavailEndDate ? "#B45309" : Colors.mutedForeground, fontWeight: unavailEndDate ? "700" : "400" }}>
                    {unavailEndDate ? unavailEndDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#D97706" />
                </Pressable>
                {showEndPicker && (
                  <DateTimePicker
                    value={unavailEndDate ?? unavailStartDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    minimumDate={unavailStartDate ?? new Date()}
                    onChange={(_, date) => {
                      if (Platform.OS === "android") setShowEndPicker(false);
                      if (date) setUnavailEndDate(date);
                    }}
                    themeVariant="light"
                    accentColor="#D97706"
                  />
                )}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Raison (optionnel)
                </Text>
                <TextInput
                  value={unavailReason}
                  onChangeText={setUnavailReason}
                  placeholder="Vacances, maladie…"
                  placeholderTextColor={Colors.mutedForeground}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.foreground, backgroundColor: "#F8F5F1" }}
                />
              </View>
            </View>

            {/* Existing unavailabilities */}
            {unavailabilities.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Périodes bloquées
                </Text>
                {unavailabilities.map((u) => (
                  <View key={u.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FEF2F2", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#EF4444" }}>
                        {u.start_date.slice(0, 10)} → {u.end_date.slice(0, 10)}
                      </Text>
                      {u.reason && <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>{u.reason}</Text>}
                    </View>
                    <Pressable onPress={() => removeUnavailability(u.id)}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={createUnavailability}
              disabled={unavailSaving}
              style={{ height: 52, borderRadius: 16, backgroundColor: "#D97706", alignItems: "center", justifyContent: "center", opacity: unavailSaving ? 0.7 : 1 }}
            >
              {unavailSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Bloquer la période</Text>}
            </Pressable>
          <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── WEEKLY PLANNING MODAL ── */}
      <Modal visible={showPlanningModal} onClose={() => setShowPlanningModal(false)} bottomSheet noPadding maxHeight="85%">
        <View style={{ overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

          {/* Green header */}
          <View style={{ backgroundColor: "#F0FDF4", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: "#BBF7D0" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#16A34A20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="calendar-number-outline" size={22} color="#16A34A" />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#15803D" }}>Planning semaine type</Text>
                  <Text style={{ fontSize: 12, color: "#16A34A", marginTop: 1 }}>Tes jours et horaires habituels</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowPlanningModal(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#BBF7D050", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color="#15803D" />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 20 }}>
            {/* Toggleable day pills */}
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                Jours actifs
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DAYS_SHORT.map((d, idx) => {
                  const dayNum = idx + 1;
                  const isActive = activeDays.includes(dayNum);
                  return (
                    <Pressable
                      key={d}
                      onPress={() =>
                        setActiveDays((prev) =>
                          isActive ? prev.filter((n) => n !== dayNum) : [...prev, dayNum].sort()
                        )
                      }
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                        backgroundColor: isActive ? "#16A34A" : "#F3F4F6",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isActive ? "#fff" : Colors.mutedForeground }}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Time slots */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                  Créneaux horaires
                </Text>
                <Pressable
                  onPress={() => setShowPlanTimePicker(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#F0FDF4", borderRadius: 10 }}
                >
                  <Ionicons name="add" size={14} color="#16A34A" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#16A34A" }}>Ajouter</Text>
                </Pressable>
              </View>

              {showPlanTimePicker && (
                <View style={{ backgroundColor: "#F0FDF4", borderRadius: 14, overflow: "hidden" }}>
                  <DateTimePicker
                    value={newPlanTime}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, date) => {
                      if (date) setNewPlanTime(date);
                      if (Platform.OS === "android") {
                        setShowPlanTimePicker(false);
                        if (date) {
                          const h = String(date.getHours()).padStart(2, "0");
                          const m = String(date.getMinutes()).padStart(2, "0");
                          const t = `${h}:${m}`;
                          if (!planningSlots.includes(t)) setPlanningSlots((prev) => [...prev, t].sort());
                        }
                      }
                    }}
                    themeVariant="light"
                    accentColor="#16A34A"
                  />
                  {Platform.OS === "ios" && (
                    <Pressable
                      onPress={() => {
                        const h = String(newPlanTime.getHours()).padStart(2, "0");
                        const m = String(newPlanTime.getMinutes()).padStart(2, "0");
                        const t = `${h}:${m}`;
                        if (!planningSlots.includes(t)) setPlanningSlots((prev) => [...prev, t].sort());
                        setShowPlanTimePicker(false);
                      }}
                      style={{ margin: 12, height: 44, borderRadius: 12, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Ajouter ce créneau</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {planningSlots.map((t) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#F0FDF4", borderRadius: 10, borderWidth: 1, borderColor: "#BBF7D0" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#15803D" }}>{t}</Text>
                    <Pressable onPress={() => setPlanningSlots((prev) => prev.filter((s) => s !== t))}>
                      <Ionicons name="close-circle" size={16} color="#16A34A" />
                    </Pressable>
                  </View>
                ))}
                {planningSlots.length === 0 && (
                  <Text style={{ fontSize: 13, color: Colors.mutedForeground, fontStyle: "italic" }}>Aucun créneau ajouté</Text>
                )}
              </View>
            </View>

            {weeklyPlanSuccess && (
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#16A34A", textAlign: "center" }}>
                Planning appliqué ✓
              </Text>
            )}

            <Pressable
              onPress={applyWeeklyPlanning}
              disabled={weeklyPlanSaving || activeDays.length === 0}
              style={{ height: 52, borderRadius: 16, backgroundColor: activeDays.length === 0 ? "#D1D5DB" : "#16A34A", alignItems: "center", justifyContent: "center", opacity: weeklyPlanSaving ? 0.7 : 1 }}
            >
              {weeklyPlanSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Appliquer le planning</Text>
              )}
            </Pressable>
          <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
