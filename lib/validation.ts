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

// ─── Review schema ────────────────────────────────────────────────────────────

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Note requise").max(5),
  comment: z.string().max(200, "Maximum 200 caractères").optional().or(z.literal("")),
});

// ─── Utility ──────────────────────────────────────────────────────────────────

export function getZodError(schema: z.ZodTypeAny, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return result.error.errors[0]?.message ?? "Valeur invalide";
}
