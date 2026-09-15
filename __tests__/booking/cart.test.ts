/**
 * Tests — panier V3 (lib/cart.ts), logique partagée entre app/booking.tsx
 * (client) et NewAppointmentSheet.tsx (pro). Réf : doc §2, §16, §14.
 *
 * lib/cart.ts n'a aucune dépendance React Native (types uniquement) — ces
 * tests tournent donc sous jest.config.js (environnement node), pas
 * jest.rn.config.js.
 */

import {
  computeIndicativePricing,
  makeCartKey,
  buildSimpleCartItem,
  buildConfiguredCartItem,
  removeCartItem,
  cartTotals,
  cartServiceIds,
  cartDurationOverrides,
  shouldAutoAdvance,
  cartLabel,
} from "@/lib/cart";
import type { CartItem } from "@/types/reservation";
import type { VariantGroup, PrestationOption } from "@/types/prestation";

function variantGroup(overrides: Partial<VariantGroup> & { values: VariantGroup["values"] }): VariantGroup {
  return {
    id: 1,
    prestation_id: 10,
    name: "Longueur",
    required: true,
    selection_mode: "single",
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

function option(overrides: Partial<PrestationOption>): PrestationOption {
  return {
    id: 1,
    prestation_id: 10,
    name: "French",
    price_delta: 5,
    duration_delta: 10,
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

const PRESTATION_A = { id: 10, name: "Manucure gel", price: 45, duration_minutes: 60 };
const PRESTATION_B = { id: 11, name: "Pose vernis", price: 20, duration_minutes: 30 };

describe("Cas simple — 1 prestation (parcours identique à V1)", () => {
  it("un item simple reprend exactement le prix/durée de base, sans delta", () => {
    const item = buildSimpleCartItem(PRESTATION_A, []);
    expect(item.indicativePrice).toBe(45);
    expect(item.indicativeDurationMinutes).toBe(60);
    expect(item.selectedVariantValueByGroup).toEqual({});
    expect(item.selectedOptionIds).toEqual([]);
    expect(item.answers).toEqual([]);
  });

  it("shouldAutoAdvance est vrai uniquement quand le panier est encore vide (1ère prestation)", () => {
    expect(shouldAutoAdvance(0)).toBe(true);
    expect(shouldAutoAdvance(1)).toBe(false);
    expect(shouldAutoAdvance(2)).toBe(false);
  });

  it("cartLabel d'un panier à 1 item = le nom de la prestation, sans agrégation", () => {
    const item = buildSimpleCartItem(PRESTATION_A, []);
    expect(cartLabel([item])).toBe("Manucure gel");
  });

  it("cartTotals d'un panier à 1 item simple = prix/durée de base inchangés", () => {
    const item = buildSimpleCartItem(PRESTATION_A, []);
    expect(cartTotals([item])).toEqual({ totalPrice: 45, totalDurationMinutes: 60 });
  });
});

describe("Ajout de plusieurs prestations", () => {
  it("ajout d'une 2e prestation : le panier contient les deux, clés distinctes", () => {
    const item1 = buildSimpleCartItem(PRESTATION_A, []);
    const item2 = buildSimpleCartItem(PRESTATION_B, [item1]);
    expect([item1, item2].map((i) => i.prestationId)).toEqual([10, 11]);
    expect(item1.key).not.toBe(item2.key);
  });

  it("ajout d'une 3e prestation (même id qu'une déjà présente) : clé toujours unique", () => {
    const item1 = buildSimpleCartItem(PRESTATION_A, []);
    const item2 = buildSimpleCartItem(PRESTATION_B, [item1]);
    const item3 = buildSimpleCartItem(PRESTATION_A, [item1, item2]); // même prestation que item1
    const keys = [item1, item2, item3].map((i) => i.key);
    expect(new Set(keys).size).toBe(3);
    expect(item3.prestationId).toBe(item1.prestationId);
  });

  it("makeCartKey ne dépend que du compteur d'items existants, pas de l'horloge (déterministe)", () => {
    expect(makeCartKey(10, 0)).toBe("10-0");
    expect(makeCartKey(10, 2)).toBe("10-2");
    expect(makeCartKey(10, 0)).toBe(makeCartKey(10, 0));
  });
});

describe("Configuration indépendante de chaque item (variantes/options propres)", () => {
  const group = variantGroup({
    id: 1,
    values: [
      { id: 100, variant_group_id: 1, label: "Courte", price_delta: 0, duration_delta: 0, active: true, sort_order: 0 },
      { id: 101, variant_group_id: 1, label: "Longue", price_delta: 15, duration_delta: 20, active: true, sort_order: 1 },
    ],
  });
  const opt = option({ id: 1, price_delta: 5, duration_delta: 10 });

  it("deux items de la même prestation, configurés différemment, restent indépendants", () => {
    const existing: CartItem[] = [];
    const item1 = buildConfiguredCartItem(
      {
        prestationId: PRESTATION_A.id,
        prestationName: PRESTATION_A.name,
        basePrice: PRESTATION_A.price,
        baseDurationMinutes: PRESTATION_A.duration_minutes,
        variantGroups: [group],
        options: [opt],
        selectedVariantValueByGroup: { 1: 100 }, // Courte, sans delta
        selectedOptionIds: new Set<number>(),
        answersByQuestion: {},
      },
      existing
    );
    const item2 = buildConfiguredCartItem(
      {
        prestationId: PRESTATION_A.id,
        prestationName: PRESTATION_A.name,
        basePrice: PRESTATION_A.price,
        baseDurationMinutes: PRESTATION_A.duration_minutes,
        variantGroups: [group],
        options: [opt],
        selectedVariantValueByGroup: { 1: 101 }, // Longue, +15€/+20min
        selectedOptionIds: new Set([1]), // + option +5€/+10min
        answersByQuestion: {},
      },
      [item1]
    );

    expect(item1.indicativePrice).toBe(45); // base seule
    expect(item1.indicativeDurationMinutes).toBe(60);
    expect(item2.indicativePrice).toBe(45 + 15 + 5); // 65
    expect(item2.indicativeDurationMinutes).toBe(60 + 20 + 10); // 90

    // Chaque item porte sa PROPRE sélection — pas de référence partagée.
    expect(item1.selectedVariantValueByGroup).not.toBe(item2.selectedVariantValueByGroup);
    expect(item1.selectedOptionIds).toEqual([]);
    expect(item2.selectedOptionIds).toEqual([1]);
  });

  it("mutation ultérieure de la sélection en cours (Set/objet source) n'affecte pas un item déjà ajouté au panier", () => {
    const liveSelection: Record<number, number> = { 1: 100 };
    const liveOptions = new Set<number>();
    const item = buildConfiguredCartItem(
      {
        prestationId: PRESTATION_A.id,
        prestationName: PRESTATION_A.name,
        basePrice: PRESTATION_A.price,
        baseDurationMinutes: PRESTATION_A.duration_minutes,
        variantGroups: [group],
        options: [opt],
        selectedVariantValueByGroup: liveSelection,
        selectedOptionIds: liveOptions,
        answersByQuestion: {},
      },
      []
    );

    // Simule la réinitialisation des states du configurateur pour le
    // prochain item (comme le font booking.tsx / NewAppointmentSheet.tsx).
    liveSelection[1] = 101;
    liveOptions.add(1);

    expect(item.selectedVariantValueByGroup).toEqual({ 1: 100 });
    expect(item.selectedOptionIds).toEqual([]);
    expect(item.indicativePrice).toBe(45);
  });

  it("computeIndicativePricing ignore une valeur de variante sélectionnée mais inconnue du groupe", () => {
    const { price, durationMinutes } = computeIndicativePricing(45, 60, [group], [], { 1: 9999 }, new Set());
    expect(price).toBe(45);
    expect(durationMinutes).toBe(60);
  });

  it("computeIndicativePricing arrondit le prix au centime", () => {
    const weirdOption = option({ id: 2, price_delta: 0.1 });
    const { price } = computeIndicativePricing(10.05, 30, [], [weirdOption, weirdOption, weirdOption], {}, new Set([2]));
    // 10.05 + 0.1*3 = 10.35 (évite les artefacts flottants du type 10.349999999999998)
    expect(price).toBe(10.35);
  });
});

describe("Suppression / modification d'un item", () => {
  it("removeCartItem retire uniquement l'item ciblé (par clé), laisse les autres intacts", () => {
    const item1 = buildSimpleCartItem(PRESTATION_A, []);
    const item2 = buildSimpleCartItem(PRESTATION_B, [item1]);
    const item3 = buildSimpleCartItem(PRESTATION_A, [item1, item2]);
    const next = removeCartItem([item1, item2, item3], item2.key);
    expect(next.map((i) => i.key)).toEqual([item1.key, item3.key]);
  });

  it("removeCartItem sur une clé absente ne change rien (no-op sûr)", () => {
    const item1 = buildSimpleCartItem(PRESTATION_A, []);
    expect(removeCartItem([item1], "clé-inexistante")).toEqual([item1]);
  });

  it("« modifier » un item = le retirer puis en ajouter un nouveau reconfiguré : le panier reflète bien le changement", () => {
    const original = buildSimpleCartItem(PRESTATION_A, []);
    const afterRemoval = removeCartItem([original], original.key);
    const replacement = buildConfiguredCartItem(
      {
        prestationId: PRESTATION_A.id,
        prestationName: PRESTATION_A.name,
        basePrice: PRESTATION_A.price,
        baseDurationMinutes: PRESTATION_A.duration_minutes,
        variantGroups: [],
        options: [option({ id: 1, price_delta: 8, duration_delta: 5 })],
        selectedVariantValueByGroup: {},
        selectedOptionIds: new Set([1]),
        answersByQuestion: {},
      },
      afterRemoval
    );
    const finalCart = [...afterRemoval, replacement];
    expect(finalCart).toHaveLength(1);
    expect(finalCart[0].indicativePrice).toBe(53);
    // Les clés n'ont besoin d'être uniques qu'au sein d'un même snapshot du
    // panier (contrainte React list-key) — l'original n'y figure plus.
    expect(new Set(finalCart.map((i) => i.key)).size).toBe(finalCart.length);
  });
});

describe("Calcul des totaux (prix + durée)", () => {
  it("somme correctement plusieurs items hétérogènes", () => {
    const item1 = buildSimpleCartItem(PRESTATION_A, []); // 45€ / 60min
    const item2 = buildSimpleCartItem(PRESTATION_B, [item1]); // 20€ / 30min
    expect(cartTotals([item1, item2])).toEqual({ totalPrice: 65, totalDurationMinutes: 90 });
  });

  it("panier vide → totaux à zéro", () => {
    expect(cartTotals([])).toEqual({ totalPrice: 0, totalDurationMinutes: 0 });
  });

  it("cartServiceIds et cartDurationOverrides restent alignés positionnellement (doublons inclus)", () => {
    const item1 = buildSimpleCartItem(PRESTATION_A, []);
    const item2 = buildConfiguredCartItem(
      {
        prestationId: PRESTATION_A.id, // même prestation que item1, durée différente
        prestationName: PRESTATION_A.name,
        basePrice: PRESTATION_A.price,
        baseDurationMinutes: PRESTATION_A.duration_minutes,
        variantGroups: [],
        options: [option({ id: 1, price_delta: 0, duration_delta: 15 })],
        selectedVariantValueByGroup: {},
        selectedOptionIds: new Set([1]),
        answersByQuestion: {},
      },
      [item1]
    );
    expect(cartServiceIds([item1, item2])).toEqual([10, 10]);
    expect(cartDurationOverrides([item1, item2])).toEqual([60, 75]);
  });
});

describe("Transmission au backend en items[] (V3) — cf. lib/api.ts toReservationItemsWire", () => {
  it("un panier à une seule prestation simple ne casse pas l'ancien comportement prestation_id (le backend accepte toujours prestation_id à plat en parallèle)", () => {
    // toReservationItemsWire vit dans lib/api.ts (dépend de storage/fetch) —
    // ici on vérifie seulement le contrat de forme que ce module consomme :
    // un CartItem à 1 élément expose bien tout ce qu'il faut pour construire
    // un item wire équivalent à l'ancien flat prestation_id/selected_*/answers.
    const item = buildSimpleCartItem(PRESTATION_A, []);
    expect(item.prestationId).toBe(PRESTATION_A.id);
    expect(Object.values(item.selectedVariantValueByGroup)).toEqual([]);
    expect(item.selectedOptionIds).toEqual([]);
    expect(item.answers).toEqual([]);
  });
});
