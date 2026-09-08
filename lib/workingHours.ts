import type { WorkingHoursDay } from "./api";

export const WORKING_HOURS_DAY_LABELS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

/** Ordre d'affichage : lundi → dimanche. */
export const WORKING_HOURS_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Créneaux d'heure sélectionnables (06:00 → 23:45, pas de 15 min). */
export const WORKING_HOURS_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

export function timeToMinutes(t: string): number {
  const [h, m] = String(t ?? "").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Miroir client de `validateWorkingHoursPayload` (backend) : renvoie le premier
 * message d'erreur, ou `null` si tout est valide. Bloque l'appel réseau avant
 * un 422.
 */
export function validateWorkingHours(days: WorkingHoursDay[]): string | null {
  for (const day of days) {
    const sorted = [...day.ranges].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    for (let i = 0; i < sorted.length; i++) {
      if (timeToMinutes(sorted[i].end_time) <= timeToMinutes(sorted[i].start_time)) {
        return `${WORKING_HOURS_DAY_LABELS[day.weekday]} : une plage doit finir après son début.`;
      }
      if (i > 0 && timeToMinutes(sorted[i].start_time) < timeToMinutes(sorted[i - 1].end_time)) {
        return `${WORKING_HOURS_DAY_LABELS[day.weekday]} : deux plages se chevauchent.`;
      }
    }
  }
  return null;
}

export function emptyWorkingWeek(): WorkingHoursDay[] {
  return WORKING_HOURS_DAY_ORDER.map((weekday) => ({ weekday, ranges: [] }));
}
