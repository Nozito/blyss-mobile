import { storage } from "./storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export const getApiEndpoint = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

// ── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  birth_date: string;
  is_verified: boolean;
  is_admin: boolean;
  role: "client" | "pro";
  created_at: string;
  profile_visibility: string;
  activity_name?: string | null;
  city?: string | null;
  instagram_account?: string | null;
  profile_photo?: string | null;
  banner_photo?: string | null;
  bio?: string | null;
  pro_specialties?: string[] | null;
  pro_status?: "active" | "inactive" | "suspended" | null;
  clients_count?: number;
  avg_rating?: number | null;
  years_on_blyss?: number;
  bankaccountname?: string | null;
  IBAN?: string | null;
  accept_online_payment?: 0 | 1;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone_number: string;
  birth_date: string;
  role: "client" | "pro";
  accepted_terms?: boolean;
  activity_name?: string | null;
  city?: string | null;
  instagram_account?: string | null;
}

export type SignupErrorCode =
  | "email_exists"
  | "weak_password"
  | "age_restriction"
  | "invalid_phone"
  | "invalid_email"
  | "missing_fields"
  | "data_too_long"
  | "server_error";

export interface SignupResponse {
  success: boolean;
  message?: string;
  error?: SignupErrorCode;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ClientNotificationSettings {
  reminders: boolean;
  changes: boolean;
  messages: boolean;
  late: boolean;
  offers: boolean;
  email_summary: boolean;
}

export interface ProNotificationSettings {
  new_reservation: boolean;
  cancel_change: boolean;
  daily_reminder: boolean;
  client_message: boolean;
  payment_alert: boolean;
  activity_summary: boolean;
}

export interface PaymentsSettings {
  bankaccountname: string | null;
  IBAN: string | null;
  accept_online_payment: 0 | 1;
}

export interface SavedCard {
  id: number;
  brand: "visa" | "mastercard" | "amex";
  last4: string;
  exp_month: string;
  exp_year: string;
  cardholder_name: string;
  is_default: boolean;
}

export interface ClientNote {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  notes: string | null;
  allergies: string | null;
  preferred_shape: string | null;
  preferred_style: string | null;
  patch_test_done: boolean;
  patch_test_date: string | null;
  updated_at?: string;
}

export interface BlockedClient {
  id: number;
  client_id: number;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo: string | null;
  reason: string | null;
  created_at: string;
}

export interface WaitingListEntry {
  id: number;
  pro_id: number;
  prestation_id: number | null;
  preferred_date: string | null;
  note: string | null;
  created_at: string;
  pro_name: string;
  pro_photo: string | null;
  prestation_name: string | null;
}

export interface InstagramPhoto {
  media_id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string;
  thumbnail_url: string | null;
  permalink: string;
  caption: string | null;
  ig_timestamp: string;
  display_order: number;
}

export interface InstagramStatus {
  connected: boolean;
  username?: string;
  expiresAt?: string;
}

// ── HTTP core ───────────────────────────────────────────────────────────────

async function rawApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ response: Response; json: T | null }> {
  const accessToken = await storage.getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let json: T | null = null;
  try {
    json = (await response.json()) as T;
  } catch {
    json = null;
  }

  return { response, json };
}

let _refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = (async () => {
    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) {
        await storage.clearAll();
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await storage.clearAll();
        return false;
      }

      const json = (await response.json()) as {
        data?: { accessToken?: string; refreshToken?: string };
      };
      const { accessToken, refreshToken: newRefreshToken } = json.data ?? {};
      if (accessToken) {
        await storage.setTokens(accessToken, newRefreshToken ?? refreshToken);
      }
      return true;
    } catch {
      await storage.clearAll();
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>>;
async function apiCall<T>(method: string, endpoint: string, options?: RequestInit): Promise<ApiResponse<T>>;
async function apiCall<T>(a: string, b?: RequestInit | string, c: RequestInit = {}): Promise<ApiResponse<T>> {
  let endpoint: string;
  let options: RequestInit;

  if (typeof b === "string") {
    endpoint = b;
    options = { ...c, method: a };
  } else {
    endpoint = a;
    options = b ?? {};
  }

  try {
    let { response, json } = await rawApiCall<{ success?: boolean; data?: T; message?: string; error?: string }>(
      endpoint,
      options
    );

    if (response.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        ({ response, json } = await rawApiCall<{ success?: boolean; data?: T; message?: string; error?: string }>(endpoint, options));
      } else {
        return { success: false, error: "Session expirée, veuillez vous reconnecter" };
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: json?.message ?? json?.error ?? "Une erreur est survenue",
      };
    }

    return {
      success: true,
      data: (json as { data?: T })?.data ?? (json as T | null) ?? undefined,
      message: (json as { message?: string })?.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de connexion au serveur",
    };
  }
}

// ── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (
    credentials: LoginCredentials
  ): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> => {
    const { response, json } = await rawApiCall<{
      success: boolean;
      data: { user: User; accessToken: string; refreshToken: string };
      message?: string;
      error?: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (!response.ok || !json?.success) {
      return { success: false, error: json?.message ?? json?.error ?? "Erreur de connexion" };
    }

    const { user, accessToken, refreshToken } = json.data;
    await storage.setTokens(accessToken, refreshToken);

    return { success: true, data: { user, accessToken, refreshToken } };
  },

  signup: async (data: SignupData): Promise<SignupResponse> => {
    try {
      const { response, json } = await rawApiCall<{
        success: boolean;
        message?: string;
        error?: SignupErrorCode;
        data?: { accessToken?: string; refreshToken?: string };
      }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (response.ok && json?.success) {
        // Store tokens if server sets them on signup
        if (json.data?.accessToken && json.data?.refreshToken) {
          await storage.setTokens(json.data.accessToken, json.data.refreshToken);
        }
        return { success: true, message: json.message };
      }

      return { success: false, message: json?.message, error: json?.error };
    } catch {
      return { success: false, message: "Network error", error: "server_error" };
    }
  },

  getProfile: async (): Promise<ApiResponse<User>> => apiCall("/api/auth/profile"),

  updateProfile: async (data: Partial<User>): Promise<ApiResponse<User>> =>
    apiCall("/api/auth/profile", { method: "PUT", body: JSON.stringify(data) }),

  forgotPassword: async (email: string): Promise<ApiResponse<void>> =>
    apiCall("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: async (data: { token: string; password: string }): Promise<ApiResponse<void>> =>
    apiCall("/api/auth/reset-password", { method: "POST", body: JSON.stringify(data) }),

  logout: async (): Promise<void> => {
    try {
      await rawApiCall("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      await storage.clearAll();
    }
  },

  deleteAccount: async (): Promise<ApiResponse<void>> =>
    apiCall("/api/auth/delete-account", { method: "DELETE" }),

  exportData: async (): Promise<ApiResponse<string>> => {
    try {
      const accessToken = await storage.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/auth/export-data`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) {
        return { success: false, error: "Erreur lors de l'export de données" };
      }
      const text = await response.text();
      return { success: true, data: text };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Erreur de connexion" };
    }
  },
};

// ── Bookings API ─────────────────────────────────────────────────────────────

export const bookingsApi = {
  getAll: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/bookings"),
  getById: (id: string): Promise<ApiResponse<unknown>> => apiCall(`/api/bookings/${id}`),
  create: (data: unknown): Promise<ApiResponse<unknown>> =>
    apiCall("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
  cancel: (id: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/bookings/${id}/cancel`, { method: "POST" }),
};

// ── Specialists API ───────────────────────────────────────────────────────────

export const specialistsApi = {
  getPros: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    service?: string;
    min_rating?: number;
    lat?: number;
    lng?: number;
    radius?: number;
    nearby?: boolean;
  }): Promise<ApiResponse<unknown[]>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    if (params?.city) q.set("city", params.city);
    if (params?.service) q.set("service", params.service);
    if (params?.min_rating) q.set("min_rating", String(params.min_rating));
    if (params?.lat != null) q.set("lat", String(params.lat));
    if (params?.lng != null) q.set("lng", String(params.lng));
    if (params?.radius) q.set("radius", String(params.radius));
    if (params?.nearby) q.set("nearby", "1");
    const qs = q.toString() ? `?${q}` : "";
    return apiCall(`/api/users/pros${qs}`);
  },

  getSpecialists: (params?: { page?: number; limit?: number; search?: string; city?: string }) => {
    const query = params
      ? "?" + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&")
      : "";
    return apiCall("GET", `/api/client/specialists${query}`);
  },

  getSpecialistById: (id: number) => apiCall("GET", `/api/client/specialists/${id}`),

  getProById: (id: number) => apiCall(`/api/users/pros/${id}`),

  getServices: (proId: number) => apiCall("GET", `/api/prestations/pro/${proId}`),
};

// ── Reviews API ───────────────────────────────────────────────────────────────

export const reviewsApi = {
  create: (specialistId: string, data: { rating: number; comment: string }): Promise<ApiResponse<unknown>> =>
    apiCall(`/api/specialists/${specialistId}/reviews`, { method: "POST", body: JSON.stringify(data) }),

  getBySpecialist: (specialistId: string): Promise<ApiResponse<unknown[]>> =>
    apiCall(`/api/reviews/pro/${specialistId}`),
};

// ── Favorites API ─────────────────────────────────────────────────────────────

export const favoritesApi = {
  getAll: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/favorites"),

  add: (proId: number): Promise<ApiResponse<{ id: number; pro_id: number; isFavorite: boolean }>> =>
    apiCall("/api/favorites", { method: "POST", body: JSON.stringify({ pro_id: proId }) }),

  remove: (proId: number): Promise<ApiResponse<{ isFavorite: boolean }>> =>
    apiCall(`/api/favorites/${proId}`, { method: "DELETE" }),

  check: (proId: number): Promise<ApiResponse<{ isFavorite: boolean; favoriteId: number | null }>> =>
    apiCall(`/api/favorites/check/${proId}`),
};

// ── Notifications API ─────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/notifications"),
  markAsRead: (id: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/notifications/${id}/read`, { method: "POST" }),
  getSettings: (): Promise<ApiResponse<ClientNotificationSettings>> =>
    apiCall("/api/client/notification-settings"),
  updateSettings: (settings: Partial<ClientNotificationSettings>): Promise<ApiResponse<ClientNotificationSettings>> =>
    apiCall("/api/client/notification-settings", { method: "PUT", body: JSON.stringify(settings) }),
  savePushToken: (token: string): Promise<ApiResponse<void>> =>
    apiCall("/api/notifications/push-token", { method: "POST", body: JSON.stringify({ token }) }),
};

// ── Pro API ───────────────────────────────────────────────────────────────────

export const proApi = {
  getDashboard: (): Promise<ApiResponse<unknown>> => apiCall("/api/pro/dashboard"),

  getCalendar: (params?: { from?: string; to?: string }) => {
    const q = params ? `?from=${params.from ?? ""}&to=${params.to ?? ""}` : "";
    return apiCall<unknown[]>(`/api/pro/calendar${q}`);
  },

  getClients: () => apiCall<unknown[]>("/api/pro/clients"),

  getSubscription: () =>
    apiCall<{
      id: number;
      plan: "start" | "serenite" | "signature";
      billingType: "monthly" | "one_time";
      monthlyPrice: number;
      totalPrice: number | null;
      commitmentMonths: number | null;
      startDate: string;
      endDate: string | null;
      status: string;
    } | null>("/api/pro/subscription"),

  cancelSubscription: () => apiCall("/api/pro/subscription/cancel", { method: "PUT" }),

  createSubscription: (data: { plan: string; billingType: "monthly" | "one_time"; monthlyPrice: number; paymentId: string }) =>
    apiCall("/api/pro/subscription", { method: "POST", body: JSON.stringify(data) }),

  updateSubscription: (data: { plan: string }) =>
    apiCall("/api/pro/subscription/change", { method: "PUT", body: JSON.stringify(data) }),

  getProfile: () => apiCall<User>("/api/users"),

  updateProfile: (data: Record<string, unknown>) =>
    apiCall("/api/users/update", { method: "PUT", body: JSON.stringify(data) }),

  getPaymentSettings: () => apiCall<PaymentsSettings>("/api/users"),

  updatePaymentSettings: (data: { iban?: string; accept_online?: boolean }) =>
    apiCall("/api/users/payments", { method: "PUT", body: JSON.stringify({
      IBAN: data.iban,
      accept_online_payment: data.accept_online,
    }) }),

  getSlots: (params: { date: string }) =>
    apiCall<unknown[]>(`/api/pro/slots?date=${encodeURIComponent(params.date)}`),

  createSlot: (data: { date: string; time: string; duration: number }) =>
    apiCall("/api/pro/slots", { method: "POST", body: JSON.stringify(data) }),

  updateSlot: (id: number, data: { status?: string; date?: string; time?: string; duration?: number }) =>
    apiCall(`/api/pro/slots/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteSlot: (id: number) => apiCall(`/api/pro/slots/${id}`, { method: "DELETE" }),

  updateReservationStatus: (id: number, status: "completed" | "cancelled") =>
    apiCall(`/api/pro/reservations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getUnavailabilities: (params?: { from?: string; to?: string }) => {
    const q = params ? `?from=${params.from ?? ""}&to=${params.to ?? ""}` : "";
    return apiCall<unknown[]>(`/api/pro/unavailabilities${q}`);
  },

  createUnavailability: (data: { start_date: string; end_date: string; reason?: string }) =>
    apiCall("/api/pro/unavailabilities", { method: "POST", body: JSON.stringify(data) }),

  deleteUnavailability: (id: number) =>
    apiCall(`/api/pro/unavailabilities/${id}`, { method: "DELETE" }),

  getNotificationSettings: (): Promise<ApiResponse<ProNotificationSettings>> =>
    apiCall("/api/pro/notification-settings"),

  updateNotificationSettings: (settings: Partial<ProNotificationSettings>): Promise<ApiResponse<ProNotificationSettings>> =>
    apiCall("/api/pro/notification-settings", { method: "PUT", body: JSON.stringify(settings) }),

  getServices: () => apiCall<unknown[]>("/api/pro/prestations"),

  createService: (data: { name: string; description: string; price: number; duration_minutes: number; active?: boolean }) =>
    apiCall("/api/pro/prestations", { method: "POST", body: JSON.stringify(data) }),

  updateService: (id: number, data: Partial<{ name: string; description: string; price: number; duration_minutes: number; active: boolean }>) =>
    apiCall(`/api/pro/prestations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteService: (id: number) => apiCall(`/api/pro/prestations/${id}`, { method: "DELETE" }),

  duplicateService: (id: number) =>
    apiCall(`/api/pro/prestations/${id}/duplicate`, { method: "POST" }),

  getFinanceStats: () =>
    apiCall<{
      today: number;
      week: number;
      month: number;
      lastMonth: number;
      objective: number;
      forecast: number;
      topServices: Array<{ name: string; revenue: number; count: number; percentage: number }>;
      trend: "up" | "down" | "stable";
    }>("/api/pro/finance/stats"),

  updateFinanceObjective: (objective: number) =>
    apiCall("/api/pro/finance/objective", { method: "PUT", body: JSON.stringify({ objective }) }),
};

// ── Client API ────────────────────────────────────────────────────────────────

export const clientApi = {
  getMyBookings: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/client/my-booking"),
  getBookingDetail: (id: number): Promise<ApiResponse<unknown>> =>
    apiCall(`/api/client/booking-detail/${id}`),
  cancelBooking: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/client/my-booking/${id}/cancel`, { method: "PATCH" }),
  cancelReservationWithPolicy: (reservationId: number): Promise<ApiResponse<{ reservation_id: number; deadline?: string }>> =>
    apiCall(`/api/reservations/${reservationId}/cancel`, { method: "POST" }),
  rescheduleBooking: (id: number, data: { start_datetime: string; end_datetime: string; slot_id: number }): Promise<ApiResponse<void>> =>
    apiCall(`/api/client/my-booking/${id}/reschedule`, { method: "PATCH", body: JSON.stringify(data) }),
  getAvailableSlots: (proId: number, date: string): Promise<ApiResponse<Array<{ id: number; time: string }>>> =>
    apiCall(`/api/slots/available/${proId}/${date}`),
};

// ── Payments API ──────────────────────────────────────────────────────────────

export const paymentsApi = {
  updateProPayments: (data: { bankaccountname: string; IBAN: string; accept_online_payment: boolean }): Promise<ApiResponse<PaymentsSettings>> =>
    apiCall("/api/users/payments", { method: "PUT", body: JSON.stringify(data) }),
};

export const stripePaymentsApi = {
  createPaymentIntent: (data: { reservation_id: number; type: "deposit" | "balance" | "full" }): Promise<ApiResponse<{ client_secret: string; payment_intent_id: string; amount: number }>> =>
    apiCall("/api/payments/create-intent", { method: "POST", body: JSON.stringify(data) }),

  createReservation: (data: {
    pro_id: number;
    prestation_id: number;
    start_datetime: string;
    end_datetime: string;
    price: number;
    slot_id?: number | null;
    payment_method: "online" | "on_site";
  }): Promise<ApiResponse<{ id: number; deposit_percentage: number; deposit_amount: number | null; price: number }>> =>
    apiCall("/api/reservations", { method: "POST", body: JSON.stringify(data) }),

  getPaymentStatus: (reservationId: number): Promise<ApiResponse<{ payment_status: string; price: number; total_paid: number; deposit_amount: number | null; remaining: number }>> =>
    apiCall(`/api/reservations/${reservationId}/payment-status`),

  markPaidOnSite: (reservationId: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/reservations/${reservationId}/pay-on-site`, { method: "PUT" }),
};

export const stripeApi = {
  onboard: (): Promise<ApiResponse<{ url: string }>> =>
    apiCall("/api/pro/stripe/onboard", { method: "POST" }),

  getAccount: (): Promise<ApiResponse<{ has_account: boolean; onboarding_complete: boolean; charges_enabled?: boolean; payouts_enabled?: boolean; deposit_percentage: number }>> =>
    apiCall("/api/pro/stripe/account"),

  updateDeposit: (deposit_percentage: number): Promise<ApiResponse<{ deposit_percentage: number }>> =>
    apiCall("/api/pro/stripe/deposit", { method: "PUT", body: JSON.stringify({ deposit_percentage }) }),
};

// ── Instagram API ─────────────────────────────────────────────────────────────

export const instagramApi = {
  getStatus: (): Promise<ApiResponse<InstagramStatus>> => apiCall("/api/instagram/status"),
  disconnect: (): Promise<ApiResponse<void>> => apiCall("/api/instagram/disconnect", { method: "DELETE" }),
  sync: (): Promise<ApiResponse<boolean>> => apiCall("/api/instagram/sync", { method: "POST" }),
  getPublicPhotos: async (proId: number): Promise<ApiResponse<{ photos: InstagramPhoto[]; connected: boolean; username?: string }>> => {
    const res = await fetch(`${API_BASE_URL}/api/public/pro/${proId}/instagram`);
    return res.json() as Promise<ApiResponse<{ photos: InstagramPhoto[]; connected: boolean; username?: string }>>;
  },
};

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
  getMe: (): Promise<ApiResponse<User>> => apiCall("/api/users"),
  update: (data: Record<string, unknown>): Promise<ApiResponse<User>> =>
    apiCall("/api/users/update", { method: "PUT", body: JSON.stringify(data) }),

  uploadProfilePhoto: async (uri: string): Promise<ApiResponse<{ photo: string }>> => {
    try {
      const accessToken = await storage.getAccessToken();
      const filename = uri.split("/").pop() ?? "photo.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const formData = new FormData();
      // @ts-expect-error — React Native FormData accepts { uri, name, type }
      formData.append("photo", { uri, name: filename, type: mimeType });

      const response = await fetch(`${API_BASE_URL}/api/users/upload-photo`, {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          // No Content-Type — fetch sets the multipart boundary automatically
        },
        body: formData,
      });

      const json = await response.json().catch(() => null) as { success?: boolean; photo?: string; message?: string } | null;

      if (!response.ok || !json?.success) {
        return { success: false, error: json?.message ?? "Erreur lors de l'upload" };
      }
      return { success: true, data: { photo: json.photo ?? "" } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Erreur de connexion" };
    }
  },

  uploadBannerPhoto: async (uri: string): Promise<ApiResponse<{ banner_photo: string }>> => {
    try {
      const accessToken = await storage.getAccessToken();
      const filename = uri.split("/").pop() ?? "banner.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const formData = new FormData();
      // @ts-expect-error — React Native FormData accepts { uri, name, type }
      formData.append("banner", { uri, name: filename, type: mimeType });

      const response = await fetch(`${API_BASE_URL}/api/users/upload-banner`, {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          // No Content-Type — fetch sets the multipart boundary automatically
        },
        body: formData,
      });

      const json = await response.json().catch(() => null) as {
        success?: boolean; banner_photo?: string; message?: string;
      } | null;

      if (!response.ok || !json?.success) {
        return { success: false, error: json?.message ?? "Erreur lors de l'upload de la bannière" };
      }
      return { success: true, data: { banner_photo: json.banner_photo ?? "" } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Erreur de connexion" };
    }
  },
};

// ── Cancellation API ──────────────────────────────────────────────────────────

export const cancellationApi = {
  getPolicy: (): Promise<ApiResponse<{ success: boolean; cancellation_notice_hours: number }>> =>
    apiCall("/api/pro/settings/cancellation-policy"),

  updatePolicy: (hours: 0 | 2 | 4 | 6 | 12 | 24 | 48 | 72): Promise<ApiResponse<{ success: boolean; cancellation_notice_hours: number }>> =>
    apiCall("/api/pro/settings/cancellation-policy", {
      method: "PATCH",
      body: JSON.stringify({ cancellation_notice_hours: hours }),
    }),
};

// ── Nail-Tech API ─────────────────────────────────────────────────────────────

export const nailTechApi = {
  markNoShow: (reservationId: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/pro/reservations/${reservationId}/no-show`, { method: "PATCH" }),

  getClientNotes: (clientId: number): Promise<ApiResponse<ClientNote>> =>
    apiCall(`/api/pro/clients/${clientId}/notes`),

  updateClientNotes: (clientId: number, data: Partial<Omit<ClientNote, "first_name" | "last_name" | "email" | "phone_number" | "updated_at">>): Promise<ApiResponse<void>> =>
    apiCall(`/api/pro/clients/${clientId}/notes`, { method: "PATCH", body: JSON.stringify(data) }),

  blockClient: (clientId: number, reason?: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/pro/clients/${clientId}/block`, { method: "POST", body: JSON.stringify({ reason }) }),

  unblockClient: (clientId: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/pro/clients/${clientId}/block`, { method: "DELETE" }),

  getBlockedClients: (): Promise<ApiResponse<BlockedClient[]>> =>
    apiCall("/api/pro/blocked-clients"),

  joinWaitingList: (data: { pro_id: number; prestation_id?: number; preferred_date?: string; note?: string }): Promise<ApiResponse<void>> =>
    apiCall("/api/waiting-list", { method: "POST", body: JSON.stringify(data) }),

  leaveWaitingList: (proId: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/waiting-list/${proId}`, { method: "DELETE" }),

  getMyWaitingList: (): Promise<ApiResponse<WaitingListEntry[]>> =>
    apiCall("/api/client/waiting-list"),
};

// ── Payment Methods API ───────────────────────────────────────────────────────

export const paymentMethodsApi = {
  getAll: (): Promise<ApiResponse<SavedCard[]>> => apiCall("/api/client/payment-methods"),
  delete: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/client/payment-methods/${id}`, { method: "DELETE" }),
  setDefault: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/client/payment-methods/${id}/default`, { method: "PATCH" }),
  createSetupIntent: async (): Promise<{ clientSecret: string }> => {
    const res = await apiCall<{ clientSecret: string }>("/api/client/payment-methods/setup-intent", { method: "POST" });
    return res.data as { clientSecret: string };
  },
  confirmSetup: async (paymentMethodId: string): Promise<void> => {
    await apiCall("/api/client/payment-methods/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentMethodId }),
    });
  },
};

// ── Admin API ─────────────────────────────────────────────────────────────────

export const adminApi = {
  getDashboard: (): Promise<ApiResponse<unknown>> => apiCall("/api/admin/dashboard"),
  getDashboardStats: (): Promise<ApiResponse<unknown>> => apiCall("/api/admin/dashboard/stats"),
  getHealth: (): Promise<ApiResponse<unknown>> => apiCall("/api/health"),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) => {
    const q = params ? "?" + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ) : "";
    return apiCall(`/api/admin/users${q}`);
  },
  deactivateUser: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/users/${id}/deactivate`, { method: "PATCH" }),
  reactivateUser: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/users/${id}/reactivate`, { method: "PATCH" }),
  getBookings: (params?: { page?: number; limit?: number }) => {
    const q = params ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))) : "";
    return apiCall(`/api/admin/bookings${q}`);
  },
  getLogs: (params?: { date?: string }): Promise<ApiResponse<unknown[]>> => {
    const q = params?.date ? `?date=${params.date}` : "";
    return apiCall(`/api/admin/logs${q}`);
  },
  getPayments: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/admin/payments"),
  sendNotification: (data: { user_id: number; type: string; title: string; message: string }): Promise<ApiResponse<void>> =>
    apiCall("/api/admin/notifications/create", { method: "POST", body: JSON.stringify(data) }),
  getAnalytics: (): Promise<ApiResponse<unknown>> => apiCall("/api/admin/analytics"),
};

export default {
  auth: authApi,
  bookings: bookingsApi,
  specialists: specialistsApi,
  reviews: reviewsApi,
  favorites: favoritesApi,
  notifications: notificationsApi,
  payments: paymentsApi,
  stripePayments: stripePaymentsApi,
  stripe: stripeApi,
  instagram: instagramApi,
  users: usersApi,
  client: clientApi,
  pro: proApi,
  nailTech: nailTechApi,
  cancellation: cancellationApi,
  admin: adminApi,
};
