import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .email("Adresse email invalide")
  .max(254, "Email trop long");

// French phone — optional (empty string passes)
export const phoneSchema = z
  .string()
  .refine(
    (v) => v === "" || /^(\+33|0033|0)[1-9](\d{2}){4}$/.test(v.replace(/\s/g, "")),
    { message: "Numéro invalide (ex: +33 6 12 34 56 78)" }
  );

export const bioSchema = z
  .string()
  .max(300, "Maximum 300 caractères")
  .optional()
  .or(z.literal(""));

// ─── Pro profile schema ───────────────────────────────────────────────────────

export const proProfileSchema = z.object({
  activityName: z.string().trim().min(1, "Le nom de l'activité est requis.").max(100),
  city: z.string().trim().min(1, "La ville est requise.").max(100),
  bio: z.string().max(300, "Maximum 300 caractères").optional().or(z.literal("")),
  instagram: z.string().max(100).optional().or(z.literal("")),
});

// French postal code — 5 digits (DOM-TOM included, e.g. 97400)
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Code postal invalide (5 chiffres)");

// ─── Review schema ────────────────────────────────────────────────────────────

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Note requise").max(5),
  comment: z.string().max(200, "Maximum 200 caractères").optional().or(z.literal("")),
});

// ─── Ville (CityAutocomplete + register.tsx étape 7) ───────────────────────────

/**
 * Une ville saisie est considérée valide si elle correspond à une commune
 * connue dans un sens ou dans l'autre :
 *  - la valeur commence par "<commune> " → "Paris 15" face à la suggestion
 *    "Paris" (préfixe complété par la pro) ;
 *  - la commune commence par la valeur → "Paris 11e" face à la suggestion
 *    "Paris 11e Arrondissement" (préfixe du nom officiel, la pro n'a pas
 *    tapé "Arrondissement").
 */
export function cityMatchesSuggestion(value: string, suggestions: { nom: string }[]): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return suggestions.some((s) => {
    const nom = s.nom.toLowerCase();
    return v === nom || v.startsWith(`${nom} `) || nom.startsWith(v);
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function getZodError(schema: z.ZodTypeAny, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return result.error.errors[0]?.message ?? "Valeur invalide";
}
