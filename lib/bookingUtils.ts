// Coerces API values (numbers, or strings using French "123,45" or standard
// "123.45" decimal notation) into a safe number, defaulting to 0.
export function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const normalized = String(v ?? "0").replace(/\s/g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
}

export const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const calculateEndDateTime = (
  startDate: Date,
  startTime: string,
  durationMinutes: number
): Date => {
  const [hours, minutes] = startTime.split(":").map(Number);
  const start = new Date(startDate);
  start.setHours(hours, minutes, 0, 0);
  return new Date(start.getTime() + durationMinutes * 60_000);
};

export function resolvePaymentType(depositPercentage: number): "full" | "deposit" {
  return depositPercentage === 100 ? "full" : "deposit";
}

// Not called from any screen (the server always returns deposit_amount
// directly, see backend/server.ts's reservation-creation endpoint) but
// covered by __tests__/payments/booking-calculations.test.ts — kept as the
// documented reference implementation that test asserts against.
export function computeDepositAmount(price: number, depositPercentage: number): number {
  return Math.round((price * depositPercentage) / 100 * 100) / 100;
}

export function computeRemainingBalance(price: number, totalPaid: number): number {
  return Math.max(0, price - totalPaid);
}

export function canPayOnline(
  stripeOnboardingComplete: boolean,
  acceptOnlinePayment: boolean
): boolean {
  return stripeOnboardingComplete && acceptOnlinePayment;
}

/**
 * Annulation / report d'un RDV : possible uniquement tant que le délai de
 * prévenance fixé par la pro (`cancellation_notice_hours`, 24h par défaut)
 * n'est pas dépassé. Le backend applique la même règle côté API.
 */
export function canModifyBooking(b: {
  start_datetime: string;
  cancellation_notice_hours?: number | null;
}, now: number = Date.now()): boolean {
  const notice = b.cancellation_notice_hours ?? 24;
  const deadline = new Date(b.start_datetime).getTime() - notice * 3_600_000;
  return now < deadline;
}
