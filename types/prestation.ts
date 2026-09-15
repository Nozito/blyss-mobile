/**
 * Source de vérité TypeScript — moteur de prestations générique (V1 → V3).
 *
 * Réf : docs/ARCHITECTURE_MOTEUR_PRESTATIONS_V1_V3.md (§2, §15).
 * Avant ce fichier, `Service`/`Prestation` était redéfini séparément dans au
 * moins 5 endroits (services.tsx, service-form.tsx, public-profile.tsx,
 * ServiceSelector.tsx, NewAppointmentSheet.tsx) avec des champs divergents.
 * Migration progressive : chaque écran adopte ces types au moment où il est
 * de toute façon modifié pour supporter variantes/options — pas de
 * renommage global d'un coup.
 */

export type PricingMode = "fixed" | "from";
export type VariantSelectionMode = "single" | "multi";
export type QuestionType = "short_text" | "long_text" | "boolean" | "single_choice" | "multi_choice";

export interface Prestation {
  id: number;
  pro_id?: number;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  pricing_mode: PricingMode;
  ordering_rank: number;
  created_at?: string;
}

export interface VariantValue {
  id: number;
  variant_group_id: number;
  label: string;
  price_delta: number;
  duration_delta: number;
  active: boolean;
  sort_order: number;
}

export interface VariantGroup {
  id: number;
  prestation_id: number;
  name: string;
  required: boolean;
  selection_mode: VariantSelectionMode;
  active: boolean;
  sort_order: number;
  values: VariantValue[];
}

export interface PrestationOption {
  id: number;
  prestation_id: number;
  name: string;
  price_delta: number;
  duration_delta: number;
  active: boolean;
  sort_order: number;
}

// ── V2 — questions personnalisées ────────────────────────────────────────────

export interface QuestionChoice {
  id: number;
  question_id: number;
  label: string;
  sort_order: number;
}

export interface Question {
  id: number;
  prestation_id: number;
  label: string;
  type: QuestionType;
  required: boolean;
  active: boolean;
  is_sensitive: boolean;
  sort_order: number;
  choices?: QuestionChoice[];
  /**
   * Texte de consentement dédié, servi UNIQUEMENT par l'endpoint public de
   * lecture pour une question is_sensitive=true — jamais codé en dur côté
   * app (contenu provisoire côté backend, cf. lib/sensitive-questions.ts).
   */
  sensitive_consent_text?: string;
}
