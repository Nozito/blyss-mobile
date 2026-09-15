/**
 * Panier V3 (doc §2, §16) — logique pure de gestion du panier de prestations,
 * partagée entre le parcours client (app/booking.tsx) et l'ajout manuel pro
 * (components/screens/pro/calendar/NewAppointmentSheet.tsx). Aucune de ces
 * fonctions ne dépend de React/React Native : elles sont testables sous
 * jest.config.js (environnement node), pas jest.rn.config.js.
 *
 * Invariant central (doc §16) : à une seule prestation, le panier ne doit
 * jamais introduire d'étape ou d'écran supplémentaire par rapport à V1/V2 —
 * `shouldAutoAdvance` matérialise cette règle pour que les deux écrans
 * appliquent exactement la même condition.
 */

import type { CartItem, ReservationAnswerSelection } from "@/types/reservation";
import type { VariantGroup, PrestationOption } from "@/types/prestation";

export function computeIndicativePricing(
  basePrice: number,
  baseDurationMinutes: number,
  variantGroups: VariantGroup[],
  options: PrestationOption[],
  selectedVariantValueByGroup: Record<number, number>,
  selectedOptionIds: Set<number>
): { price: number; durationMinutes: number } {
  let price = basePrice;
  let durationMinutes = baseDurationMinutes;
  for (const group of variantGroups) {
    const valueId = selectedVariantValueByGroup[group.id];
    const value = group.values.find((v) => v.id === valueId);
    if (value) {
      price += Number(value.price_delta);
      durationMinutes += Number(value.duration_delta);
    }
  }
  for (const option of options) {
    if (selectedOptionIds.has(option.id)) {
      price += Number(option.price_delta);
      durationMinutes += Number(option.duration_delta);
    }
  }
  return { price: Math.round(price * 100) / 100, durationMinutes };
}

/**
 * Clé locale de rendu de liste — déterministe (comptage, pas Date.now()) pour
 * rester testable, et unique même pour deux fois la même prestation puisque
 * `existingCount` ne fait que croître au fil des ajouts (doc §4).
 */
export function makeCartKey(prestationId: number, existingCount: number): string {
  return `${prestationId}-${existingCount}`;
}

/** Ajoute un item sans configuration (aucun groupe/option/question actif) — comportement V1 inchangé. */
export function buildSimpleCartItem(
  prestation: { id: number; name: string; price: number; duration_minutes: number },
  existingItems: CartItem[]
): CartItem {
  return {
    key: makeCartKey(prestation.id, existingItems.length),
    prestationId: prestation.id,
    prestationName: prestation.name,
    basePrice: prestation.price,
    baseDurationMinutes: prestation.duration_minutes,
    selectedVariantValueByGroup: {},
    selectedOptionIds: [],
    answers: [],
    indicativePrice: prestation.price,
    indicativeDurationMinutes: prestation.duration_minutes,
  };
}

/** Ajoute l'item en cours de configuration (variantes/options/questions résolues) au panier. */
export function buildConfiguredCartItem(
  params: {
    prestationId: number;
    prestationName: string;
    basePrice: number;
    baseDurationMinutes: number;
    variantGroups: VariantGroup[];
    options: PrestationOption[];
    selectedVariantValueByGroup: Record<number, number>;
    selectedOptionIds: Set<number>;
    answersByQuestion: Record<number, ReservationAnswerSelection>;
  },
  existingItems: CartItem[]
): CartItem {
  const pricing = computeIndicativePricing(
    params.basePrice,
    params.baseDurationMinutes,
    params.variantGroups,
    params.options,
    params.selectedVariantValueByGroup,
    params.selectedOptionIds
  );
  return {
    key: makeCartKey(params.prestationId, existingItems.length),
    prestationId: params.prestationId,
    prestationName: params.prestationName,
    basePrice: params.basePrice,
    baseDurationMinutes: params.baseDurationMinutes,
    // Copies défensives : l'appelant réinitialise ces states juste après
    // l'ajout (doc §4) — un item déjà dans le panier ne doit jamais être
    // affecté par la configuration du prochain.
    selectedVariantValueByGroup: { ...params.selectedVariantValueByGroup },
    selectedOptionIds: Array.from(params.selectedOptionIds),
    answers: Object.values(params.answersByQuestion),
    indicativePrice: pricing.price,
    indicativeDurationMinutes: pricing.durationMinutes,
  };
}

export function removeCartItem(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => i.key !== key);
}

export function cartTotals(items: CartItem[]): { totalPrice: number; totalDurationMinutes: number } {
  return {
    totalPrice: Math.round(items.reduce((sum, i) => sum + i.indicativePrice, 0) * 100) / 100,
    totalDurationMinutes: items.reduce((sum, i) => sum + i.indicativeDurationMinutes, 0),
  };
}

export function cartServiceIds(items: CartItem[]): number[] {
  return items.map((i) => i.prestationId);
}

export function cartDurationOverrides(items: CartItem[]): number[] {
  return items.map((i) => i.indicativeDurationMinutes);
}

/**
 * Le cas à une seule prestation ne doit jamais afficher d'écran/étape
 * supplémentaire (doc §16) : on avance directement au créneau uniquement
 * quand c'est la toute première prestation ajoutée au panier.
 */
export function shouldAutoAdvance(cartLengthBeforeAdd: number): boolean {
  return cartLengthBeforeAdd === 0;
}

export function cartLabel(items: CartItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0].prestationName;
  return items.map((i) => i.prestationName).join(" + ");
}
