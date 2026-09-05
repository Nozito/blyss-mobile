/**
 * #34 — contenu statique de l'onboarding client nails (passe 3b « poster editorial × DA »).
 * 7 écrans, zéro emoji. Cf. docs/DESIGN_34_client-onboarding-refonte.md.
 *
 *   1 Bienvenue → 2 Comment ça marche → 3 Préférences (style multi + ville)
 *   → 4 Recos (+ ♥) → 5 Notifications → 6 Comment tu as connu Blyss
 *   → 7 CTA premier RDV (dernier)
 */
import type { NailStyle } from "@/lib/api";

/**
 * Écran 3 — style(s), multi-choix (enum nail_style). `code` = réf nuancier.
 * `emoji` conservé pour l'écran pro « Mes spécialités » qui réutilise la liste.
 */
export const NAIL_STYLE_OPTIONS: { value: NailStyle; label: string; code: string; emoji: string }[] = [
  { value: "nail_art", label: "Nail art", code: "NL·01", emoji: "🎨" },
  { value: "french_nude", label: "French / nude", code: "NL·02", emoji: "🤍" },
  { value: "couleurs_vives", label: "Couleurs vives", code: "NL·03", emoji: "🌈" },
  { value: "vernis_gel", label: "Vernis gel", code: "NL·04", emoji: "✨" },
  { value: "pose_resine", label: "Pose résine", code: "NL·05", emoji: "💎" },
  { value: "autre", label: "Autre", code: "NL·06", emoji: "💅" },
];

/** Écran 1 — hero plein champ rose, voix affirmée. Pas d'offre promo, pas d'eyebrow. */
export const WELCOME = {
  title: "Tes ongles méritent mieux",
  sticker: "✦ 1 minute chrono",
  body: "Les meilleures prothésistes ongulaires près de chez toi — leur vrai travail, leurs vraies dispos.",
  socialProof: "→ Des milliers de RDV nails / mois",
  cta: "On y va",
};

/** Écran 2 — « comment ça marche », fond prune. 3 étapes, rassure avant de demander. */
export const HOW_IT_WORKS = {
  eyebrow: "Avant de commencer",
  title: "Trois étapes,\nc'est tout",
  steps: [
    "Tu choisis ta pro et ton créneau",
    "Tu reçois ta confirmation direct",
    "Tu payes à l'institut, après ton soin",
  ],
  cta: "J'ai compris",
};

/** Écran 5 — pré-permission notifications, fond prune. */
export const NOTIF = {
  eyebrow: "Presque fini",
  title: "On te prévient au bon moment",
  body: "Quand un créneau se libère chez ta pro, et quand c'est l'heure de refaire tes ongles. Rien d'autre.",
  cta: "Activer les notifs",
  later: "plus tard",
};

/** Écran 6 — attribution (acquisition_source). 1 choix, skippable. */
export const ATTRIBUTION_OPTIONS: { value: string; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "amie", label: "Une amie" },
  { value: "prothesiste", label: "Ma prothésiste" },
  { value: "google", label: "Recherche Google" },
  { value: "pub", label: "Une pub" },
];

export const STEP = {
  WELCOME: 1,
  HOW_IT_WORKS: 2,
  PREFERENCES: 3,
  RECOMMENDATIONS: 4,
  NOTIFICATIONS: 5,
  ATTRIBUTION: 6,
  CTA: 7,
} as const;

export const STEP_COUNT = 7;
