// Normalizes GET /api/admin/dashboard/stats — the backend's exact key casing
// (snake_case vs camelCase) isn't guaranteed, so every screen reading these
// stats must go through this instead of indexing `raw.stats.xxx` directly.
// dashboard.tsx and more.tsx both render a subset of this same payload; before
// this existed, each screen normalized independently and drifted (more.tsx
// read keys dashboard.tsx never even produced, so its tiles stayed blank).
export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  todayBookings: number;
  monthBookings: number;
  monthRevenue: number;
  bookingsByStatus: Record<string, number>;
  revenueChange: number | null;
  // Abonnements pros = le vrai CA plateforme. Optionnels : un backend pas
  // encore déployé ne les renvoie pas → 0 / null, le hero retombe sur le CA
  // de réservations.
  subMrr: number;
  subsActive: number;
  subsThisMonth: number;
  subsChange: number | null;
  collectedThisMonth: number;
  subsByPlan: { start: number; serenite: number; signature: number };
}

export function normalizeAdminDashboardStats(raw: unknown): AdminDashboardStats | null {
  const r = raw as Record<string, any> | null | undefined;
  if (!r) return null;
  return {
    totalUsers:    r.total_users     ?? r.totalUsers     ?? 0,
    activeUsers:   r.active_users    ?? r.activeUsers     ?? 0,
    todayBookings: r.today_bookings  ?? r.bookings_today  ?? r.todayBookings  ?? 0,
    monthBookings: r.month_bookings  ?? r.bookings_month  ?? r.monthBookings  ?? r.total_bookings ?? r.totalBookings ?? 0,
    monthRevenue:  r.revenue_month   ?? r.month_revenue   ?? r.monthRevenue   ?? 0,
    bookingsByStatus: (r.bookings_by_status ?? r.bookingsByStatus ?? {}) as Record<string, number>,
    revenueChange: r.changes?.revenue ?? null,
    subMrr:             Number(r.sub_mrr ?? r.subMrr ?? 0),
    subsActive:         Number(r.subs_active ?? r.subsActive ?? 0),
    subsThisMonth:      Number(r.subs_this_month ?? r.subsThisMonth ?? 0),
    subsChange:         r.changes?.subscriptions ?? null,
    collectedThisMonth: Number(r.collected_this_month ?? r.collectedThisMonth ?? 0),
    subsByPlan: {
      start:     Number(r.subs_by_plan?.start     ?? r.subsByPlan?.start     ?? 0),
      serenite:  Number(r.subs_by_plan?.serenite  ?? r.subsByPlan?.serenite  ?? 0),
      signature: Number(r.subs_by_plan?.signature ?? r.subsByPlan?.signature ?? 0),
    },
  };
}
