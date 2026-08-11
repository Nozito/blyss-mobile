// Pushes real data into the Pro/Admin Home Screen widget suite
// (RevenueWidget, GrowthWidget, AlertsWidget, DaySummaryWidget,
// PlatformOverviewWidget, NextAppointmentWidget). Each function here reads
// data a screen has *already fetched* for its own UI — no extra network
// calls — and forwards the relevant slice to the native module, which
// merges it into the shared App Group blob the widgets read from.
import { writeWidgetSnapshot } from "live-activity";
import { toNumber as n } from "@/lib/bookingUtils";

/** From GET /api/pro/dashboard — see app/(pro)/dashboard.tsx's DashData. */
export function syncProDashboardWidgets(raw?: {
  todayAppointmentsCount?: number;
  upcomingClients?: Array<{ time: string; status: "ongoing" | "upcoming" | "completed" }>;
}): void {
  if (!raw) return;
  const todayCount = n(raw.todayAppointmentsCount);

  if (todayCount === 0) {
    writeWidgetSnapshot({ daySummary: { state: "free" } });
    return;
  }

  const upcoming = raw.upcomingClients ?? [];
  const inProgressCount = upcoming.filter((c) => c.status === "ongoing").length;
  const next = upcoming.find((c) => c.status !== "completed");

  if (!next) {
    // Every appointment in the preview window is done — today's over.
    writeWidgetSnapshot({ daySummary: { state: "finished", completedCount: todayCount } });
    return;
  }

  // `next.time` is "HH:MM" (backend TO_CHAR, local time) with no date —
  // reconstruct against today since todayCount > 0 already confirms it's
  // today's appointment.
  const [hours, minutes] = next.time.split(":").map(Number);
  const nextTime = new Date();
  if (!Number.isNaN(hours) && !Number.isNaN(minutes)) nextTime.setHours(hours, minutes, 0, 0);

  writeWidgetSnapshot({
    daySummary: { state: "scheduled", count: todayCount, nextTime: nextTime.toISOString(), inProgressCount },
  });
}

/** From GET /api/pro/finance/stats — see app/(pro)/(profile)/finance.tsx. */
export function syncProFinanceWidgets(stats?: { month: number; lastMonth: number; objective: number } | null): void {
  if (!stats) return;
  const growthPercent = stats.lastMonth > 0 ? ((stats.month - stats.lastMonth) / stats.lastMonth) * 100 : 0;

  writeWidgetSnapshot({
    revenue: {
      monthAmountEuros: Math.round(stats.month),
      growthPercent,
      objectiveAmountEuros: stats.objective > 0 ? Math.round(stats.objective) : undefined,
    },
  });
}

/** From GET /api/pro/live-activity/next-appointment — see contexts/LiveActivityContext.tsx. */
export function syncNextAppointmentWidget(
  next: { startAt: string; endAt: string; prestationName: string | null; clientFirstName: string | null } | null
): void {
  if (!next) {
    writeWidgetSnapshot({ nextAppointment: null });
    return;
  }

  const durationMinutes = Math.max(
    0,
    Math.round((new Date(next.endAt).getTime() - new Date(next.startAt).getTime()) / 60_000)
  );

  writeWidgetSnapshot({
    nextAppointment: {
      // First name only — same privacy posture as the Live Activity and
      // LiveRdvHomeWidget, which never surface a client's full name either.
      clientFullName: next.clientFirstName ?? "Cliente",
      prestationName: next.prestationName ?? "Prestation",
      durationMinutes,
      startAt: next.startAt,
    },
  });
}

/** From GET /api/admin/dashboard/stats — see app/(admin)/dashboard.tsx. */
export function syncAdminDashboardWidgets(input: {
  todayRevenue: number;
  weekRevenue: number;
  revenueChange: number | null;
  pendingBookings: number;
  flaggedReviews: number;
}): void {
  writeWidgetSnapshot({
    growth: {
      todayAmountEuros: Math.round(input.todayRevenue),
      weekAmountEuros: Math.round(input.weekRevenue),
      growthPercent: input.revenueChange ?? 0,
    },
    alerts: {
      paymentsToVerify: input.pendingBookings,
      accountsToReview: input.flaggedReviews,
      // No dedicated "critical incident" signal on the admin dashboard yet —
      // always 0 until one exists.
      criticalIncidents: 0,
    },
  });
}

/**
 * Written whenever the signed-in account changes (see AuthContext) so each
 * widget's TimelineProvider can lock instead of showing figures meant for a
 * different role — a pro adding an Admin widget (or vice versa) can't be
 * prevented at the OS picker level, only gated once it's actually rendering.
 * `null` (logged out) locks every widget until the next sign-in.
 */
export function syncAccountRole(account: { role: "pro" | "client"; isAdmin: boolean } | null): void {
  writeWidgetSnapshot({
    accountRole: account?.role ?? null,
    accountIsAdmin: account?.isAdmin ?? false,
  });
}

/** From GET /api/admin/analytics — see app/(admin-tools)/analytics.tsx. */
export function syncAdminAnalyticsWidgets(
  a?: {
    users?: { total_pros?: number };
    bookings?: { last_30d?: number };
    revenue?: { growth?: number | null };
  } | null
): void {
  if (!a) return;
  writeWidgetSnapshot({
    platformOverview: {
      activePros: n(a.users?.total_pros),
      reservations: n(a.bookings?.last_30d),
      growthPercent: a.revenue?.growth ?? 0,
    },
  });
}
