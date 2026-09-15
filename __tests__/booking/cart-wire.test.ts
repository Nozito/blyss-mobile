/**
 * Tests — transmission du panier V3 au backend (lib/api.ts, toReservationItemsWire).
 * Réf : doc §2, §13.3 ; backend/middleware/validate.ts reservationItemInputSchema
 * (prestation_id, selected_variant_value_ids, selected_option_ids, answers).
 */

jest.mock("@/lib/storage", () => ({
  storage: {
    getAccessToken: jest.fn().mockResolvedValue("tok"),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    clearAll: jest.fn(),
  },
}));

import { toReservationItemsWire, stripePaymentsApi, proApi } from "@/lib/api";
import { buildSimpleCartItem, buildConfiguredCartItem } from "@/lib/cart";
import type { VariantGroup, PrestationOption } from "@/types/prestation";

const mockFetch = jest.fn();
(global as { fetch: unknown }).fetch = mockFetch;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

const PRESTATION_A = { id: 10, name: "Manucure gel", price: 45, duration_minutes: 60 };
const PRESTATION_B = { id: 11, name: "Pose vernis", price: 20, duration_minutes: 30 };

describe("toReservationItemsWire", () => {
  it("un panier à 1 prestation simple → items[] à 1 élément, sans variante/option/réponse", () => {
    const item = buildSimpleCartItem(PRESTATION_A, []);
    expect(toReservationItemsWire([item])).toEqual([
      { prestation_id: 10, selected_variant_value_ids: [], selected_option_ids: [], answers: [] },
    ]);
  });

  it("plusieurs prestations conservent l'ordre du panier et leur configuration propre", () => {
    const group: VariantGroup = {
      id: 1, prestation_id: 10, name: "Longueur", required: true, selection_mode: "single", active: true, sort_order: 0,
      values: [{ id: 100, variant_group_id: 1, label: "Longue", price_delta: 15, duration_delta: 20, active: true, sort_order: 0 }],
    };
    const opt: PrestationOption = { id: 5, prestation_id: 10, name: "French", price_delta: 5, duration_delta: 10, active: true, sort_order: 0 };

    const item1 = buildConfiguredCartItem(
      {
        prestationId: PRESTATION_A.id,
        prestationName: PRESTATION_A.name,
        basePrice: PRESTATION_A.price,
        baseDurationMinutes: PRESTATION_A.duration_minutes,
        variantGroups: [group],
        options: [opt],
        selectedVariantValueByGroup: { 1: 100 },
        selectedOptionIds: new Set([5]),
        answersByQuestion: { 1: { questionId: 1, value: "Allergie X", consent: true } },
      },
      []
    );
    const item2 = buildSimpleCartItem(PRESTATION_B, [item1]);

    expect(toReservationItemsWire([item1, item2])).toEqual([
      {
        prestation_id: 10,
        selected_variant_value_ids: [100],
        selected_option_ids: [5],
        answers: [{ question_id: 1, value: "Allergie X", values: undefined, consent: true }],
      },
      { prestation_id: 11, selected_variant_value_ids: [], selected_option_ids: [], answers: [] },
    ]);
  });

  it("panier vide → items[] vide (le backend rejette min 1, mais le mapping lui-même ne plante pas)", () => {
    expect(toReservationItemsWire([])).toEqual([]);
  });
});

describe("stripePaymentsApi.createReservation — envoie items[], jamais l'ancien prestation_id à plat", () => {
  it("le corps de la requête POST /api/reservations porte items[] et pas prestation_id", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(200, { success: true, data: { id: 1, deposit_percentage: 0, deposit_amount: null, price: 45 } })
    );

    const item = buildSimpleCartItem(PRESTATION_A, []);
    await stripePaymentsApi.createReservation({
      pro_id: 7,
      items: toReservationItemsWire([item]),
      start_datetime: "2026-10-01T09:00:00.000Z",
      end_datetime: "2026-10-01T10:00:00.000Z",
      payment_method: "on_site",
      early_execution_requested: false,
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items).toEqual([{ prestation_id: 10, selected_variant_value_ids: [], selected_option_ids: [], answers: [] }]);
    expect(body.prestation_id).toBeUndefined();
  });
});

describe("proApi.createAppointment — panier pro, même contrat items[]", () => {
  it("plusieurs prestations dans le panier pro sont transmises dans l'ordre", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: { id: 2, price: 65, override_applied: null } }));

    const item1 = buildSimpleCartItem(PRESTATION_A, []);
    const item2 = buildSimpleCartItem(PRESTATION_B, [item1]);
    await proApi.createAppointment({
      client_id: 42,
      items: toReservationItemsWire([item1, item2]),
      start_datetime: "2026-10-01T09:00:00.000Z",
      end_datetime: "2026-10-01T10:30:00.000Z",
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.items).toEqual([
      { prestation_id: 10, selected_variant_value_ids: [], selected_option_ids: [], answers: [] },
      { prestation_id: 11, selected_variant_value_ids: [], selected_option_ids: [], answers: [] },
    ]);
  });
});
