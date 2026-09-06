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
  Switch,
} from "react-native";
import { useActionSheet } from "@/components/ui/ActionSheet";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Modal } from "@/components/ui/Modal";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { proApi, nailTechApi, type AvailabilitySlot } from "@/lib/api";
import { toLocalDate } from "@/lib/dateUtils";
import {
  isCalendarSyncEnabled,
  enableCalendarSync,
  disableCalendarSync,
  syncAppointmentsToCalendar,
} from "@/lib/appleCalendarSync";
import { withAlpha } from "@/constants/colors";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useToast } from "@/components/ui/Toast";
import { useRouter, useLocalSearchParams } from "expo-router";
import { hasPlanAtLeast } from "@/constants/plans";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useLiveActivity } from "@/contexts/LiveActivityContext";
import { useDebounce } from "@/hooks/useDebounce";
import { NewAppointmentSheet, type EditableAppointment } from "@/components/screens/pro/calendar/NewAppointmentSheet";
import { AbsenceSheet, type Unavailability } from "@/components/screens/pro/calendar/AbsenceSheet";
import { StatusBadge, getStatusCfg } from "@/components/screens/pro/calendar/StatusBadge";

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
function getPlanning(colors: ReturnType<typeof useThemeColors>) {
  return {
    bg: colors.successLight,
    border: colors.successBorder,
    color: colors.successText,
    colorDark: colors.successTextDark,
    iconBg: withAlpha(colors.successText, 0.12),
    closeBg: withAlpha(colors.successBorder, 0.5),
  } as const;
}


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
  const colors = useThemeColors();
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
    <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
      {/* Month nav */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <AnimatedIconButton onPress={onPrevMonth} accessibilityLabel="Mois précédent" style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={18} color={colors.foreground} />
        </AnimatedIconButton>
        <AnimatedPressable onPress={onToday}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>
            {MONTHS[month]} {year}
          </Text>
        </AnimatedPressable>
        <AnimatedIconButton onPress={onNextMonth} accessibilityLabel="Mois suivant" style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
        </AnimatedIconButton>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {DAYS_SHORT.map((d) => (
          <View key={d} style={{ width: CELL_SIZE, alignItems: "center" }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
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

          // Absence = jour de repos, pas une erreur : on reprend le langage
          // ambré déjà utilisé pour "Absences" ailleurs sur cet écran (bandeau,
          // carte, semaine) plutôt que le rouge "destructive" réservé aux
          // actions d'annulation/suppression. Un badge rond discret (pas un
          // pavé plein sur toute la cellule) évite l'effet "gros rectangle".
          const badgeSize = CELL_SIZE - 12;
          return (
            <AnimatedPressable
              key={day}
              onPress={() => onSelectDay(thisDate)}
              style={{ width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center" }}
            >
              <View style={{
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isSel
                  ? colors.primary
                  : isU
                    ? colors.muted
                    : "transparent",
                borderWidth: isU && !isSel ? 1 : 0,
                borderColor: colors.border,
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: isSel || isTod ? "800" : "500",
                  color: isSel ? colors.onColor : isTod ? colors.primary : isU ? colors.mutedForeground : colors.foreground,
                }}>
                  {day}
                </Text>
                {isU && !isSel && (
                  <Ionicons
                    name="moon"
                    size={9}
                    color={colors.mutedForeground}
                    style={{ position: "absolute", bottom: -1, right: -1 }}
                  />
                )}
              </View>
              {hasA && !isSel && (
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isTod ? colors.primary : colors.mutedForeground, marginTop: 2 }} />
              )}
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── SEARCH RESULT SECTION ─────────────────────────────────────────────────
// One of the two search buckets ("À venir" / "Déjà eu lieu"), each grouped
// by date so multiple appointments with the same client stay easy to scan.

function SearchResultSection({
  title,
  icon,
  groups,
  onSelectDate,
  onSelectApt,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  groups: [string, Appointment[]][];
  onSelectDate: (d: Date) => void;
  onSelectApt: (apt: Appointment) => void;
}) {
  const colors = useThemeColors();
  if (groups.length === 0) return null;
  const count = groups.reduce((s, [, apts]) => s + apts.length, 0);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 2 }}>
        <Ionicons name={icon} size={13} color={colors.mutedForeground} />
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
          {title} ({count})
        </Text>
      </View>
      <View style={{ gap: 16 }}>
        {groups.map(([date, apts]) => (
          <View key={date}>
            <AnimatedPressable onPress={() => onSelectDate(new Date(date + "T12:00:00"))} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <View style={{ width: 4, height: 16, backgroundColor: colors.border, borderRadius: 2 }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.mutedForeground, textTransform: "capitalize" }}>
                {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </AnimatedPressable>
            <View style={{ gap: 8 }}>
              {apts.map((apt) => (
                <AptCard
                  key={apt.id}
                  apt={apt}
                  onPress={() => { const canAct = ["pending", "ongoing", "past_pending"].includes(getAptStatus(apt)); if (canAct) onSelectApt(apt); }}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── APT CARD ────────────────────────────────────────────────────────────────

function AptCard({ apt, onPress }: { apt: Appointment; onPress: () => void }) {
  const colors = useThemeColors();
  const STATUS_CFG = useMemo(() => getStatusCfg(colors), [colors]);
  const statusKey = getAptStatus(apt);
  const cfg = STATUS_CFG[statusKey] ?? STATUS_CFG.pending;
  const clientName = apt.client_name ?? `${apt.client_first_name ?? ""} ${apt.client_last_name ?? ""}`.trim();
  const initials = clientName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

  return (
    <AnimatedPressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 14, ...Shadows.card }}
    >
      <View style={{ minWidth: 42, alignItems: "center", flexShrink: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }} numberOfLines={1}>{apt.time}</Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={1}>{formatDuration(parseDuration(apt.duration))}</Text>
      </View>

      <View style={{ width: 1, alignSelf: "stretch", backgroundColor: colors.border }} />

      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: withAlpha(cfg.color, 0.12), alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: cfg.color }}>{initials}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{clientName}</Text>
        {apt.prestation_name && (
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={1}>{apt.prestation_name}</Text>
        )}
      </View>

      <View style={{ alignItems: "flex-end", gap: 5 }}>
        {apt.price != null && (
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }}>{Number(apt.price).toFixed(2).replace(".", ",")} €</Text>
        )}
        <StatusBadge statusKey={statusKey} variant="inline" />
      </View>
    </AnimatedPressable>
  );
}

// ─── CRÉNEAUX LIBRES ─────────────────────────────────────────────────────────
// Regroupés en plages repliables (matin / après-midi / fin de journée). Une
// journée d'ouverture large produisait 20+ lignes qui remplissaient l'écran ;
// ici la carte reste courte, chaque plage annonce son nombre de créneaux et
// on déplie celle qu'on veut détailler.

const slotHHMM = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

type SlotRange = { key: "morning" | "afternoon" | "evening"; label: string; slots: AvailabilitySlot[] };

function splitSlotRanges(slots: AvailabilitySlot[]): SlotRange[] {
  const buckets: Record<SlotRange["key"], AvailabilitySlot[]> = { morning: [], afternoon: [], evening: [] };
  for (const s of slots) {
    const h = new Date(s.start).getHours();
    buckets[h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"].push(s);
  }
  const labels: Record<SlotRange["key"], string> = {
    morning: "Matin",
    afternoon: "Après-midi",
    evening: "Fin de journée",
  };
  return (["morning", "afternoon", "evening"] as const)
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, label: labels[k], slots: buckets[k] }));
}

function FreeSlotsCard({ slots }: { slots: AvailabilitySlot[] }) {
  const colors = useThemeColors();
  const ranges = useMemo(() => splitSlotRanges(slots), [slots]);
  const [openKey, setOpenKey] = useState<SlotRange["key"] | null>(ranges[0]?.key ?? null);

  // La date affichée peut changer sous nos pieds — garder ouverte une plage
  // qui existe toujours, sinon retomber sur la première.
  useEffect(() => {
    setOpenKey((cur) => (ranges.some((r) => r.key === cur) ? cur : ranges[0]?.key ?? null));
  }, [ranges]);

  const earliest = slots[0]?.start;

  return (
    <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 14, ...Shadows.card, marginBottom: 16, gap: 8 }}>
      {earliest && (
        <View style={{ backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: withAlpha(colors.onColor, 0.85) }}>
            Au plus tôt
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.onColor, marginTop: 2 }}>
            {slotHHMM(earliest)}
          </Text>
        </View>
      )}

      {ranges.map((r) => {
        const open = openKey === r.key;
        const span = `${slotHHMM(r.slots[0].start)} – ${slotHHMM(r.slots[r.slots.length - 1].start)}`;
        return (
          <View key={r.key}>
            <AnimatedPressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setOpenKey(open ? null : r.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${r.label}, ${r.slots.length} créneaux libres`}
              accessibilityState={{ expanded: open }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1,
                borderRadius: 13,
                paddingHorizontal: 13,
                paddingVertical: 12,
                borderColor: open ? colors.primary : colors.border,
                backgroundColor: open ? colors.primaryLight : "transparent",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>{r.label}</Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                {span} · {r.slots.length}
              </Text>
            </AnimatedPressable>

            {open && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 }}>
                {r.slots.map((s) => (
                  <View
                    key={s.start}
                    style={{
                      width: "31.5%",
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingVertical: 9,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.foreground }}>
                      {slotHHMM(s.start)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function ProCalendarScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const PLANNING = useMemo(() => getPlanning(colors), [colors]);
  const qc = useQueryClient();
  const router = useRouter();
  const showActionSheet = useActionSheet();
  const { showToast } = useToast();
  const { activePlan } = useRevenueCat();
  const { refreshNow: refreshLiveActivity } = useLiveActivity();
  const deepLinkParams = useLocalSearchParams<{ appointmentId?: string; date?: string }>();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Appointment[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery.trim(), 350);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<Unavailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [calendarSyncLoading, setCalendarSyncLoading] = useState(false);

  const [showAddSlot, setShowAddSlot] = useState(false);
  const [addingSlot, setAddingSlot] = useState(false);
  // Chantier design (lot a) — les outils « slots précréés » (legacy) sont repliés
  // derrière un dépliant tant que la pro n'a pas basculé sur le moteur. Filet le
  // temps de la migration ; à retirer avec les slots (backend 4.6b).
  const [showLegacyTools, setShowLegacyTools] = useState(false);
  const [showUnavailModal, setShowUnavailModal] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [editingAppt, setEditingAppt] = useState<EditableAppointment | null>(null);

  const [newSlotTime, setNewSlotTime] = useState("09:00");
  const [newSlotDuration, setNewSlotDuration] = useState(60);

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("09:00");
  const [editDur, setEditDur] = useState(60);

  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [planningSlots, setPlanningSlots] = useState<string[]>(["09:00", "14:00"]);
  const [weeklyPlanSaving, setWeeklyPlanSaving] = useState(false);
  const [weeklyPlanSuccess, setWeeklyPlanSuccess] = useState(false);
  const [showPlanTimePicker, setShowPlanTimePicker] = useState(false);
  const [newPlanTime, setNewPlanTime] = useState(new Date());

  const [slotError, setSlotError] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planningInfo, setPlanningInfo] = useState<string | null>(null);
  const [showDeleteSlotId, setShowDeleteSlotId] = useState<string | null>(null);
  const [showCancelAptId, setShowCancelAptId] = useState<number | null>(null);
  const [planConfirmWeeks, setPlanConfirmWeeks] = useState(4);
  const [planningDuration, setPlanningDuration] = useState(60);

  type ViewMode = "month" | "week";
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const toggleAnim = useRef(new Animated.Value(1)).current;

  const toggleViewMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.timing(toggleAnim, { toValue: 0.7, duration: 100, useNativeDriver: true }),
      Animated.spring(toggleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
    setViewMode((v) => (v === "month" ? "week" : "month"));
  }, [toggleAnim]);

  const selectedYear  = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const selectedDateStr = toLocalDate(selectedDate);

  // ── Chantier 4 : bascule vers le moteur de disponibilités ──────────────────
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const r = await proApi.getProfile();
      return r.success && r.data ? r.data : null;
    },
    staleTime: 60_000,
  });
  const useNewEngine = profile?.uses_availability_engine ?? false;

  const { data: workingHoursData } = useQuery({
    queryKey: ["working-hours"],
    queryFn: async () => {
      const r = await proApi.getWorkingHours();
      return r.success && r.data ? r.data : null;
    },
    staleTime: 60_000,
  });
  const hasWorkingHours = (workingHoursData?.days ?? []).some((d) => d.ranges.length > 0);
  // Bandeau de bascule : visible pour toute pro pas encore sur le moteur, tant
  // qu'elle n'a pas configuré ses horaires (l'enregistrement bascule le flag).
  const showBasculeBanner = !useNewEngine && !hasWorkingHours;

  // Prestation de référence pour interroger la dispo (la plus courte = granularité max).
  const { data: refServiceId } = useQuery({
    queryKey: ["ref-service"],
    enabled: useNewEngine,
    queryFn: async () => {
      const r = await proApi.getServices();
      const list = (r.success && Array.isArray(r.data)
        ? (r.data as { id: number; duration_minutes: number; active?: boolean }[])
        : []
      ).filter((s) => s.active !== false);
      if (list.length === 0) return null;
      return list.slice().sort((a, b) => (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0))[0].id;
    },
    staleTime: 60_000,
  });

  const { data: engineSlots, isLoading: engineSlotsLoading } = useQuery({
    queryKey: ["availability", "self", selectedDateStr, refServiceId],
    enabled: useNewEngine && !!refServiceId && !!profile,
    queryFn: async (): Promise<AvailabilitySlot[]> => {
      const r = await proApi.getAvailability({
        proId: profile!.id,
        serviceIds: [refServiceId!],
        fromDate: selectedDateStr,
        toDate: selectedDateStr,
      });
      return r.success && r.data ? (r.data.days.find((d) => d.date === selectedDateStr)?.slots ?? []) : [];
    },
  });

  const fetchMonthData = useCallback(async (year: number, month: number, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const to   = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
      const [calRes, unavailRes] = await Promise.all([
        proApi.getCalendar({ from, to }),
        proApi.getUnavailabilities(),
      ]);
      // A new appointment appearing here is already announced by the
      // backend's own "new_booking" push (richer copy, includes payment
      // info) — scheduling a second, differently-worded local notification
      // from this polling loop just duplicated it.
      if (calRes.success && calRes.data) setAppointments(calRes.data as Appointment[]);
      if (unavailRes.success && unavailRes.data) setUnavailabilities(unavailRes.data as Unavailability[]);
    } catch {
      // silent fail
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const fetchSlots = useCallback(async (dateStr: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setSlotsLoading(true);
    try {
      const res = await proApi.getSlots({ date: dateStr });
      if (res.success && res.data) setSlots((res.data as Record<string, unknown>[]).map(mapSlot));
    } catch {
      // silent
    } finally {
      if (!opts?.silent) setSlotsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMonthData(selectedYear, selectedMonth); }, [fetchMonthData, selectedYear, selectedMonth]);
  useEffect(() => {
    if (useNewEngine) return; // moteur : la dispo vient de getAvailability (useQuery), pas des slots
    void fetchSlots(selectedDateStr);
  }, [fetchSlots, selectedDateStr, useNewEngine]);

  // Search spans every reservation (past + future), not just the currently
  // loaded month — proApi.getCalendar() is always date-bounded, so this goes
  // through a dedicated search endpoint instead of filtering `appointments`.
  useEffect(() => {
    if (!debouncedSearchQuery) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    proApi.searchReservations(debouncedSearchQuery).then((res) => {
      if (cancelled) return;
      setSearchResults(res.success && res.data ? (res.data as Appointment[]) : []);
      setSearchLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setSearchResults([]);
        setSearchLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedSearchQuery]);

  // Deep link from the Live Activity / push notification (blyss://calendar
  // ?appointmentId=...&date=...) — jump to the right day, then flag if the
  // appointment turns out to no longer exist (cancelled between the tap and
  // the app opening) instead of failing silently.
  const deepLinkNavigatedRef = useRef(false);
  const deepLinkCheckedRef = useRef(false);
  useEffect(() => {
    if (deepLinkNavigatedRef.current) return;
    if (!deepLinkParams.date && !deepLinkParams.appointmentId) return;
    deepLinkNavigatedRef.current = true;
    if (deepLinkParams.date) {
      const parsed = new Date(deepLinkParams.date);
      if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
    }
  }, [deepLinkParams.date, deepLinkParams.appointmentId]);

  useEffect(() => {
    if (!deepLinkParams.appointmentId || deepLinkCheckedRef.current || loading) return;
    const id = parseInt(deepLinkParams.appointmentId, 10);
    if (isNaN(id)) return;
    deepLinkCheckedRef.current = true;
    if (!appointments.some((a) => a.id === id)) {
      showToast("Ce rendez-vous n'est plus disponible", "error");
    }
  }, [deepLinkParams.appointmentId, appointments, loading, showToast]);

  // Sync Apple Calendar — indépendant du mois affiché à l'écran : on regarde
  // toujours 180 jours devant aujourd'hui, pas la plage du calendrier visible.
  const runCalendarSync = useCallback(async () => {
    if (!(await isCalendarSyncEnabled())) return;
    const from = toLocalDate(new Date());
    const to = toLocalDate(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
    try {
      const res = await proApi.getCalendar({ from, to });
      if (!res.success || !res.data) return;
      const apts = res.data as Appointment[];
      await syncAppointmentsToCalendar(
        apts.map((a) => ({
          id: a.id,
          date: toLocalDate(new Date(a.date)),
          time: a.time,
          duration: parseDuration(a.duration),
          status: a.status,
          clientName: a.client_name ?? `${a.client_first_name ?? ""} ${a.client_last_name ?? ""}`.trim(),
          prestationName: a.prestation_name,
        }))
      );
    } catch {
      // silent — un cycle raté sera rattrapé au suivant
    }
  }, []);

  useEffect(() => { void isCalendarSyncEnabled().then(setCalendarSyncEnabled); }, []);
  useEffect(() => { if (calendarSyncEnabled) void runCalendarSync(); }, [calendarSyncEnabled, runCalendarSync]);

  const toggleCalendarSync = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!calendarSyncEnabled && !hasPlanAtLeast(activePlan, "signature")) {
      router.push({ pathname: "/(pro)/(profile)/upgrade", params: { requiredPlan: "signature" } });
      return;
    }
    setCalendarSyncLoading(true);
    try {
      if (calendarSyncEnabled) {
        await disableCalendarSync();
        setCalendarSyncEnabled(false);
      } else {
        const result = await enableCalendarSync();
        if (result.ok) {
          setCalendarSyncEnabled(true);
        } else {
          showToast(result.error ?? "Impossible d'activer la synchronisation", "error");
        }
      }
    } finally {
      setCalendarSyncLoading(false);
    }
  }, [calendarSyncEnabled, showToast, activePlan, router]);

  // Background polling — silent so it doesn't blank the lists / shift scroll every 30s
  useEffect(() => {
    const id = setInterval(() => {
      void fetchMonthData(selectedYear, selectedMonth, { silent: true });
      void fetchSlots(selectedDateStr, { silent: true });
      void runCalendarSync();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchMonthData, fetchSlots, selectedYear, selectedMonth, selectedDateStr, runCalendarSync]);

  // Refresh instantly when a push notification arrives (new booking, etc.)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      void fetchMonthData(selectedYear, selectedMonth, { silent: true });
      void fetchSlots(selectedDateStr, { silent: true });
    });
    return () => sub.remove();
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

  // Day-scoped list (used when no search query)
  const dayAppointments = useMemo(
    () => appointments.filter((a) => toLocalDate(new Date(a.date)) === toLocalDate(selectedDate)),
    [appointments, selectedDate]
  );

  // Search results, split into "à venir" and "déjà eu lieu" — spans every
  // reservation for the matching client(s)/prestation, not just the
  // currently loaded month (see the debounced fetch effect above).
  const searchSections = useMemo(() => {
    if (!searchQuery.trim() || searchResults === null) return null;

    const groupByDate = (list: Appointment[], sortDir: 1 | -1) => {
      const byDate: Record<string, Appointment[]> = {};
      for (const a of list) {
        const key = toLocalDate(new Date(a.date));
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(a);
      }
      return Object.entries(byDate).sort(([a], [b]) => sortDir * a.localeCompare(b));
    };

    const isPast = (a: Appointment) =>
      ["completed", "cancelled", "no_show", "past_pending"].includes(getAptStatus(a));

    return {
      upcoming: groupByDate(searchResults.filter((a) => !isPast(a)), 1),
      past: groupByDate(searchResults.filter(isPast), -1),
      total: searchResults.length,
    };
  }, [searchQuery, searchResults]);

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
    setAddingSlot(true);
    try {
      const res = await proApi.createSlot({ date, time: newSlotTime, duration: newSlotDuration });
      if (!res.success) throw new Error(res.error);
      await fetchSlots(selectedDateStr);
      setShowAddSlot(false);
    } catch (e) {
      setSlotError(e instanceof Error && e.message ? e.message : "Impossible d'ajouter le créneau");
    } finally {
      setAddingSlot(false);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelectedApt(null);
    setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "completed" } : a));
    try {
      // apiCall() ne rejette jamais — sans vérifier res.success, un échec métier
      // laissait le statut "terminé" affiché sans jamais revenir en arrière,
      // et sans qu'aucune erreur ne soit montrée à la pro.
      const res = await proApi.updateReservationStatus(apt.id, "completed");
      if (!res.success) throw new Error(res.error);
      void runCalendarSync();
      refreshLiveActivity();
    } catch {
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: apt.status } : a));
      showToast("Impossible de marquer ce rendez-vous comme terminé", "error");
    }
  };

  const handleCancel = async (apt: Appointment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setSelectedApt(null);
    setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "cancelled" } : a));
    try {
      const res = await proApi.updateReservationStatus(apt.id, "cancelled");
      if (!res.success) throw new Error(res.error);
      void runCalendarSync();
      refreshLiveActivity();
    } catch {
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: apt.status } : a));
      showToast("Impossible d'annuler ce rendez-vous", "error");
    }
  };

  const openEditAppointment = (apt: Appointment) => {
    const aptDate = new Date(apt.date);
    const [h, m] = String(apt.time).split(":");
    aptDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    setEditingAppt({
      id: apt.id,
      clientLabel: apt.client_name ?? `${apt.client_first_name ?? ""} ${apt.client_last_name ?? ""}`.trim(),
      prestationId: null,
      date: aptDate,
      durationMinutes: parseDuration(apt.duration),
    });
    setSelectedApt(null);
    setShowNewAppt(true);
  };

  const handleAppointmentSaved = (info?: {
    proposalSent?: boolean;
    overrideApplied?: "outside_hours" | "conflict" | null;
  }) => {
    void fetchMonthData(selectedYear, selectedMonth, { silent: true });
    if (useNewEngine) void qc.invalidateQueries({ queryKey: ["availability"] });
    else void fetchSlots(selectedDateStr, { silent: true });
    // Un report proposé par la pro ne modifie pas le RDV tant que la cliente
    // n'a pas accepté — le refetch ci-dessus continuera donc d'afficher
    // l'horaire d'origine, ce qui est le comportement attendu.
    let message: string;
    if (info?.proposalSent) {
      message = "Proposition envoyée à la cliente, en attente de confirmation";
    } else if (editingAppt) {
      message = "Rendez-vous modifié";
    } else if (info?.overrideApplied === "conflict") {
      message = "RDV ajouté malgré un conflit — pense à prévenir la cliente concernée";
    } else if (info?.overrideApplied === "outside_hours") {
      message = "RDV ajouté hors de tes horaires d'ouverture";
    } else {
      message = "Rendez-vous ajouté";
    }
    showToast(message, "success");
  };

  const handleNoShow = async (apt: Appointment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedApt(null);
    setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "no_show" } : a));
    try {
      const res = await nailTechApi.markNoShow(apt.id);
      if (!res.success) throw new Error(res.error);
      void runCalendarSync();
      refreshLiveActivity();
    } catch {
      setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: apt.status } : a));
      showToast("Impossible de marquer cette absence", "error");
    }
  };


  // Planning "semaine type" = génération en masse de slots précréés. N'a de sens
  // qu'en mode legacy (useNewEngine === false) : avec le moteur, les créneaux
  // découlent des working_hours.
  // TODO 4.6 — supprimer applyWeeklyPlanning / doApplyWeeklyPlanning / la modale
  // quand les slots legacy seront retirés.
  const applyWeeklyPlanning = () => {
    if (activeDays.length === 0 || planningSlots.length === 0) return;

    const MAX_SLOTS_PER_DAY = 5;

    setPlanningError(null);
    if (planningSlots.length > MAX_SLOTS_PER_DAY) {
      setPlanningError(`Le planning est limité à ${MAX_SLOTS_PER_DAY} créneaux par jour. Retire les créneaux en trop avant de continuer.`);
      return;
    }

    const totalSlots = activeDays.length * planConfirmWeeks * planningSlots.length;
    const weeks = planConfirmWeeks;
    showActionSheet(
      {
        title: "Confirmer le planning",
        message: `${totalSlots} créneaux sur ${weeks} semaines (${activeDays.length} jour${activeDays.length > 1 ? "s" : ""} × ${planningSlots.length} créneau${planningSlots.length > 1 ? "x" : ""}/jour · ${formatDuration(planningDuration)}). Les créneaux déjà existants ou passés seront ignorés.`,
        options: ["Annuler", "Appliquer"],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx === 1) {
          setShowPlanningModal(false);
          void doApplyWeeklyPlanning(weeks);
        }
      }
    );
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
              proApi.createSlot({ date, time, duration: planningDuration }).catch(() => null)
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

  const aptStatusKey = selectedApt ? getAptStatus(selectedApt) : "pending";
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);

  const selectedDateLabel = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
      {/* ── HEADER ── */}
      <View style={{ paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
              Agenda
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 1, textTransform: "capitalize" }}>
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <AnimatedPressable
              onPress={() => {
                const t = new Date();
                setSelectedDate(t);
                setCurrentDate(new Date(t.getFullYear(), t.getMonth(), 1));
              }}
              style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...Shadows.card }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>Auj.</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => {
                setIsSearchOpen((v) => {
                  if (v) setSearchQuery("");
                  return !v;
                });
              }}
              accessibilityLabel={isSearchOpen ? "Fermer la recherche" : "Rechercher"}
              accessibilityState={{ checked: isSearchOpen }}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", ...Shadows.card }}
            >
              <Ionicons name={isSearchOpen ? "close" : "search-outline"} size={18} color={colors.foreground} />
            </AnimatedPressable>
            <Pressable
              onPress={toggleViewMode}
              accessibilityLabel={viewMode === "month" ? "Passer à la vue semaine" : "Passer à la vue mois"}
              accessibilityRole="button"
              accessibilityState={{ checked: viewMode === "week" }}
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: viewMode === "week" ? colors.primary : colors.white,
                alignItems: "center", justifyContent: "center",
                ...Shadows.card,
              }}
            >
              <Animated.View style={{ transform: [{ scale: toggleAnim }] }}>
                <Ionicons
                  name={viewMode === "month" ? "calendar-outline" : "grid-outline"}
                  size={18}
                  color={viewMode === "week" ? colors.onColor : colors.foreground}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        {isSearchOpen && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, height: 44, ...Shadows.card, marginTop: 8 }}>
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher une cliente, une prestation…"
              placeholderTextColor={colors.mutedForeground}
              style={{ flex: 1, fontSize: 14, color: colors.foreground }}
              autoFocus
            />
          </View>
        )}
      </View>

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
          <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 16, ...Shadows.card, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <AnimatedIconButton
                onPress={() => {
                  const p = new Date(selectedDate);
                  p.setDate(p.getDate() - 7);
                  handleSelectDate(p);
                }}
                accessibilityLabel="Semaine précédente"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              </AnimatedIconButton>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }}>
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
                accessibilityLabel="Semaine suivante"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
              </AnimatedIconButton>
            </View>

            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: 6 }, (_, i) => {
                const base = new Date(selectedDate);
                base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + i);
                const baseKey  = toLocalDate(base);
                const isActive = baseKey === toLocalDate(selectedDate);
                const isToday  = baseKey === toLocalDate(new Date());
                const hasApt   = appointments.some(a => toLocalDate(new Date(a.date)) === baseKey);
                const isUnavail = unavailabilities.some(u => baseKey >= u.start_date && baseKey <= u.end_date);
                return (
                  <AnimatedPressable
                    key={i}
                    onPress={() => handleSelectDate(new Date(base))}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 14,
                      backgroundColor: isActive
                        ? colors.primary
                        : isUnavail
                          ? colors.muted
                          : isToday
                            ? withAlpha(colors.primary, 0.10)
                            : "transparent" }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "700",
                      color: isActive ? colors.onColor : colors.mutedForeground,
                      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                      {["L","M","M","J","V","S"][i]}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: "800",
                      color: isActive ? colors.onColor : isUnavail ? colors.mutedForeground : isToday ? colors.primary : colors.foreground }}>
                      {base.getDate()}
                    </Text>
                    {hasApt && !isUnavail && (
                      <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3,
                        backgroundColor: isActive ? colors.white : colors.primary }} />
                    )}
                    {isUnavail && (
                      <View style={{ width: 18, height: 3, borderRadius: 2, marginTop: 2,
                        backgroundColor: isActive ? withAlpha(colors.white, 0.8) : colors.mutedForeground }} />
                    )}
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── APPLE CALENDAR SYNC ── */}
        {Platform.OS === "ios" && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 12,
            backgroundColor: colors.white, borderRadius: 16, padding: 14,
            marginBottom: 16, ...Shadows.card,
          }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Synchro Apple Calendar</Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1, lineHeight: 15 }}>
                Tes rendez-vous Blyss dans ton calendrier iPhone
              </Text>
            </View>
            {calendarSyncLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={calendarSyncEnabled}
                onValueChange={() => void toggleCalendarSync()}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.onColor}
              />
            )}
          </View>
        )}

        {/* ── PLANNING & ABSENCES CARDS ── */}
        {/* Même grille pour les deux : la zone de sous-titre réserve 2 lignes
            (minHeight) pour que les cartes aient la même hauteur et des bas
            alignés, que le libellé tienne sur 1 ou 2 lignes. */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "stretch" }}>
          {([
            { icon: "time-outline", title: "Horaires", sub: "Tes horaires d'ouverture", onPress: () => router.push("/pro-working-hours" as never) },
            { icon: "moon-outline", title: "Absences", sub: "Journées et plages bloquées", onPress: () => setShowUnavailModal(true) },
          ] as const).map((c) => (
            <AnimatedPressable
              key={c.title}
              onPress={c.onPress}
              style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.border, ...Shadows.card }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(colors.primary, 0.1), alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={c.icon} size={20} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }}>{c.title}</Text>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 15, minHeight: 30 }}>{c.sub}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {/* ── SELECTED DAY LABEL ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingHorizontal: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground, textTransform: "capitalize" }}>
              {selectedDateLabel}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <AnimatedPressable
              onPress={() => { setEditingAppt(null); setShowNewAppt(true); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.pro, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Ionicons name="person-add-outline" size={14} color={colors.onColor} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onColor }}>RDV</Text>
            </AnimatedPressable>
            {!useNewEngine && showLegacyTools && (
              <AnimatedPressable
                onPress={() => setShowAddSlot(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Ionicons name="add" size={16} color={colors.onColor} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onColor }}>Créneau</Text>
              </AnimatedPressable>
            )}
          </View>
        </View>

        {/* ── ABSENCE BANNER ── */}
        {unavailabilities.some((u) => selectedDateStr >= u.start_date && selectedDateStr <= u.end_date) && (
          <View style={{ backgroundColor: colors.warningLight, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, borderWidth: 1, borderColor: colors.warningBorder }}>
            <Ionicons name="moon" size={16} color={colors.warningText} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.warningTextDark }}>Tu es absente ce jour</Text>
              <Text style={{ fontSize: 11, color: colors.warningText, marginTop: 2 }}>Tes clientes ne peuvent pas réserver pour cette date</Text>
            </View>
            <AnimatedPressable onPress={() => setShowUnavailModal(true)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.warningBorder }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.warningTextDark }}>Gérer</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* ── CARTE DE BASCULE — gestion des horaires ── */}
        {showBasculeBanner && (
          <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 10, ...Shadows.card }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-outline" size={22} color={colors.foreground} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>
              Passe à la nouvelle gestion de tes horaires
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19, textAlign: "center" }}>
              Configure tes horaires d'ouverture une fois : tes créneaux réservables sont ensuite calculés automatiquement.
            </Text>
            <AnimatedPressable
              onPress={() => router.push("/pro-working-hours" as never)}
              style={{ alignSelf: "stretch", backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 2 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onColor }}>Configurer mes horaires</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* ── SLOTS ── */}
        {useNewEngine ? (
          engineSlotsLoading ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : !refServiceId ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, marginBottom: 16, gap: 6 }}>
              <Ionicons name="pricetag-outline" size={36} color={colors.border} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Aucune prestation active</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>Ajoute une prestation pour voir tes créneaux disponibles.</Text>
            </View>
          ) : (engineSlots ?? []).length === 0 ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, marginBottom: 16, gap: 6 }}>
              <Ionicons name="time-outline" size={36} color={colors.border} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Aucun créneau libre ce jour</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>Selon tes horaires d'ouverture et tes absences.</Text>
            </View>
          ) : (
            <FreeSlotsCard slots={engineSlots ?? []} />
          )
        ) : (
          <>
            <AnimatedPressable
              onPress={() => setShowLegacyTools((v) => !v)}
              accessibilityLabel="Gérer mes anciens créneaux"
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}
            >
              <Ionicons name="construct-outline" size={15} color={colors.foreground} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: colors.foreground }}>Gérer mes anciens créneaux</Text>
              <Ionicons name={showLegacyTools ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </AnimatedPressable>
            {showLegacyTools && (
              <View style={{ marginBottom: 16, gap: 10 }}>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 15 }}>
                  Ces créneaux précréés ne servent plus une fois tes horaires d&apos;ouverture configurés. En attendant, tu peux encore les gérer ici.
                </Text>
                <AnimatedPressable
                  onPress={() => setShowPlanningModal(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
                >
                  <Ionicons name="calendar-number-outline" size={14} color={colors.foreground} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>Planning semaine type</Text>
                </AnimatedPressable>
                {slotsLoading ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : slots.length === 0 ? (
                  <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, gap: 6 }}>
                    <Ionicons name="time-outline" size={36} color={colors.border} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Aucun créneau ce jour</Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>Appuie sur « + Créneau » pour en ajouter</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.white, borderRadius: 16, overflow: "hidden", ...Shadows.card }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
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
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isEditing ? withAlpha(colors.primary, 0.05) : undefined }}>
                    {isEditing ? (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              {QUICK_TIMES.map((t) => (
                                <AnimatedPressable
                                  key={t}
                                  onPress={() => setEditTime(t)}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 10,
                                    backgroundColor: editTime === t ? colors.primary : colors.muted,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: "600", color: editTime === t ? colors.onColor : colors.foreground }}>
                                    {t}
                                  </Text>
                                </AnimatedPressable>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {[30, 45, 60, 90, 120].map((d) => (
                            <AnimatedPressable
                              key={d}
                              onPress={() => setEditDur(d)}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: editDur === d ? colors.primary : colors.muted }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "600", color: editDur === d ? colors.onColor : colors.foreground }}>
                                {formatDuration(d)}
                              </Text>
                            </AnimatedPressable>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <AnimatedPressable
                            onPress={() => setEditingSlotId(null)}
                            style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Annuler</Text>
                          </AnimatedPressable>
                          <AnimatedPressable
                            onPress={confirmEditSlot}
                            style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onColor }}>Confirmer</Text>
                          </AnimatedPressable>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: slot.isPast ? colors.border : isBooked ? colors.info : isOpen ? colors.primary : colors.mutedForeground,
                          }} />
                          <View>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: slot.isPast ? colors.mutedForeground : colors.foreground }}>
                              {slot.time} – {endTime}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
                              {formatDuration(parseDuration(slot.duration))}
                              {" · "}
                              <Text style={{ color: isBooked ? colors.info : isOpen ? colors.primary : colors.mutedForeground }}>
                                {slot.isPast ? "Passé" : isBooked ? "Réservé" : isOpen ? "Ouvert" : "Bloqué"}
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {!slot.isPast && !isBooked && (
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <AnimatedPressable
                              onPress={() => toggleSlot(slot.id)}
                              accessibilityLabel={isOpen ? "Bloquer le créneau" : "Ouvrir le créneau"}
                              accessibilityState={{ checked: isOpen }}
                              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isOpen ? withAlpha(colors.primary, 0.10) : colors.muted, alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name={isOpen ? "lock-open-outline" : "lock-closed-outline"} size={16} color={isOpen ? colors.primary : colors.mutedForeground} />
                            </AnimatedPressable>
                            <AnimatedPressable
                              onPress={() => {
                                setEditTime(slot.time);
                                setEditDur(parseDuration(slot.duration));
                                setEditingSlotId(slot.id);
                              }}
                              accessibilityLabel="Modifier le créneau"
                              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name="pencil-outline" size={16} color={colors.mutedForeground} />
                            </AnimatedPressable>
                            <AnimatedPressable
                              onPress={() => setShowDeleteSlotId(slot.id)}
                              accessibilityLabel="Supprimer le créneau"
                              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.destructiveLight, alignItems: "center", justifyContent: "center" }}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                            </AnimatedPressable>
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
              </View>
            )}
          </>
        )}

        {/* ── APPOINTMENTS ── */}
        {searchSections ? (
          /* Search results — every reservation for the match, split "à venir" / "déjà eu lieu" */
          searchLoading && searchSections.total === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : searchSections.total === 0 ? (
            <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, gap: 6 }}>
              <Ionicons name="search-outline" size={36} color={colors.border} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Aucun résultat</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>Essaie un autre prénom ou prestation</Text>
            </View>
          ) : (
            <View style={{ gap: 24 }}>
              <SearchResultSection
                title="À venir"
                icon="calendar-outline"
                groups={searchSections.upcoming}
                onSelectDate={handleSelectDate}
                onSelectApt={setSelectedApt}
              />
              <SearchResultSection
                title="Déjà eu lieu"
                icon="checkmark-done-outline"
                groups={searchSections.past}
                onSelectDate={handleSelectDate}
                onSelectApt={setSelectedApt}
              />
            </View>
          )
        ) : (
          /* Day-scoped list */
          <>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingHorizontal: 2 }}>
              Rendez-vous ({dayAppointments.length})
            </Text>
            {loading ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : dayAppointments.length === 0 ? (
              <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 24, alignItems: "center", ...Shadows.card, gap: 6 }}>
                <Ionicons name="calendar-outline" size={36} color={colors.border} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Aucun rendez-vous</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>Tes clientes pourront réserver via les créneaux ouverts</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {dayAppointments.map((apt) => (
                  <AptCard key={apt.id} apt={apt} onPress={() => { const canAct = ["pending","ongoing","past_pending"].includes(getAptStatus(apt)); if (canAct) setSelectedApt(apt); }} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── ADD SLOT MODAL ── */}
      <RNModal visible={showAddSlot} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowAddSlot(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight }} onPress={() => setShowAddSlot(false)} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: colors.white,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: insets.bottom + 16,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

          <View style={{ backgroundColor: withAlpha(colors.primary, 0.06), paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.primary, 0.12) }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: withAlpha(colors.primary, 0.10), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground }}>Nouveau créneau</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1, textTransform: "capitalize" }}>{selectedDateLabel}</Text>
                </View>
              </View>
              <AnimatedIconButton
                onPress={() => setShowAddSlot(false)}
                accessibilityLabel="Fermer"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(colors.primary, 0.08), alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={colors.primary} />
              </AnimatedIconButton>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 20, paddingBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Heure de début
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {QUICK_TIMES.map((t) => (
                    <AnimatedPressable
                      key={t}
                      onPress={() => setNewSlotTime(t)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                        backgroundColor: newSlotTime === t ? colors.primary : colors.muted,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: newSlotTime === t ? colors.onColor : colors.foreground }}>
                        {t}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                Durée
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[30, 45, 60, 75, 90, 120].map((d) => (
                  <AnimatedPressable
                    key={d}
                    onPress={() => setNewSlotDuration(d)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: newSlotDuration === d ? colors.primary : colors.muted,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: newSlotDuration === d ? colors.onColor : colors.foreground }}>
                      {formatDuration(d)}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                Créneau de{" "}
                <Text style={{ fontWeight: "700", color: colors.foreground }}>{newSlotTime}</Text>
                {" "}à{" "}
                <Text style={{ fontWeight: "700", color: colors.foreground }}>
                  {(() => {
                    const end = timeToMin(newSlotTime) + newSlotDuration;
                    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                  })()}
                </Text>
                {" · "}{formatDuration(newSlotDuration)}
              </Text>
            </View>

            {slotError && <View style={{ marginBottom: 4 }}><ErrorMessage message={slotError} /></View>}
            <AnimatedPressable
              onPress={addSlot}
              disabled={addingSlot}
              style={{ height: 56, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: addingSlot ? 0.7 : 1 }}
            >
              {addingSlot
                ? <ActivityIndicator color={colors.onColor} />
                : <Text style={{ fontSize: 15, fontWeight: "700", color: colors.onColor }}>Créer ce créneau</Text>}
            </AnimatedPressable>
          </View>
        </View>
      </RNModal>

      {/* ── APPOINTMENT ACTIONS MODAL ── */}
      <RNModal visible={selectedApt != null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSelectedApt(null)}>
        {selectedApt && (
          <>
            <Pressable style={{ flex: 1, backgroundColor: colors.overlayLight }} onPress={() => setSelectedApt(null)} />
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: colors.white,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingBottom: insets.bottom + 16,
            }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

              <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <StatusBadge statusKey={aptStatusKey} variant="pill" />
                      {selectedApt.price != null && (
                        <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>
                          {Number(selectedApt.price).toFixed(2).replace(".", ",")} €
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground }}>
                      {selectedApt.client_name ?? `${selectedApt.client_first_name ?? ""} ${selectedApt.client_last_name ?? ""}`.trim()}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 3 }}>
                      {selectedApt.time}
                      {selectedApt.duration ? ` · ${formatDuration(parseDuration(selectedApt.duration))}` : ""}
                      {selectedApt.prestation_name ? ` · ${selectedApt.prestation_name}` : ""}
                    </Text>
                  </View>
                  <AnimatedIconButton
                    onPress={() => setSelectedApt(null)}
                    accessibilityLabel="Fermer"
                    style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={18} color={colors.foreground} />
                  </AnimatedIconButton>
                </View>
              </View>

              <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}>
                {["pending", "ongoing", "past_pending"].includes(getAptStatus(selectedApt)) && (
                  <>
                    <AnimatedPressable
                      onPress={() => handleComplete(selectedApt)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(colors.successText, 0.12), alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark-circle-outline" size={22} color={colors.successText} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.successText }}>Marquer comme terminé</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>Le rendez-vous est bien passé</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </AnimatedPressable>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                  </>
                )}

                {getAptStatus(selectedApt) === "past_pending" && (
                  <>
                    <AnimatedPressable
                      onPress={() => handleNoShow(selectedApt)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(colors.warning, 0.12), alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="person-remove-outline" size={22} color={colors.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.warningText }}>Cliente non venue</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>Enregistrer l'absence</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </AnimatedPressable>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                  </>
                )}

                {getAptStatus(selectedApt) === "pending" && (
                  <>
                    <AnimatedPressable
                      onPress={() => openEditAppointment(selectedApt)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(colors.pro, 0.12), alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="create-outline" size={22} color={colors.pro} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Modifier le rendez-vous</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>Changer la date, l'heure ou la prestation</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </AnimatedPressable>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                  </>
                )}

                {getAptStatus(selectedApt) === "pending" && (
                  <AnimatedPressable
                    onPress={() => setShowCancelAptId(selectedApt.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: withAlpha(colors.destructive, 0.10), alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="close-circle-outline" size={22} color={colors.destructive} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.destructive }}>Annuler le rendez-vous</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>La cliente sera notifiée</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.destructive} />
                  </AnimatedPressable>
                )}
              </View>
            </View>
          </>
        )}
      </RNModal>

      {/* ── ABSENCES (bottom-sheet extrait) ── */}
      <AbsenceSheet
        visible={showUnavailModal}
        onClose={() => setShowUnavailModal(false)}
        unavailabilities={unavailabilities}
        onChanged={setUnavailabilities}
        loading={loading}
      />

      {/* ── WEEKLY PLANNING MODAL (legacy uniquement) ── */}
      {/* TODO 4.6 — à supprimer avec les slots legacy. Jamais ouverte en mode
          moteur : la carte "Planning" pointe alors vers pro-working-hours. */}
      <Modal visible={showPlanningModal} onClose={() => setShowPlanningModal(false)} bottomSheet noPadding maxHeight="90%">
        <View style={{ overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28, flex: 1 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

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
              <AnimatedIconButton
                onPress={() => setShowPlanningModal(false)}
                accessibilityLabel="Fermer"
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: PLANNING.closeBg, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={PLANNING.colorDark} />
              </AnimatedIconButton>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, gap: 20 }}>
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                Durée de chaque créneau
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[30, 45, 60, 75, 90, 120].map((d) => (
                  <AnimatedPressable
                    key={d}
                    onPress={() => setPlanningDuration(d)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: planningDuration === d ? colors.primary : colors.muted }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: planningDuration === d ? colors.onColor : colors.foreground }}>
                      {formatDuration(d)}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                Nombre de semaines
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[2, 4, 6, 8].map((w) => (
                  <AnimatedPressable
                    key={w}
                    onPress={() => setPlanConfirmWeeks(w)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                      backgroundColor: planConfirmWeeks === w ? PLANNING.color : colors.muted }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700",
                      color: planConfirmWeeks === w ? colors.onColor : colors.mutedForeground }}>
                      {w} sem.
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                Jours actifs
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DAYS_SHORT.map((d, idx) => {
                  const dayNum = idx + 1;
                  const isActive = activeDays.includes(dayNum);
                  return (
                    <AnimatedPressable
                      key={d}
                      onPress={() =>
                        setActiveDays((prev) =>
                          isActive ? prev.filter((n) => n !== dayNum) : [...prev, dayNum].sort()
                        )
                      }
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                        backgroundColor: isActive ? PLANNING.color : colors.muted,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isActive ? colors.onColor : colors.mutedForeground }}>
                        {d}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
                    Horaires de début
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>Durée par défaut : 1h</Text>
                </View>
                <AnimatedPressable
                  onPress={() => setShowPlanTimePicker(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: PLANNING.bg, borderRadius: 10, borderWidth: 1, borderColor: PLANNING.border }}
                >
                  <Ionicons name="add" size={14} color={PLANNING.color} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: PLANNING.color }}>Ajouter</Text>
                </AnimatedPressable>
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
                    themeVariant={isDark ? "dark" : "light"}
                    accentColor={PLANNING.color}
                  />
                  {Platform.OS === "ios" && (
                    <AnimatedPressable
                      onPress={() => {
                        const h = String(newPlanTime.getHours()).padStart(2, "0");
                        const m = String(newPlanTime.getMinutes()).padStart(2, "0");
                        const t = `${h}:${m}`;
                        if (!planningSlots.includes(t)) setPlanningSlots((prev) => [...prev, t].sort());
                        setShowPlanTimePicker(false);
                      }}
                      style={{ margin: 12, height: 44, borderRadius: 12, backgroundColor: PLANNING.color, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Confirmer</Text>
                    </AnimatedPressable>
                  )}
                </View>
              )}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {planningSlots.map((t) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: PLANNING.bg, borderRadius: 10, borderWidth: 1, borderColor: PLANNING.border }}>
                    <Ionicons name="time-outline" size={13} color={PLANNING.color} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: PLANNING.colorDark }}>{t}</Text>
                    <AnimatedIconButton onPress={() => setPlanningSlots((prev) => prev.filter((s) => s !== t))} accessibilityLabel="Supprimer cet horaire">
                      <Ionicons name="close-circle" size={16} color={PLANNING.color} />
                    </AnimatedIconButton>
                  </View>
                ))}
                {planningSlots.length === 0 && (
                  <View style={{ backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, width: "100%" }}>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Aucun horaire — appuie sur Ajouter</Text>
                  </View>
                )}
              </View>
            </View>

            {activeDays.length > 0 && planningSlots.length > 0 && (
              <View style={{ backgroundColor: PLANNING.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: PLANNING.border }}>
                <Text style={{ fontSize: 12, color: PLANNING.colorDark, fontWeight: "600", lineHeight: 18 }}>
                  {activeDays.length * planConfirmWeeks * planningSlots.length} créneaux · {activeDays.length} jour{activeDays.length > 1 ? "s" : ""} × {planningSlots.length} horaire{planningSlots.length > 1 ? "s" : ""} × {planConfirmWeeks} semaines · {formatDuration(planningDuration)}/créneau
                </Text>
              </View>
            )}

          </ScrollView>

          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
            {weeklyPlanSuccess && (
              <View style={{ backgroundColor: withAlpha(colors.successText, 0.10), borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: PLANNING.border }}>
                <Ionicons name="checkmark-circle" size={18} color={PLANNING.color} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: PLANNING.colorDark }}>Planning appliqué avec succès</Text>
              </View>
            )}
            {planningError && <ErrorMessage message={planningError} />}
            {planningInfo && (
              <View style={{ backgroundColor: withAlpha(colors.successText, 0.08), borderRadius: 12, padding: 10, borderWidth: 1, borderColor: PLANNING.border }}>
                <Text style={{ fontSize: 12, color: PLANNING.colorDark, fontWeight: "600" }}>{planningInfo}</Text>
              </View>
            )}
            <LoadingButton
              loading={weeklyPlanSaving}
              onPress={applyWeeklyPlanning}
              disabled={activeDays.length === 0 || planningSlots.length === 0}
              label="Appliquer le planning"
              style={{ backgroundColor: (activeDays.length === 0 || planningSlots.length === 0) ? colors.disabled : PLANNING.color }}
            />
          </View>
        </View>
      </Modal>

      {/* ── DELETE SLOT CONFIRM ── */}
      <RNModal visible={showDeleteSlotId != null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowDeleteSlotId(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 24, width: "100%", gap: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>Supprimer ce créneau ?</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center" }}>Cette action est irréversible.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AnimatedPressable onPress={() => setShowDeleteSlotId(null)} style={{ flex: 1, height: 48, borderRadius: 13, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Annuler</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { if (showDeleteSlotId) void deleteSlot(showDeleteSlotId); }}
                style={{ flex: 1, height: 48, borderRadius: 13, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Supprimer</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* ── CANCEL APT CONFIRM ── */}
      <RNModal visible={showCancelAptId != null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShowCancelAptId(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlayDark }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowCancelAptId(null)} />
          <View style={{ backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, textAlign: "center", marginBottom: 8 }}>Annuler le rendez-vous ?</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 20 }}>Cette action est irréversible. La cliente sera notifiée.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <AnimatedPressable onPress={() => setShowCancelAptId(null)} style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Retour</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  const apt = appointments.find((a) => a.id === showCancelAptId);
                  if (apt) { setShowCancelAptId(null); void handleCancel(apt); }
                }}
                style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Annuler le RDV</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </RNModal>

      {/* ── NEW / EDIT APPOINTMENT SHEET ── */}
      <NewAppointmentSheet
        visible={showNewAppt}
        onClose={() => { setShowNewAppt(false); setEditingAppt(null); }}
        onSaved={handleAppointmentSaved}
        editing={editingAppt}
      />

    </View>
  );
}
