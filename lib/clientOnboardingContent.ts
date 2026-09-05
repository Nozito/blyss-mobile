/**
 * #34 — contenu statique de l'onboarding client nails (refonte design).
 * Cf. docs/DESIGN_34_client-onboarding-refonte.md.
 */
import type { NailStyle } from "@/lib/api";

export const NAIL_STYLE_OPTIONS: { value: NailStyle; label: string; emoji: string }[] = [
  { value: "nail_art", label: "Nail art", emoji: "🎨" },
  { value: "french_nude", label: "French / nude", emoji: "🤍" },
  { value: "couleurs_vives", label: "Couleurs vives", emoji: "🌈" },
  { value: "vernis_gel", label: "Vernis gel", emoji: "✨" },
  { value: "pose_resine", label: "Pose résine", emoji: "💎" },
  { value: "autre", label: "Autre / je ne sais pas", emoji: "💅" },
];

/**
 * Écran 1 — ancrage valeur (preuve sociale + storytelling). Pas d'offre promo.
 * `socialProof` : chiffre affiché en gros au-dessus du titre (preuve sociale).
 */
export const WELCOME = {
  eyebrow: "Bienvenue sur Blyss",
  socialProof: "Des milliers de RDV nails",
  socialProofSuffix: "réservés chaque mois",
  title: "Trouve LA prothésiste ongulaire qu'il te faut",
  body: "En une minute, on te présente les pros près de chez toi qui correspondent vraiment à ton style.",
  cta: "C'est parti",
  skip: "Plus tard",
};

/** Écran 5 — carousel features, 3 slides. `tint` = accent de la slide. */
export const FEATURE_SLIDES: { title: string; body: string; emoji: string; tint: "primary" | "secondary" | "info" }[] = [
  {
    emoji: "📅",
    title: "Réserve en quelques taps",
    body: "Les vraies disponibilités de chaque pro, 24/7. Choisis ton créneau sans appel ni DM.",
    tint: "primary",
  },
  {
    emoji: "🔔",
    title: "On te rappelle au bon moment",
    body: "Une notification quand il est temps de refaire tes ongles chez ta pro préférée.",
    tint: "info",
  },
  {
    emoji: "💬",
    title: "Tout est au même endroit",
    body: "Messages, historique, rappels de RDV : ton suivi nails complet dans l'app.",
    tint: "secondary",
  },
];

export const STEP = {
  WELCOME: 1,
  PREFERENCES: 2,
  RECOMMENDATIONS: 3,
  CTA: 4,
  FEATURES: 5,
} as const;
