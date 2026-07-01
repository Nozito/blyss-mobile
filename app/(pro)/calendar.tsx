import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal as RNModal,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
} from "react-native";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Modal } from "@/components/ui/Modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { proApi, nailTechApi } from "@/lib/api";
import { toLocalDate } from "@/lib/dateUtils";
import { Colors, withAlpha } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

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
  if (duration <= 0) return false;
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
const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam"];

// ─── Feature-scoped theme constants (intentionally distinct from brand palette)
const PLANNING = {
  bg: Colors.successLight,
  border: Colors.successBorder,
  color: Colors.successText,
  colorDark: Colors.successTextDark,
  iconBg: withAlpha(Colors.successText, 0.12),
  closeBg: withAlpha(Colors.successBorder, 0.5),
} as const;

const ABSENCES = {
  bg: Colors.warningLight,
  border: Colors.warningBorder,
  color: Colors.warningText,
  colorDark: Colors.warningTextDark,
  iconBg: withAlpha(Colors.warning, 0.12),
  closeBg: withAlpha(Colors.warningBorder, 0.4),
} as const;

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  completed:    { label: "Terminé",    color: Colors.successText,  bg: withAlpha(Colors.successText, 0.12),  icon: "checkmark-circle-outline" },
  cancelled:    { label: "Annulé",     color: Colors.destructive,  bg: withAlpha(Colors.destructive, 0.12),  icon: "close-circle-outline" },
  pending:      { label: "À venir",    color: Colors.warning,      bg: withAlpha(Colors.warning, 0.12),      icon: "time-outline" },
  ongoing:      { label: "En cours",   color: Colors.info,         bg: withAlpha(Colors.info, 0.12),         icon: "radio-button-on-outline" },
  past_pending: { label: "À valider",  color: Colors.pro,          bg: withAlpha(Colors.pro, 0.12),          icon: "alert-circle-outline" },
  no_show:      { label: "Absent",     color: Colors.destructive,  bg: withAlpha(Colors.destructive, 0.12),  icon: "person-remove-outline" },
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

const CELL_SIZE = (Dimensions.get("window").width - 40 - 32) / 6;

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
    const total = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    const firstDayJS = new Date(year, month, 1).getDay();
    const startOffset = firstDayJS === 0 ? 0 : firstDayJS - 1;
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= total; d++) {
      if (new Date(year, month, d).getDay() !== 0) arr.push(d);
    }
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
    <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <AnimatedIconButton onPress={onPrevMonth} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={18} color={Colors.foreground} />
        </AnimatedIconButton>
        <Pressable onPress={onToday}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground }}>
            {MONTHS[month]} {year}
          </Text>
        </Pressable>
        <AnimatedIconButton onPress={onNextMonth} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
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
                backgroundColor: isSel ? Colors.primary : isU ? Colors.destructiveLight : "transparent",
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: isSel || isTod ? "800" : "500",
                color: isSel ? Colors.white : isTod ? Colors.primary : isU ? Colors.destructive : Colors.foreground,
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

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [showAddSlot, setShowAddSlot] = useState(false);
  const [showUnavailModal, setShowUnavailModal] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);

  const [newSlotTime, setNewSlotTime] = useState("09:00");
  const [newSlotDuration, setNewSlotDuration] = useState(60);

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("09:00");
  const [editDur, setEditDur] = useState(60);

  const [unavailStartDate, setUnavailStartDate] = useState<Date | null>(null);
  const [unavailEndDate, setUnavailEndDate] = useState<Date | null>(null);
  const [unavailReason, setUnavailReason] = useState("");
  const [unavailSaving, setUnavailSaving] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [planningSlots, setPlanningSlots] = useState<string[]>(["09:00", "14:00"]);
  const [weeklyPlanSaving, setWeeklyPlanSaving] = useState(false);
  const [weeklyPlanSuccess, setWeeklyPlanSuccess] = useState(false);
  const [showPlanTimePicker, setShowPlanTimePicker] = useState(false);
  const [newPlanTime, setNewPlanTime] = useState(new Date());

  const [slotError, setSlotError] = useState<string | null>(null);
  const [unavailError, setUnavailError] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planningInfo, setPlanningInfo] = useState<string | null>(null);
  const [showDeleteSlotId, setShowDeleteSlotId] = useState<string | null>(null);
  const [showCancelAptId, setShowCancelAptId] = useState<number | null>(null);
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);
  const [planConfirmMsg, setPlanConfirmMsg] = useState("");
  const [planConfirmWeeks, setPlanConfirmWeeks] = useState(4);

  type ViewMode = "month" | "week";
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const toggleAnim = useRef(new Animated.Value(1)).current;

  const toggleViewMode = useCallback(() => {
    Animated.sequence([
      Animated.timing(toggleAnim, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      Animated.spring(toggleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
    setViewMode((v) => (v === "month" ? "week" : "month"));
  }, [toggleAnim]);

  const selectedYear  = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const selectedDateStr = toLocalDate(selectedDate);

  const fetchMonthData = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const to   = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
      const [calRes, unavailRes] = await Promise.all([
        proApi.getCalendar({ from, to }),
        proApi.getUnavailabilities(),
      ]);
      if (calRes.success && calRes.data) setAppointments(calRes.data as Appointment[]);
      if (unavailRes.success && unavailRes.data) setUnavailabilities(unavailRes.data as Unavailability[]);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSlots = useCallback(async (dateStr: string) => {
    setSlotsLoading(true);
    try {
      const res = await proApi.getSlots({ date: dateStr });
      if (res.success && res.data) setSlots((res.data as Record<string, unknown>[]).map(mapSlot));
    } catch {
      // silent
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMonthData(selectedYear, selectedMonth); }, [fetchMonthData, selectedYear, selectedMonth]);
  useEffect(() => { void fetchSlots(selectedDateStr); }, [fetchSlots, selectedDateStr]);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchMonthData(selectedYear, selectedMonth);
      void fetchSlots(selectedDateStr);
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchMonthData, fetchSlots, selectedYear, selectedMonth, selectedDateStr]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMonthData(selectedYear, selectedMonth), fetchSlots(selectedDateStr)]);
    setRefreshing(false);
  }, [fetchMonthData, fetchSlots, selectedYear, selectedMonth, selectedDateStr]);

  const handleSelectDate = (d: Date) => {
    setSelectedDate(d);
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

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

  const toggleSlot = async (id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (!slot || slot.isPast || !slot.isAvailable) return;
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !s.isActive } : s));
    try {
      await proApi.updateSlot(parseInt(id), { status: slot.isActive ? "blocked" : "available" });
    } catch {
      setSlots((prev) => prev.map((s) => s.id === id ? { ...s, isActive: slot.isActive } : s));
      setSlotError("Impossible de mettre à jour le créneau");
    }
  };

  const addSlot = async () => {
    setSlotError(null);
    const date = toLocalDate(selectedDate);
    if (!canCreate(date, newSlotTime)) {
      setSlotError("Impossible de créer un créneau dans le passé");
      return;
    }
    if (checkOverlap(slots, newSlotTime, newSlotDuration)) {
      setSlotError("Ce créneau chevauche un créneau existant");
      return;
    }
    try {
      await proApi.createSlot({ date, time: newSlotTime, duration: newSlotDuration });
      await fetchSlots(selectedDateStr);
      setShowAddSlot(false);
    } catch {
      setSlotError("Impossible d'ajouter le créneau");
    }
  };

  const confirmEditSlot = async () => {
    if (!editingSlotId) return;
    setSlotError(null);
    const date = toLocalDate(selectedDate);
    if (!canCreate(date, editTime)) {
      setSlotError("Heure déjà passée");
      return;
    }
    if (checkOverlap(slots, editTime, editDur, editingSlotId)) {
      setSlotError("Chevauchement avec un autre créneau");
      return;
    }
    setEditingSlotId(null);
    try {
      await proApi.updateSlot(parseInt(editingSlotId), { date, time: editTime, duration: editDur });
      await fetchSlots(selectedDateStr);
    } catch {
      setSlotError("Impossible de modifier le créneau");
    }
  };

  const deleteSlot = async (id: string) => {
    const backup = [...slots];
    setShowDeleteSlotId(null);
    setSlots((prev) => prev.filter((s) => s.id !== id));
    try {
      await proApi.deleteSlot(parseInt(id));
    } catch {
      setSlots(backup);
      setSlotError("Impossible de supprimer le créneau");
    }
  };

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

  const createUnavailability = async () => {
    setUnavailError(null);
    if (!unavailStartDate || !unavailEndDate) {
      setUnavailError("Sélectionne une période");
      return;
    }
    const startStr = toLocalDate(unavailStartDate);
    const endStr = toLocalDate(unavailEndDate);
    if (endStr < startStr) {
      setUnavailError("La date de fin doit être après le début");
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
      setUnavailError("Impossible d'enregistrer la période");
    } finally {
      setUnavailSaving(false);
    }
  };

  const applyWeeklyPlanning = () => {
    if (activeDays.length === 0 || planningSlots.length === 0) return;

    const MAX_SLOTS_PER_DAY = 5;
    const WEEKS = 4;

    setPlanningError(null);
    if (planningSlots.length > MAX_SLOTS_PER_DAY) {
      setPlanningError(`Le planning est limité à ${MAX_SLOTS_PER_DAY} créneaux par jour. Retire les créneaux en trop avant de continuer.`);
      return;
    }

    const totalSlots = activeDays.length * WEEKS * planningSlots.length;
    setPlanConfirmWeeks(WEEKS);
    setPlanConfirmMsg(`${totalSlots} créneaux vont être créés sur ${WEEKS} semaines (${activeDays.length} jour${activeDays.length > 1 ? "s" : ""} × ${planningSlots.length} créneau${planningSlots.length > 1 ? "x" : ""}/jour).\n\nLes créneaux déjà existants ou passés seront ignorés.`);
    setShowPlanConfirm(true);
  };

  const doApplyWeeklyPlanning = async (weeks: number) => {
    setWeeklyPlanSaving(true);

    const getNextDates = (dayNum: number): string[] => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const jsDay = dayNum % 7;
      const diff = (jsDay - today.getDay() + 7) % 7;
      const first = new Date(today);
      first.setDate(today.getDate() + diff);
      return Array.from({ length: weeks }, (_, w) => {
        const d = new Date(first);
        d.setDate(first.getDate() + w * 7);
        return toLocalDate(d);
      });
    };

    try {
      const results = await Promise.all(
        activeDays.flatMap((dayNum) =>
          getNextDates(dayNum).flatMap((date) =>
            planningSlots.map((time) =>
              proApi.createSlot({ date, time, duration: 60 }).catch(() => null)
            )
          )
        )
      );

      const failed = results.filter((r) => r === null).length;
      const created = results.length - failed;
      await fetchSlots(selectedDateStr);
      qc.invalidateQueries({ queryKey: ["slots"] });

      if (failed > 0) {
        setPlanningInfo(`${created} créneaux créés, ${failed} ignorés (chevauchement ou passés).`);
        setTimeout(() => setPlanningInfo(null), 3000);
      } else {
        setWeeklyPlanSuccess(true);
        setTimeout(() => setWeeklyPlanSuccess(false), 2500);
      }
    } catch {
      setPlanningError("Impossible d'appliquer le planning");
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

  const aptStatusKey = selectedApt ? getAptStatus(selectedApt) : "pending";
  const aptStatusCfg = STATUS_CFG[aptStatusKey] ?? STATUS_CFG.pending;
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);

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
              onPress={() => {
                const t = new Date();
                setSelectedDate(t);
                setCurrentDate(new Date(t.getFullYear(), t.getMonth(), 1));
              }}
              style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", ...Shadows.card }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>Auj.</Text>
            </Pressable>
            <Pressable
              onPress={() => setIsSearchOpen((v) => !v)}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", ...Shadows.card }}
            >
              <Ionicons name={isSearchOpen ? "close" : "search-outline"} size={18} color={Colors.foreground} />
            </Pressable>
            <Pressable
              onPress={toggleViewMode}
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: viewMode === "week" ? Colors.primary : Colors.white,
                alignItems: "center", justifyContent: "center",
                ...Shadows.card,
              }}
            >
              <Animated.View style={{ transform: [{ scale: toggleAnim }] }}>
                <Ionicons
                  name={viewMode === "month" ? "calendar-outline" : "grid-outline"}
                  size={18}
                  color={viewMode === "week" ? Colors.white : Colors.foreground}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        {isSearchOpen && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.white, borderRadius: 14, paddingHorizontal: 14, height: 44, ...Shadows.card, marginTop: 8 }}>
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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
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
          <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <AnimatedIconButton
                onPress={() => {
                  const p = new Date(selectedDate);
                  p.setDate(p.getDate() - 7);
                  handleSelectDate(p);
                }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chevron-back" size={18} color={Colors.foreground} />
              </AnimatedIconButton>
              <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.foreground }}>
                {(() => {
                  const mon = new Date(selectedDate);
                  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
                  const sat = new Date(mon); sat.setDate(sat.getDate() + 5);
                  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                  return `${fmt(mon)} – ${fmt(sat)}`;
                })()}
              </Text>
              <AnimatedIconButton
                onPress={() => {
                  const n = new Date(selectedDate);
                  n.setDate(n.getDate() + 7);
                  handleSelectDate(n);
                }}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chevron-forward" size={18} color={Colors.foreground} />
              </AnimatedIconButton>
            </View>

            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: 6 }, (_, i) => {
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
                      backgroundColor: isActive ? Colors.primary : isToday ? withAlpha(Colors.primary, 0.10) : "transparent" }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "700", color: isActive ? Colors.white : Colors.mutedForeground,
                      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      {["L","M","M","J","V","S"][i]}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800",
                      color: isActive ? Colors.white : isToday ? Colors.primary : Colors.foreground }}>
                      {base.getDate()}
                    </Text>
                    {hasApt && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3,
                        backgroundColor: isActive ? Colors.white : Colors.primary }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── PLANNING & ABSENCES CARDS ── */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <Pressable
            onPress={() => setShowPlanningModal(true)}
            style={{ flex: 1, backgroundColor: PLANNING.bg, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: PLANNING.border }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: PLANNING.iconBg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-number-outline" size={20} color={PLANNING.color} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: PLANNING.colorDark }}>Planning</Text>
            <Text style={{ fontSize: 11, color: PLANNING.color, lineHeight: 15 }}>Semaine type & horaires</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowUnavailModal(true)}
            style={{ flex: 1, backgroundColor: ABSENCES.bg, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: ABSENCES.border }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: ABSENCES.iconBg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="moon-outline" size={20} color={ABSENCES.color} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: ABSENCES.colorDark }}>Absences</Text>
            <Text style={{ fontSize: 11, color: ABSENCES.color, lineHeight: 15 }}>Congés & indisponibilités</Text>
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
            <Ionicons name="add" size={16} color={Colors.white} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.white }}>Créneau</Text>
          </Pressable>
        </View>

        {/* ── SLOTS ── */}
        {slotsLoading ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : slots.length === 0 ? (
          <View style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, marginBottom: 16, gap: 6 }}>
            <Ionicons name="time-outline" size={36} color={Colors.border} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>Aucun créneau ce jour</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>Appuie sur « + Créneau » pour en ajouter</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: Colors.white, borderRadius: 16, overflow: "hidden", ...Shadows.card, marginBottom: 16 }}>
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
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isEditing ? withAlpha(Colors.primary, 0.05) : undefined }}>
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
                                    backgroundColor: editTime === t ? Colors.primary : Colors.muted,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: "600", color: editTime === t ? Colors.white : Colors.foreground }}>
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
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: editDur === d ? Colors.primary : Colors.muted }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "600", color: editDur === d ? Colors.white : Colors.foreground }}>
                                {formatDuration(d)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => setEditingSlotId(null)}
                            style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
                          </Pressable>
                          <Pressable
                            onPress={confirmEditSlot}
                            style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.white }}>Confirmer</Text>
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
                            backgroundColor: slot.isPast ? Colors.border : isBooked ? Colors.info : isOpen ? Colors.primary : Colors.mutedForeground,
                          }} />
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: slot.isPast ? Colors.mutedForeground : Colors.foreground }}>
                              {slot.time} – {endTime}
                            </Text>
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>
                              {formatDuration(parseDuration(slot.duration))}
                              {" · "}
                              <Text style={{ color: isBooked ? Colors.info : isOpen ? Colors.primary : Colors.mutedForeground }}>
                                {slot.isPast ? "Passé" : isBooked ? "Réservé" : isOpen ? "Ouvert" : "Bloqué"}
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {!slot.isPast && !isBooked && (
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <Pressable
                              onPress={() => toggleSlot(slot.id)}
                              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isOpen ? withAlpha(Colors.primary, 0.10) : Colors.muted, alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name={isOpen ? "lock-open-outline" : "lock-closed-outline"} size={16} color={isOpen ? Colors.primary : Colors.mutedForeground} />
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                setEditTime(slot.time);
                                setEditDur(parseDuration(slot.duration));
                                setEditingSlotId(slot.id);
                              }}
                              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name="pencil-outline" size={16} color={Colors.mutedForeground} />
                            </Pressable>
                            <Pressable
                              onPress={() => setShowDeleteSlotId(slot.id)}
                              style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.destructiveLight, alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
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
          <View style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, gap: 6 }}>
            <Ionicons name="calendar-outline" size={36} color={Colors.border} />
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
                    backgroundColor: Colors.white,
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

      {/* ── ADD SLOT MODAL ── */}
      <RNModal visible={showAddSlot} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowAddSlot(false)}>
        <Pressable style={{ flex: 1, backgroundColor: Colors.overlayLight }} onPress={() => setShowAddSlot(false)} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: Colors.white,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 16,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

          <View style={{ backgroundColor: withAlpha(Colors.primary, 0.06), paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: withAlpha(Colors.primary, 0.12) }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: withAlpha(Colors.primary, 0.10), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground }}>Nouveau créneau</Text>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 1, textTransform: "capitalize" }}>{selectedDateLabel}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowAddSlot(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(Colors.primary, 0.08), alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={Colors.primary} />
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 20, paddingBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Heure de début
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {QUICK_TIMES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setNewSlotTime(t)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                        backgroundColor: newSlotTime === t ? Colors.primary : Colors.muted,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: newSlotTime === t ? Colors.white : Colors.foreground }}>
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
                      backgroundColor: newSlotDuration === d ? Colors.primary : Colors.muted,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: newSlotDuration === d ? Colors.white : Colors.foreground }}>
                      {formatDuration(d)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Ionicons name="time-outline" size={16} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                Créneau de{" "}
                <Text style={{ fontWeight: "700", color: Colors.foreground }}>{newSlotTime}</Text>
                {" "}à{" "}
                <Text style={{ fontWeight: "700", color: Colors.foreground }}>
                  {(() => {
                    const end = timeToMin(newSlotTime) + newSlotDuration;
                    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                  })()}
                </Text>
                {" · "}{formatDuration(newSlotDuration)}
              </Text>
            </View>

            {slotError && <View style={{ marginBottom: 4 }}><ErrorMessage message={slotError} /></View>}
            <Pressable
              onPress={addSlot}
              style={{ height: 52, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.white }}>Créer ce créneau</Text>
            </Pressable>
          </View>
        </View>
      </RNModal>

      {/* ── APPOINTMENT ACTIONS MODAL ── */}
      <RNModal visible={selectedApt != null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSelectedApt(null)}>
        {selectedApt && (
          <>
            <Pressable style={{ flex: 1, backgroundColor: Colors.overlayLight }} onPress={() => setSelectedApt(null)} />
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: Colors.white,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 16,
            }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

              <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: aptStatusCfg.bg }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: aptStatusCfg.color }}>{aptStatusCfg.label}</Text>
                      </View>
                      {selectedApt.price != null && (
                        <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.primary }}>
                          {Number(selectedApt.price).toFixed(2).replace(".", ",")} €
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground }}>
                      {selectedApt.client_name ?? `${selectedApt.client_first_name ?? ""} ${selectedApt.client_last_name ?? ""}`.trim()}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 3 }}>
                      {selectedApt.time}
                      {selectedApt.duration ? ` · ${formatDuration(parseDuration(selectedApt.duration))}` : ""}
                      {selectedApt.prestation_name ? ` · ${selectedApt.prestation_name}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedApt(null)}
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={18} color={Colors.foreground} />
                  </Pressable>
                </View>
              </View>

              <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}>
                {["pending", "ongoing", "past_pending"].includes(getAptStatus(selectedApt)) && (
                  <>
                    <Pressable
                      onPress={() => handleComplete(selectedApt)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(Colors.successText, 0.12), alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark-circle-outline" size={22} color={Colors.successText} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.successText }}>Marquer comme terminé</Text>
                        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>Le rendez-vous est bien passé</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
                    </Pressable>
                    <View style={{ height: 1, backgroundColor: Colors.border }} />
                  </>
                )}

                {getAptStatus(selectedApt) === "past_pending" && (
                  <>
                    <Pressable
                      onPress={() => handleNoShow(selectedApt)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(Colors.warning, 0.12), alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="person-remove-outline" size={22} color={Colors.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.warningText }}>Cliente non venue</Text>
                        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>Enregistrer l'absence</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
                    </Pressable>
                    <View style={{ height: 1, backgroundColor: Colors.border }} />
                  </>
                )}

                {getAptStatus(selectedApt) === "pending" && (
                  <Pressable
                    onPress={() => setShowCancelAptId(selectedApt.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(Colors.destructive, 0.10), alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="close-circle-outline" size={22} color={Colors.destructive} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.destructive }}>Annuler le rendez-vous</Text>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>La cliente sera notifiée</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.destructive} />
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
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

          <View style={{ backgroundColor: ABSENCES.bg, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: ABSENCES.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: ABSENCES.iconBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="moon-outline" size={22} color={ABSENCES.color} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: ABSENCES.colorDark }}>Absences & congés</Text>
                  <Text style={{ fontSize: 12, color: ABSENCES.color, marginTop: 1 }}>Bloque des périodes d'indisponibilité</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowUnavailModal(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ABSENCES.closeBg, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={ABSENCES.colorDark} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 16 }}>
            <View style={{ gap: 12 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Du
                </Text>
                <Pressable
                  onPress={() => { setShowStartPicker(true); setShowEndPicker(false); }}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showStartPicker ? ABSENCES.color : Colors.border, paddingHorizontal: 14, backgroundColor: ABSENCES.bg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ fontSize: 14, color: unavailStartDate ? ABSENCES.colorDark : Colors.mutedForeground, fontWeight: unavailStartDate ? "700" : "400" }}>
                    {unavailStartDate ? unavailStartDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={ABSENCES.color} />
                </Pressable>
                {showStartPicker && (
                  <DateTimePicker
                    value={unavailStartDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    minimumDate={new Date()}
                    onChange={(_, date) => {
                      if (Platform.OS === "android") setShowStartPicker(false);
                      if (date) {
                        setUnavailStartDate(date);
                        if (unavailEndDate && unavailEndDate < date) setUnavailEndDate(null);
                      }
                    }}
                    themeVariant="light"
                    accentColor={ABSENCES.color}
                  />
                )}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Au
                </Text>
                <Pressable
                  onPress={() => { setShowEndPicker(true); setShowStartPicker(false); }}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showEndPicker ? ABSENCES.color : Colors.border, paddingHorizontal: 14, backgroundColor: ABSENCES.bg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ fontSize: 14, color: unavailEndDate ? ABSENCES.colorDark : Colors.mutedForeground, fontWeight: unavailEndDate ? "700" : "400" }}>
                    {unavailEndDate ? unavailEndDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Sélectionner une date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={ABSENCES.color} />
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
                    accentColor={ABSENCES.color}
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
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, fontSize: 14, color: Colors.foreground, backgroundColor: ABSENCES.bg }}
                />
              </View>
            </View>

            {unavailabilities.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Périodes bloquées ({unavailabilities.length})
                </Text>
                {unavailabilities.map((u) => (
                  <View key={u.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.destructiveLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons name="moon" size={14} color={Colors.destructive} />
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.destructive }}>
                          {new Date(u.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          {" → "}
                          {new Date(u.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </Text>
                        {u.reason && <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>{u.reason}</Text>}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => removeUnavailability(u.id)}
                      style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: withAlpha(Colors.destructive, 0.10), alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.destructive} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {unavailError && <View style={{ marginBottom: 8 }}><ErrorMessage message={unavailError} /></View>}
            <LoadingButton
              loading={unavailSaving}
              onPress={createUnavailability}
              disabled={!unavailStartDate || !unavailEndDate}
              label={!unavailStartDate || !unavailEndDate ? "Sélectionne les dates" : "Bloquer la période"}
              style={{ backgroundColor: (!unavailStartDate || !unavailEndDate) ? Colors.disabled : ABSENCES.color }}
            />
          <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── WEEKLY PLANNING MODAL ── */}
      <Modal visible={showPlanningModal} onClose={() => setShowPlanningModal(false)} bottomSheet noPadding maxHeight="85%">
        <View style={{ overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

          <View style={{ backgroundColor: PLANNING.bg, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: PLANNING.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: PLANNING.iconBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="calendar-number-outline" size={22} color={PLANNING.color} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: PLANNING.colorDark }}>Planning semaine type</Text>
                  <Text style={{ fontSize: 12, color: PLANNING.color, marginTop: 1 }}>Appliqué sur les 4 prochaines semaines</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowPlanningModal(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: PLANNING.closeBg, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={PLANNING.colorDark} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 20 }}>
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
                        backgroundColor: isActive ? PLANNING.color : Colors.muted,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isActive ? Colors.white : Colors.mutedForeground }}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                    Horaires de début
                  </Text>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>Durée par défaut : 1h</Text>
                </View>
                <Pressable
                  onPress={() => setShowPlanTimePicker(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: PLANNING.bg, borderRadius: 10, borderWidth: 1, borderColor: PLANNING.border }}
                >
                  <Ionicons name="add" size={14} color={PLANNING.color} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: PLANNING.color }}>Ajouter</Text>
                </Pressable>
              </View>

              {showPlanTimePicker && (
                <View style={{ backgroundColor: PLANNING.bg, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: PLANNING.border }}>
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
                    accentColor={PLANNING.color}
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
                      style={{ margin: 12, height: 44, borderRadius: 12, backgroundColor: PLANNING.color, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Confirmer</Text>
                    </Pressable>
                  )}
                </View>
              )}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {planningSlots.map((t) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: PLANNING.bg, borderRadius: 10, borderWidth: 1, borderColor: PLANNING.border }}>
                    <Ionicons name="time-outline" size={13} color={PLANNING.color} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: PLANNING.colorDark }}>{t}</Text>
                    <Pressable onPress={() => setPlanningSlots((prev) => prev.filter((s) => s !== t))}>
                      <Ionicons name="close-circle" size={16} color={PLANNING.color} />
                    </Pressable>
                  </View>
                ))}
                {planningSlots.length === 0 && (
                  <View style={{ backgroundColor: Colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, width: "100%" }}>
                    <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Aucun horaire — appuie sur Ajouter</Text>
                  </View>
                )}
              </View>
            </View>

            {activeDays.length > 0 && planningSlots.length > 0 && (
              <View style={{ backgroundColor: PLANNING.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: PLANNING.border }}>
                <Text style={{ fontSize: 12, color: PLANNING.colorDark, fontWeight: "600", lineHeight: 18 }}>
                  {activeDays.length * 4 * planningSlots.length} créneaux · {activeDays.length} jour{activeDays.length > 1 ? "s" : ""} × {planningSlots.length} horaire{planningSlots.length > 1 ? "s" : ""} × 4 semaines
                </Text>
              </View>
            )}

            {weeklyPlanSuccess && (
              <View style={{ backgroundColor: withAlpha(Colors.successText, 0.10), borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: PLANNING.border }}>
                <Ionicons name="checkmark-circle" size={20} color={PLANNING.color} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: PLANNING.colorDark }}>Planning appliqué avec succès</Text>
              </View>
            )}
            {planningError && <View style={{ marginBottom: 4 }}><ErrorMessage message={planningError} /></View>}
            {planningInfo && (
              <View style={{ backgroundColor: withAlpha(Colors.successText, 0.08), borderRadius: 12, padding: 12, borderWidth: 1, borderColor: PLANNING.border }}>
                <Text style={{ fontSize: 13, color: PLANNING.colorDark, fontWeight: "600" }}>{planningInfo}</Text>
              </View>
            )}

            <LoadingButton
              loading={weeklyPlanSaving}
              onPress={applyWeeklyPlanning}
              disabled={activeDays.length === 0 || planningSlots.length === 0}
              label="Appliquer le planning"
              style={{ backgroundColor: (activeDays.length === 0 || planningSlots.length === 0) ? Colors.disabled : PLANNING.color }}
            />
          <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── DELETE SLOT CONFIRM ── */}
      <RNModal visible={showDeleteSlotId != null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowDeleteSlotId(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: "100%", gap: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground, textAlign: "center" }}>Supprimer ce créneau ?</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center" }}>Cette action est irréversible.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => setShowDeleteSlotId(null)} style={{ flex: 1, height: 46, borderRadius: 13, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => { if (showDeleteSlotId) void deleteSlot(showDeleteSlotId); }} style={{ flex: 1, height: 46, borderRadius: 13, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* ── CANCEL APT CONFIRM ── */}
      <RNModal visible={showCancelAptId != null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowCancelAptId(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlayDark }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowCancelAptId(null)} />
          <View style={{ backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground, textAlign: "center", marginBottom: 8 }}>Annuler le rendez-vous ?</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 20 }}>Cette action est irréversible. La cliente sera notifiée.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => setShowCancelAptId(null)} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Retour</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const apt = appointments.find((a) => a.id === showCancelAptId);
                  if (apt) { setShowCancelAptId(null); void handleCancel(apt); }
                }}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Annuler le RDV</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* ── PLAN CONFIRM ── */}
      <RNModal visible={showPlanConfirm} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowPlanConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: "100%", gap: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground, textAlign: "center" }}>Confirmer le planning</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", lineHeight: 20 }}>{planConfirmMsg}</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => setShowPlanConfirm(false)} style={{ flex: 1, height: 46, borderRadius: 13, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable onPress={() => { setShowPlanConfirm(false); void doApplyWeeklyPlanning(planConfirmWeeks); }} style={{ flex: 1, height: 46, borderRadius: 13, backgroundColor: PLANNING.color, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Appliquer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </RNModal>
    </View>
  );
}
