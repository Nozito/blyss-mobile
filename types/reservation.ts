/**
 * Source de vérité TypeScript — sélection de configuration à la réservation
 * et snapshot d'un élément de réservation (moteur de prestations V1 → V3).
 *
 * Réf : docs/ARCHITECTURE_MOTEUR_PRESTATIONS_V1_V3.md (§2.5, §15).
 * `ReservationSelection` = ce que la cliente choisit dans le formulaire de
 * configuration, avant envoi au backend (qui recalcule tout, jamais fait
 * confiance à un prix/durée envoyé par le client — doc §5.2).
 */

export interface ReservationAnswerSelection {
  questionId: number;
  /** short_text / long_text / boolean. */
  value?: string;
  /** single_choice (1 élément) / multi_choice (0..N) — ids de question_choices. */
  values?: number[];
  /** Consentement explicite requis si la question est sensible (doc §9.2). */
  consent?: boolean;
}

export interface ReservationSelection {
  prestationId: number;
  selectedVariantValueIds: number[];
  selectedOptionIds: number[];
  answers: ReservationAnswerSelection[];
}

/**
 * Un élément du panier (V3, doc §2) tel que construit côté mobile pendant la
 * configuration — porte à la fois la sélection à envoyer au backend et les
 * données d'affichage (nom, prix/durée indicatifs) pour le récap. `key` est
 * un identifiant local de rendu de liste (permet deux fois la même
 * prestation dans le panier, cf. doc §4).
 */
export interface CartItem {
  key: string;
  prestationId: number;
  prestationName: string;
  basePrice: number;
  baseDurationMinutes: number;
  selectedVariantValueByGroup: Record<number, number>;
  selectedOptionIds: number[];
  answers: ReservationAnswerSelection[];
  /** Prix/durée indicatifs (variantes/options appliquées) — le backend recalcule et fait toujours foi. */
  indicativePrice: number;
  indicativeDurationMinutes: number;
}

export interface ReservationItemVariantSnapshot {
  variant_group_id: number | null;
  variant_value_id: number | null;
  snapshot_group_name: string;
  snapshot_value_label: string;
  snapshot_price_delta: number;
  snapshot_duration_delta: number;
}

export interface ReservationItemOptionSnapshot {
  option_id: number | null;
  snapshot_name: string;
  snapshot_price_delta: number;
  snapshot_duration_delta: number;
}

export interface ReservationItemAnswerSnapshot {
  question_id: number | null;
  snapshot_question_label: string;
  snapshot_question_type: string;
  snapshot_is_sensitive: boolean;
  snapshot_choices_available: string[] | null;
  answer_value: string | null;
  answer_values: string[] | null;
}

export interface ReservationItem {
  id: number;
  reservation_id: number;
  prestation_id: number | null;
  snapshot_name: string;
  snapshot_price: number;
  snapshot_duration_minutes: number;
  position: number;
  variants?: ReservationItemVariantSnapshot[];
  options?: ReservationItemOptionSnapshot[];
  answers?: ReservationItemAnswerSnapshot[];
}
