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
  };
}
