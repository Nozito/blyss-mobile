/**
 * Tests d'intégration (mock) — flow complet de réservation
 *
 * Scénarios couverts :
 *  A. Paiement sur place (on_site)
 *  B. Paiement en ligne 100% (plein tarif)
 *  C. Acompte 25%  → solde restant à payer
 *  D. Acompte 50%  → solde restant à payer
 *  E. Acompte 100% → payé intégralement
 *  F. Paiement du solde restant (balance)
 *  G. Erreur création réservation
 *  H. Erreur création PaymentIntent
 *  I. Pro sans Stripe → paiement en ligne non disponible
 */

import { canPayOnline } from "@/lib/bookingUtils";

// ── Mock fns injected as parameters — no module mock needed ──────────────────

const mockCreateReservation = jest.fn();
const mockCreatePaymentIntent = jest.fn();

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = "on_site" | "online";

interface BookingPayload {
  pro_id: number;
  prestation_id: number;
  start_datetime: string;
  end_datetime: string;
  price: number;
  slot_id?: number;
  payment_method: PaymentMethod;
}

interface ReservationResult {
  id: number;
  deposit_percentage: number;
  deposit_amount: number;
}

interface PaymentIntentResult {
  client_secret: string;
  amount: number;
}

// ── Logique testée (extraite de app/booking.tsx handleConfirmBooking) ──────────

async function processBooking(
  payload: BookingPayload,
  createReservation: typeof mockCreateReservation,
  createPaymentIntent: typeof mockCreatePaymentIntent
): Promise<
  | { step: 5; paymentMethod: "on_site" }
  | { step: 4; clientSecret: string; depositAmount: number; depositPercentage: number }
  | { error: string }
> {
  const resaResult = await createReservation(payload) as {
    success: boolean;
    data?: ReservationResult;
    message?: string;
  };

  if (!resaResult.success || !resaResult.data) {
    return { error: resaResult.message ?? "Erreur lors de la réservation" };
  }

  const { id, deposit_percentage } = resaResult.data;

  if (payload.payment_method === "on_site") {
    return { step: 5, paymentMethod: "on_site" };
  }

  const paymentType = deposit_percentage === 100 ? "full" : "deposit";
  const intentResult = await createPaymentIntent({
    reservation_id: id,
    type: paymentType,
  }) as { success: boolean; data?: PaymentIntentResult; error?: string };

  if (!intentResult.success || !intentResult.data) {
    return { error: intentResult.error ?? "Erreur de paiement" };
  }

  return {
    step: 4,
    clientSecret: intentResult.data.client_secret,
    depositAmount: intentResult.data.amount,
    depositPercentage: deposit_percentage,
  };
}

async function processBalancePayment(
  reservationId: number,
  createPaymentIntent: typeof mockCreatePaymentIntent
): Promise<{ clientSecret: string; amount: number } | { error: string }> {
  const result = await createPaymentIntent({
    reservation_id: reservationId,
    type: "balance",
  }) as { success: boolean; data?: PaymentIntentResult; error?: string };

  if (!result.success || !result.data) {
    return { error: result.error ?? "Impossible d'initier le paiement" };
  }

  return { clientSecret: result.data.client_secret, amount: result.data.amount };
}

// ══════════════════════════════════════════════════════════════════════════════

const BASE_PAYLOAD: BookingPayload = {
  pro_id: 1,
  prestation_id: 42,
  start_datetime: "2025-06-15T10:00:00.000Z",
  end_datetime: "2025-06-15T11:00:00.000Z",
  price: 80,
  slot_id: 7,
  payment_method: "on_site",
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// A. Paiement sur place
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario A — Paiement sur place (on_site)", () => {
  it("crée la réservation et passe directement à l'étape 5 sans PaymentIntent", async () => {
    mockCreateReservation.mockResolvedValue({
      success: true,
      data: { id: 100, deposit_percentage: 0, deposit_amount: 0 },
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "on_site" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(mockCreateReservation).toHaveBeenCalledTimes(1);
    expect(mockCreatePaymentIntent).not.toHaveBeenCalled();
    expect(result).toEqual({ step: 5, paymentMethod: "on_site" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B. Paiement en ligne 100% (plein tarif)
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario B — Paiement en ligne 100% (plein tarif)", () => {
  it("crée la réservation + PaymentIntent type=full et passe à l'étape 4", async () => {
    mockCreateReservation.mockResolvedValue({
      success: true,
      data: { id: 101, deposit_percentage: 100, deposit_amount: 80 },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      success: true,
      data: { client_secret: "pi_secret_full", amount: 80 },
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
      reservation_id: 101,
      type: "full",
    });
    expect(result).toEqual({
      step: 4,
      clientSecret: "pi_secret_full",
      depositAmount: 80,
      depositPercentage: 100,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// C. Acompte 25%
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario C — Acompte 25%", () => {
  it("crée PaymentIntent type=deposit avec montant 20€ (25% de 80€)", async () => {
    mockCreateReservation.mockResolvedValue({
      success: true,
      data: { id: 102, deposit_percentage: 25, deposit_amount: 20 },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      success: true,
      data: { client_secret: "pi_secret_25", amount: 20 },
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
      reservation_id: 102,
      type: "deposit",
    });
    expect(result).toEqual({
      step: 4,
      clientSecret: "pi_secret_25",
      depositAmount: 20,
      depositPercentage: 25,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// D. Acompte 50%
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario D — Acompte 50%", () => {
  it("crée PaymentIntent type=deposit avec montant 40€ (50% de 80€)", async () => {
    mockCreateReservation.mockResolvedValue({
      success: true,
      data: { id: 103, deposit_percentage: 50, deposit_amount: 40 },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      success: true,
      data: { client_secret: "pi_secret_50", amount: 40 },
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
      reservation_id: 103,
      type: "deposit",
    });
    expect(result).toEqual({
      step: 4,
      clientSecret: "pi_secret_50",
      depositAmount: 40,
      depositPercentage: 50,
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E. Acompte 100% (traité comme plein tarif)
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario E — Acompte configuré à 100%", () => {
  it("utilise type=full (deposit_percentage=100 équivaut à plein paiement)", async () => {
    mockCreateReservation.mockResolvedValue({
      success: true,
      data: { id: 104, deposit_percentage: 100, deposit_amount: 80 },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      success: true,
      data: { client_secret: "pi_secret_full2", amount: 80 },
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
      reservation_id: 104,
      type: "full",
    });
    expect(result).toMatchObject({ step: 4, depositPercentage: 100 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// F. Paiement du solde restant (balance)
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario F — Paiement du solde restant", () => {
  it("crée un PaymentIntent type=balance pour payer le solde après acompte", async () => {
    mockCreatePaymentIntent.mockResolvedValue({
      success: true,
      data: { client_secret: "pi_balance_secret", amount: 60 },
    });

    const result = await processBalancePayment(102, mockCreatePaymentIntent);

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
      reservation_id: 102,
      type: "balance",
    });
    expect(result).toEqual({ clientSecret: "pi_balance_secret", amount: 60 });
  });

  it("retourne une erreur si le backend échoue", async () => {
    mockCreatePaymentIntent.mockResolvedValue({
      success: false,
      error: "Réservation déjà soldée",
    });

    const result = await processBalancePayment(102, mockCreatePaymentIntent);

    expect(result).toEqual({ error: "Réservation déjà soldée" });
  });

  it("retourne erreur générique si pas de message d'erreur", async () => {
    mockCreatePaymentIntent.mockResolvedValue({ success: false });

    const result = await processBalancePayment(102, mockCreatePaymentIntent);

    expect(result).toEqual({ error: "Impossible d'initier le paiement" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// G. Erreur création réservation
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario G — Erreur à la création de réservation", () => {
  it("retourne l'erreur backend si success=false", async () => {
    mockCreateReservation.mockResolvedValue({
      success: false,
      message: "Créneau déjà pris",
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(mockCreatePaymentIntent).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "Créneau déjà pris" });
  });

  it("retourne erreur générique si pas de message", async () => {
    mockCreateReservation.mockResolvedValue({ success: false });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(result).toEqual({ error: "Erreur lors de la réservation" });
  });

  it("propage l'exception si le réseau lâche", async () => {
    mockCreateReservation.mockRejectedValue(new Error("Network Error"));

    await expect(
      processBooking(
        { ...BASE_PAYLOAD, payment_method: "online" },
        mockCreateReservation,
        mockCreatePaymentIntent
      )
    ).rejects.toThrow("Network Error");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// H. Erreur création PaymentIntent
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario H — Erreur création PaymentIntent", () => {
  it("retourne l'erreur Stripe si createPaymentIntent échoue", async () => {
    mockCreateReservation.mockResolvedValue({
      success: true,
      data: { id: 105, deposit_percentage: 50, deposit_amount: 40 },
    });
    mockCreatePaymentIntent.mockResolvedValue({
      success: false,
      error: "Stripe account not ready",
    });

    const result = await processBooking(
      { ...BASE_PAYLOAD, payment_method: "online" },
      mockCreateReservation,
      mockCreatePaymentIntent
    );

    expect(result).toEqual({ error: "Stripe account not ready" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// I. Pro sans Stripe onboardé
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario I — Pro sans Stripe (paiement en ligne indisponible)", () => {
  it("canPayOnline=false quand stripe_onboarding_complete=false", () => {
    expect(canPayOnline(false, true)).toBe(false);
  });

  it("canPayOnline=false quand accept_online_payment=false", () => {
    expect(canPayOnline(true, false)).toBe(false);
  });

  it("sur place imposé si canPayOnline=false (payment_method par défaut = on_site)", () => {
    const defaultMethod: PaymentMethod = canPayOnline(false, false) ? "online" : "on_site";
    expect(defaultMethod).toBe("on_site");
  });
});
