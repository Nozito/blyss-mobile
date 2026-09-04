/**
 * #34 — contenu statique de l'onboarding client nails.
 * Cf. docs/DESIGN_34_client-onboarding.md (blyss-app).
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

/** Écran 1 — ancrage valeur (preuve sociale + storytelling). Pas d'offre promo. */
export const WELCOME = {
  title: "Trouve LA prothésiste ongulaire qu'il te faut",
  body: "Des milliers de rendez-vous nails pris sur Blyss chaque mois. En 1 minute, on te présente les pros près de chez toi qui correspondent à ton style.",
  cta: "C'est parti",
};

/** Écran 5 — carousel features, 3 slides max. */
export const FEATURE_SLIDES: { title: string; body: string; emoji: string }[] = [
  {
    emoji: "📅",
    title: "Réserve en quelques taps",
    body: "Vois les vraies disponibilités de chaque pro et choisis ton créneau, sans appel ni DM.",
  },
  {
    emoji: "🔔",
    title: "On te rappelle au bon moment",
    body: "Une notification quand il est temps de refaire tes ongles chez ta pro préférée.",
  },
  {
    emoji: "💬",
    title: "Tout est au même endroit",
    body: "Messages, historique, rappels de RDV : ton suivi nails complet dans l'app.",
  },
];

export const STEP = {
  WELCOME: 1,
  PREFERENCES: 2,
  RECOMMENDATIONS: 3,
  CTA: 4,
  FEATURES: 5,
} as const;
