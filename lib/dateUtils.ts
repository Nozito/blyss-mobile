// Relative label ("Il y a 3 jours") from a backend string like "-3j".
export function formatLastVisit(raw?: string | null): string {
  if (!raw) return "Jamais venue";
  const match = raw.match(/(-?\d+)\s*j\b/i);
  if (!match) return raw;
  const days = Math.abs(parseInt(match[1], 10));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Il y a 1 jour";
  return `Il y a ${days} jours`;
}

export const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const SHORT_MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
] as const;

/** "Aujourd'hui à 14h30", "Demain à 9h00", "12 août à 11h00" — used wherever
 * a reservation's day isn't otherwise obvious from context (e.g. the pro
 * dashboard's "prochaines clientes", which can span several days).
 * `time` is "HH:MM" (backend TO_CHAR) — reformatted to "14h30". */
export function formatRelativeDayTime(isoDatetime: string, time: string): string {
  const date = new Date(isoDatetime);
  const hhmm = time.replace(":", "h");
  if (Number.isNaN(date.getTime())) return hhmm;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (dayDiff === 0) return `Aujourd'hui à ${hhmm}`;
  if (dayDiff === 1) return `Demain à ${hhmm}`;
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} à ${hhmm}`;
}

/** "1h05", "45min", "2h" — was reimplemented in 5 places, two slightly
 * differently (one never zero-padded minutes, e.g. "1h5" for 65 min). */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
