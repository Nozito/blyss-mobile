/**
 * Salutation selon l'heure locale — même esprit que l'interface de Claude.
 *   nuit (0-5h) · matin (5-12h) · après-midi (12-18h) · soir (18-22h) · nuit (22h+)
 */
export function timeGreeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  if (h < 22) return "Bonsoir";
  return "Bonne nuit";
}
