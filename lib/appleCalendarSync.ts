import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CALENDAR_TITLE = "Blyss";
const ENABLED_KEY = "apple_calendar_sync_enabled";
const CALENDAR_ID_KEY = "apple_calendar_id";
const EVENT_MAP_KEY = "apple_calendar_event_map";

export interface SyncableAppointment {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutes
  status: string;
  clientName: string;
  prestationName?: string | null;
}

type EventMap = Record<string, string>; // reservationId -> device event id

async function getEventMap(): Promise<EventMap> {
  const raw = await AsyncStorage.getItem(EVENT_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function setEventMap(map: EventMap): Promise<void> {
  await AsyncStorage.setItem(EVENT_MAP_KEY, JSON.stringify(map));
}

export async function isCalendarSyncEnabled(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return (await AsyncStorage.getItem(ENABLED_KEY)) === "true";
}

async function findOrCreateBlyssCalendar(): Promise<string> {
  const cached = await AsyncStorage.getItem(CALENDAR_ID_KEY);
  if (cached) {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.some((c) => c.id === cached)) return cached;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === CALENDAR_TITLE && c.allowsModifications);
  if (existing) {
    await AsyncStorage.setItem(CALENDAR_ID_KEY, existing.id);
    return existing.id;
  }

  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  const defaultSource = defaultCalendar.source;

  const id = await Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: "#FE5D9D",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: (defaultSource as any).id,
    source: defaultSource as any,
    name: CALENDAR_TITLE,
    ownerAccount: CALENDAR_TITLE,
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  await AsyncStorage.setItem(CALENDAR_ID_KEY, id);
  return id;
}

/** Demande la permission, crée/retrouve le calendrier "Blyss" et active la sync. */
export async function enableCalendarSync(): Promise<{ ok: boolean; error?: string }> {
  if (Platform.OS !== "ios") return { ok: false, error: "Disponible uniquement sur iOS." };

  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") {
    return { ok: false, error: "Accès au calendrier refusé. Active-le dans Réglages > Blyss." };
  }

  try {
    await findOrCreateBlyssCalendar();
  } catch {
    return { ok: false, error: "Impossible de créer le calendrier Blyss." };
  }

  await AsyncStorage.setItem(ENABLED_KEY, "true");
  return { ok: true };
}

/** Supprime tous les événements créés par Blyss + le calendrier dédié, puis désactive la sync. */
export async function disableCalendarSync(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, "false");
  const calendarId = await AsyncStorage.getItem(CALENDAR_ID_KEY);
  if (calendarId) {
    try {
      await Calendar.deleteCalendarAsync(calendarId);
    } catch {
      // calendrier déjà supprimé manuellement par l'utilisateur — pas bloquant
    }
  }
  await AsyncStorage.removeItem(CALENDAR_ID_KEY);
  await AsyncStorage.removeItem(EVENT_MAP_KEY);
}

const ACTIVE_STATUSES = new Set(["confirmed", "pending", "ongoing", "completed"]);

/**
 * Réconcilie les événements du calendrier "Blyss" avec la liste fournie —
 * sens unique Blyss → Apple Calendar. Crée/met à jour les rdv actifs, supprime
 * les événements dont la réservation a disparu (annulée) ou n'est plus active.
 */
export async function syncAppointmentsToCalendar(appointments: SyncableAppointment[]): Promise<void> {
  if (Platform.OS !== "ios") return;
  if (!(await isCalendarSyncEnabled())) return;

  let calendarId: string;
  try {
    calendarId = await findOrCreateBlyssCalendar();
  } catch {
    return;
  }

  const map = await getEventMap();
  const active = appointments.filter((a) => ACTIVE_STATUSES.has(a.status));
  const activeIds = new Set(active.map((a) => String(a.id)));

  // Supprime les événements dont la réservation n'est plus active/n'existe plus
  for (const [reservationId, eventId] of Object.entries(map)) {
    if (!activeIds.has(reservationId)) {
      try {
        await Calendar.deleteEventAsync(eventId);
      } catch {
        // événement déjà supprimé côté device — ignore
      }
      delete map[reservationId];
    }
  }

  for (const apt of active) {
    const startDate = new Date(`${apt.date}T${apt.time}:00`);
    const endDate = new Date(startDate.getTime() + apt.duration * 60_000);
    const title = apt.prestationName ? `${apt.prestationName} — ${apt.clientName}` : apt.clientName;

    const key = String(apt.id);
    const existingEventId = map[key];

    try {
      if (existingEventId) {
        await Calendar.updateEventAsync(existingEventId, { title, startDate, endDate });
      } else {
        const eventId = await Calendar.createEventAsync(calendarId, { title, startDate, endDate });
        map[key] = eventId;
      }
    } catch {
      // Un event orphelin (supprimé manuellement côté Calendar par exemple) —
      // on le recrée au prochain cycle plutôt que de bloquer tout le sync.
      delete map[key];
    }
  }

  await setEventMap(map);
}
