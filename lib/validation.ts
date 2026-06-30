import { z } from "zod";

// ─── Primitives ───────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .email("Adresse email invalide")
  .max(254, "Email trop long");

export const passwordSchema = z
  .string()
  .min(8, "Min. 8 caractères")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre")
  .regex(/[a-z]/, "Au moins une minuscule");

// French phone — required (non-empty)
export const phoneRequiredSchema = z
  .string()
  .regex(
    /^(\+33|0033|0)[1-9](\d{2}){4}$/,
    "Numéro invalide (ex: +33 6 12 34 56 78)"
  );

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

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis"),
});

export const step1Schema = z.object({
  firstName: z.string().trim().min(2, "Minimum 2 caractères").max(50),
  email: emailSchema,
  password: passwordSchema,
});

export const step2ClientSchema = z.object({
  phone: phoneSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Accepte les CGU pour continuer" }),
  }),
});

export const step2ProSchema = z.object({
  activityName: z.string().trim().min(1, "Nom de l'activité requis").max(100),
  jobType: z.string().min(1, "Choisis un type de métier"),
  phone: phoneRequiredSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Accepte les CGU pour continuer" }),
  }),
});

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

// ─── Booking schema ───────────────────────────────────────────────────────────

export const bookingSchema = z.object({
  specialistId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  slotId: z.string().min(1),
});

// ─── Utility ──────────────────────────────────────────────────────────────────

export function getZodError(schema: z.ZodTypeAny, value: unknown): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return result.error.errors[0]?.message ?? "Valeur invalide";
}
