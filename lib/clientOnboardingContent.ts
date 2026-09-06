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
 * Taxonomie nails v2 (enum nail_style, migration 20260910000001) — 12 familles,
 * sans emoji. `code` = réf nuancier affichée en sous-titre des puces.
 *
 * - `NAIL_STYLE_OPTIONS` : les 12, pour l'écran pro « Mes spécialités ».
 * - `CLIENT_NAIL_STYLE_OPTIONS` : sous-ensemble de 6, pour l'écran 3 de
 *   l'onboarding client. Mêmes `value` des deux côtés → le matching reco
 *   (pro.styles ∩ client.styles) fonctionne tel quel.
 */
export const NAIL_STYLE_OPTIONS: { value: NailStyle; label: string; code: string }[] = [
  { value: "manucure_soin", label: "Manucure & soin de l'ongle naturel", code: "NL·01" },
  { value: "renforcement_ongle", label: "Renforcement de l'ongle naturel", code: "NL·02" },
  { value: "pose_gel", label: "Pose gel", code: "NL·03" },
  { value: "resine_acrylique", label: "Résine / acrylique", code: "NL·04" },
  { value: "acrygel_polygel", label: "Acrygel / polygel", code: "NL·05" },
  { value: "capsules_gelx", label: "Gel X / capsules", code: "NL·06" },
  { value: "semi_permanent", label: "Vernis semi-permanent", code: "NL·07" },
  { value: "french", label: "French", code: "NL·08" },
  { value: "baby_boomer_ombre", label: "Baby boomer / ombré", code: "NL·09" },
  { value: "nail_art", label: "Nail art", code: "NL·10" },
  { value: "effets_finitions", label: "Effets & finitions", code: "NL·11" },
  { value: "formes_sculptees", label: "Formes sculptées", code: "NL·12" },
];

/** Écran 3 onboarding client — 6 familles, libellés « cliente ». */
export const CLIENT_NAIL_STYLE_OPTIONS: { value: NailStyle; label: string; code: string }[] = [
  { value: "semi_permanent", label: "Semi-permanent", code: "NL·07" },
  { value: "french", label: "French", code: "NL·08" },
  { value: "baby_boomer_ombre", label: "Baby boomer / ombré", code: "NL·09" },
  { value: "nail_art", label: "Nail art", code: "NL·10" },
  { value: "effets_finitions", label: "Effets & finitions", code: "NL·11" },
  { value: "formes_sculptees", label: "Formes sculptées", code: "NL·12" },
];

/** Écran 1 — hero plein champ rose, voix affirmée. Pas d'offre promo, pas d'eyebrow. */
export const WELCOME = {
  title: "Tes ongles méritent mieux",
  sticker: "1 minute chrono",
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
