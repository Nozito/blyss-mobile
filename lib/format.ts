// Formatage FR déterministe.
//
// On n'utilise PAS `Number.toLocaleString("fr-FR")` : le moteur Hermes (iOS/
// Android release) ne groupe pas toujours les milliers, d'où des "3470 €" au
// lieu de "3 470 €". Ici le groupement est fait à la main.
//
// Convention : espace insécable (U+00A0) pour les milliers ET avant l'unité,
// virgule décimale. Ex. : 12 345 678,90 €

const NBSP = String.fromCharCode(0x00A0);

function toNum(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

function group(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Nombre entier avec séparateur de milliers : 1041 → "1 041". */
export function formatNumberFR(value: number | string | null | undefined): string {
  const n = toNum(value);
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + group(Math.round(Math.abs(n)).toString());
}

/**
 * Montant en euros. `cents: true` force deux décimales (12 345,00 €),
 * sinon arrondi à l'euro (12 345 €). Renvoie "—" si la valeur est absente.
 */
export function formatEUR(
  value: number | string | null | undefined,
  opts: { cents?: boolean } = {},
): string {
  const n = toNum(value);
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  const fixed = Math.abs(n).toFixed(opts.cents ? 2 : 0);
  const [int, dec] = fixed.split(".");
  return `${sign}${group(int)}${dec ? "," + dec : ""}${NBSP}€`;
}

/** Pourcentage : 8.8 → "8,8 %". `digits` décimales (défaut 0). */
export function formatPercentFR(
  value: number | string | null | undefined,
  digits = 0,
): string {
  const n = toNum(value);
  if (n === null) return "—";
  return `${n.toFixed(digits).replace(".", ",")}${NBSP}%`;
}
