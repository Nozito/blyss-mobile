/**
 * #34 — contenu statique de l'onboarding client nails (refonte design « B ancré »).
 * Voix affirmée sur les écrans bornes (bienvenue / carousel), sobre et aligné
 * sur l'app au milieu. Cf. docs/DESIGN_34_client-onboarding-refonte.md.
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
 * Écran 1 — hero plein champ rose, voix affirmée. Pas d'offre promo.
 * `title` est affiché en display lourd capitales ; `body` porte la clarté.
 */
export const WELCOME = {
  eyebrow: "✦ Blyss · onglerie",
  title: "Tes ongles méritent mieux",
  body: "Les meilleures prothésistes ongulaires près de chez toi — leur vrai travail, leurs vraies dispos, réservées en quelques taps.",
  socialProof: "Des milliers de RDV nails réservés chaque mois",
  cta: "On y va",
  skip: "Plus tard",
};

/**
 * Écran 5 — carousel, 3 slides plein champ. `field` = clé de couleur de la
 * palette (token), `ink` = "dark" (texte quasi-noir) ou "light" (texte clair).
 */
export const FEATURE_SLIDES: {
  title: string;
  body: string;
  emoji: string;
  field: "primary" | "secondary" | "foreground";
  ink: "dark" | "light";
}[] = [
  {
    emoji: "📅",
    title: "Réserve en 3 taps",
    body: "Les vraies disponibilités de chaque pro, 24/7. Pas d'appel, pas de DM.",
    field: "primary",
    ink: "dark",
  },
  {
    emoji: "🔔",
    title: "On te rappelle au bon moment",
    body: "Une notif quand il est temps de refaire tes ongles chez ta pro préférée.",
    field: "secondary",
    ink: "dark",
  },
  {
    emoji: "💬",
    title: "Tout au même endroit",
    body: "Messages, historique, rappels de RDV : ton suivi nails complet dans l'app.",
    field: "foreground",
    ink: "light",
  },
];

export const STEP = {
  WELCOME: 1,
  PREFERENCES: 2,
  RECOMMENDATIONS: 3,
  CTA: 4,
  FEATURES: 5,
} as const;
