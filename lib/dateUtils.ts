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

/** "1h05", "45min", "2h" — was reimplemented in 5 places, two slightly
 * differently (one never zero-padded minutes, e.g. "1h5" for 65 min). */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
