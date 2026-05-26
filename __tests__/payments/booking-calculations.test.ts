/**
 * Tests unitaires — calculs purs du flow de réservation
 * Couvre : toLocalDateStr, calculateEndDateTime, logique deposit
 */

// ── Helpers copiés depuis app/booking.tsx (fonctions pures non exportées) ──────

const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const calculateEndDateTime = (
  startDate: Date,
  startTime: string,
  durationMinutes: number
): Date => {
  const [hours, minutes] = startTime.split(":").map(Number);
  const start = new Date(startDate);
  start.setHours(hours, minutes, 0, 0);
  return new Date(start.getTime() + durationMinutes * 60_000);
};

// ── Logique deposit (miroir de booking.tsx handleConfirmBooking) ───────────────

function resolvePaymentType(depositPercentage: number): "full" | "deposit" {
  return depositPercentage === 100 ? "full" : "deposit";
}

function computeDepositAmount(price: number, depositPercentage: number): number {
  return Math.round((price * depositPercentage) / 100 * 100) / 100;
}

function computeRemainingBalance(price: number, totalPaid: number): number {
  return Math.max(0, price - totalPaid);
}

function canPayOnline(
  stripeOnboardingComplete: boolean,
  acceptOnlinePayment: boolean
): boolean {
  return stripeOnboardingComplete && acceptOnlinePayment;
}

// ══════════════════════════════════════════════════════════════════════════════
// toLocalDateStr
// ══════════════════════════════════════════════════════════════════════════════

describe("toLocalDateStr", () => {
  it("formate une date en YYYY-MM-DD sans offset TZ", () => {
    const date = new Date(2025, 5, 15); // 15 juin 2025 (local)
    expect(toLocalDateStr(date)).toBe("2025-06-15");
  });

  it("pad les mois et jours sur 2 chiffres", () => {
    const date = new Date(2025, 0, 5); // 5 janvier 2025
    expect(toLocalDateStr(date)).toBe("2025-01-05");
  });

  it("gère correctement décembre (mois 11 → 12)", () => {
    const date = new Date(2025, 11, 31);
    expect(toLocalDateStr(date)).toBe("2025-12-31");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// calculateEndDateTime
// ══════════════════════════════════════════════════════════════════════════════

describe("calculateEndDateTime", () => {
  it("prestation 60 min à 10h00 → fin 11h00", () => {
    const start = new Date(2025, 5, 15);
    const end = calculateEndDateTime(start, "10:00", 60);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(0);
  });

  it("prestation 90 min à 14h30 → fin 16h00", () => {
    const start = new Date(2025, 5, 15);
    const end = calculateEndDateTime(start, "14:30", 90);
    expect(end.getHours()).toBe(16);
    expect(end.getMinutes()).toBe(0);
  });

  it("prestation 45 min à 23h30 → fin 00h15 le lendemain", () => {
    const start = new Date(2025, 5, 15);
    const end = calculateEndDateTime(start, "23:30", 45);
    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(0);
    expect(end.getMinutes()).toBe(15);
  });

  it("prestation 30 min à 09h00", () => {
    const start = new Date(2025, 5, 15);
    const end = calculateEndDateTime(start, "09:00", 30);
    expect(end.getHours()).toBe(9);
    expect(end.getMinutes()).toBe(30);
  });

  it("prestation 120 min (2h) à 08h00 → fin 10h00", () => {
    const start = new Date(2025, 5, 15);
    const end = calculateEndDateTime(start, "08:00", 120);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Logique deposit
// ══════════════════════════════════════════════════════════════════════════════

describe("resolvePaymentType", () => {
  it("100% deposit → type 'full'", () => {
    expect(resolvePaymentType(100)).toBe("full");
  });

  it("50% deposit → type 'deposit'", () => {
    expect(resolvePaymentType(50)).toBe("deposit");
  });

  it("25% deposit → type 'deposit'", () => {
    expect(resolvePaymentType(25)).toBe("deposit");
  });

  it("0% (pas de deposit) → type 'deposit'", () => {
    expect(resolvePaymentType(0)).toBe("deposit");
  });
});

describe("computeDepositAmount", () => {
  const price = 80;

  it("acompte 25% sur 80€ → 20€", () => {
    expect(computeDepositAmount(price, 25)).toBe(20);
  });

  it("acompte 50% sur 80€ → 40€", () => {
    expect(computeDepositAmount(price, 50)).toBe(40);
  });

  it("acompte 100% sur 80€ → 80€", () => {
    expect(computeDepositAmount(price, 100)).toBe(80);
  });

  it("acompte 0% → 0€", () => {
    expect(computeDepositAmount(price, 0)).toBe(0);
  });

  it("arrondit correctement : 33% sur 100€ → 33€", () => {
    expect(computeDepositAmount(100, 33)).toBe(33);
  });

  it("prix avec centimes : 25% sur 57.80€ → 14.45€", () => {
    expect(computeDepositAmount(57.8, 25)).toBe(14.45);
  });
});

describe("computeRemainingBalance", () => {
  it("80€ - 20€ payés → solde 60€", () => {
    expect(computeRemainingBalance(80, 20)).toBe(60);
  });

  it("80€ - 80€ payés → solde 0€", () => {
    expect(computeRemainingBalance(80, 80)).toBe(0);
  });

  it("ne retourne jamais négatif si trop perçu", () => {
    expect(computeRemainingBalance(80, 90)).toBe(0);
  });

  it("0€ payés → solde = prix total", () => {
    expect(computeRemainingBalance(80, 0)).toBe(80);
  });
});

describe("canPayOnline", () => {
  it("Stripe onboardé + paiement activé → true", () => {
    expect(canPayOnline(true, true)).toBe(true);
  });

  it("Stripe onboardé mais paiement désactivé → false", () => {
    expect(canPayOnline(true, false)).toBe(false);
  });

  it("Stripe non onboardé + paiement activé → false", () => {
    expect(canPayOnline(false, true)).toBe(false);
  });

  it("Stripe non onboardé + paiement désactivé → false", () => {
    expect(canPayOnline(false, false)).toBe(false);
  });
});
