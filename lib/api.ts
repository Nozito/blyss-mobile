import { storage } from "./storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

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
  accept_online_payment?: boolean;
  geo_precision?: "city" | "address" | null;
  address_line?: string | null;
  postal_code?: string | null;
  service_radius_km?: number | null;
  service_area_label?: string | null;
  acceptance_conditions?: { text: string; accepted: boolean }[] | null;
  /** Chantier 4 : true ⇒ la pro est sur le moteur de disponibilités (working_hours). */
  uses_availability_engine?: boolean;
}

export interface WorkingHoursRange {
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
}
export interface WorkingHoursDay {
  weekday: number; // 0 = dimanche … 6 = samedi
  ranges: WorkingHoursRange[];
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

// ── Moteur de disponibilités (chantier 3.2/3.3/3.4) ───────────────────────────

export interface AvailabilitySlot {
  /** Instant ISO — départ visible du RDV. */
  start: string;
  /** Instant ISO — fin visible du RDV. */
  end: string;
}

export interface AvailabilityResponse {
  timezone: string;
  requested_duration_minutes: number;
  total_blocked_minutes: number;
  days: Array<{ date: string; slots: AvailabilitySlot[] }>;
}

export type ManualOverrideMode = "outside_hours" | "conflict";

/** Réponse de POST /api/pro/appointments — succès ou refus exploitable. */
export type CreateAppointmentResult =
  | {
      success: true;
      data: { id: number; price: number; override_applied: ManualOverrideMode | null };
    }
  | {
      success: false;
      error: string;
      /** Code machine backend : SLOT_NO_LONGER_AVAILABLE, OUTSIDE_WORKING_HOURS, … */
      code?: string;
      /** Créneaux de repli proposés par le backend (best-effort). */
      alternativeSlots?: AvailabilitySlot[];
      /** true ⇒ la pro peut relancer en mode override (hors horaires / conflit). */
      canOverride?: boolean;
      status?: number;
    };

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
        return { success: false, error: "Session expirée, reconnecte-toi" };
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: json?.message ?? json?.error ?? "Une erreur est survenue",
      };
    }

    // `json.data` can legitimately be `null` (e.g. "no active subscription").
    // `??` can't tell that apart from a missing `data` key, so it must be
    // checked explicitly — otherwise a null `data` gets replaced by the whole
    // envelope object as a false-truthy fallback.
    const hasDataKey = json != null && typeof json === "object" && "data" in json;
    return {
      success: true,
      data: hasDataKey ? (json as { data?: T }).data : ((json as T | null) ?? undefined),
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

  loginWithApple: async (data: {
    identityToken: string;
    authorizationCode: string;
    email?: string | null;
    fullName?: { givenName?: string | null; familyName?: string | null } | null;
  }): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> => {
    const { response, json } = await rawApiCall<{
      success: boolean;
      data: { user: User; accessToken: string; refreshToken: string };
      message?: string;
      error?: string;
    }>("/api/auth/apple", {
      method: "POST",
      body: JSON.stringify(data),
    });

    if (!response.ok || !json?.success) {
      return { success: false, error: json?.message ?? json?.error ?? "Erreur Apple Sign In" };
    }

    const { user, accessToken, refreshToken } = json.data;
    await storage.setTokens(accessToken, refreshToken);
    return { success: true, data: { user, accessToken, refreshToken } };
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

  getProById: (id: number) => apiCall(`/api/users/pros/${id}`),

  getServices: (proId: number) => apiCall("GET", `/api/prestations/pro/${proId}`),

  getGalleryByPro: (proId: number) =>
    apiCall<Array<{ id: number; url: string; thumbnail: string; created_at: string }>>(`/api/gallery/pro/${proId}`),
};

// ── Reviews API ───────────────────────────────────────────────────────────────

export interface ProReview {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name: string;
  flagged_by_me: boolean;
}

export const reviewsApi = {
  create: (specialistId: string, data: { rating: number; comment: string }): Promise<ApiResponse<unknown>> =>
    apiCall("/api/reviews", { method: "POST", body: JSON.stringify({ pro_id: Number(specialistId), ...data }) }),

  getBySpecialist: (specialistId: string): Promise<ApiResponse<unknown[]>> =>
    apiCall(`/api/reviews/pro/${specialistId}`),

  // Pro's own reviews, with whether she already flagged each one.
  getMine: (): Promise<ApiResponse<ProReview[]>> => apiCall("/api/pro/reviews"),

  flag: (reviewId: number, reason?: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/reviews/${reviewId}/flag`, { method: "POST", body: JSON.stringify({ reason }) }),
};

// ── Messages API ("Écrire à sa pro") ───────────────────────────────────────

export interface ChatThreadSummary {
  id: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_reservation_id: number | null;
  unread_count: number;
  other_id: number;
  other_name: string;
  other_photo: string | null;
  reservation_status: string | null;
  /** ISO — début du RDV épinglé, pour masquer la bannière si passé. */
  reservation_start: string | null;
}

export interface ChatMessage {
  id: number;
  sender_id: number | null;
  body: string | null;
  attachment_url: string | null;
  attachment_thumbnail: string | null;
  created_at: string;
  read_at?: string | null;
}

export interface ChatThreadDetail {
  id: number;
  otherName: string;
  otherPhoto: string | null;
  lastReservationId: number | null;
  reservationStatus: string | null;
  /** ISO — début du RDV épinglé, pour masquer la bannière si passé. */
  reservationStart: string | null;
  isLocked: boolean;
  messages: ChatMessage[];
}

export const REPORT_REASONS: { code: string; label: string }[] = [
  { code: "injures_menaces", label: "Injures ou menaces" },
  { code: "arnaque_paiement", label: "Tentative d'arnaque ou de paiement hors app" },
  { code: "contournement_plateforme", label: "Contournement de la plateforme" },
  { code: "contenu_inapproprie", label: "Contenu inapproprié" },
  { code: "autre", label: "Autre" },
];

export const messagesApi = {
  listThreads: (): Promise<ApiResponse<ChatThreadSummary[]>> => apiCall("/api/messages/threads"),

  openThread: (proId: number, reservationId?: number): Promise<ApiResponse<{ id: number }>> =>
    apiCall("/api/messages/threads", { method: "POST", body: JSON.stringify({ proId, reservationId }) }),

  getThread: (threadId: number): Promise<ApiResponse<ChatThreadDetail>> =>
    apiCall(`/api/messages/threads/${threadId}`),

  sendMessage: async (
    threadId: number,
    { body, photoUri }: { body?: string; photoUri?: string }
  ): Promise<ApiResponse<ChatMessage>> => {
    try {
      const accessToken = await storage.getAccessToken();
      const formData = new FormData();
      if (body) formData.append("body", body);
      if (photoUri) {
        const filename = photoUri.split("/").pop() ?? "photo.jpg";
        const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
        const mimeType = ext === "png" ? "image/png" : "image/jpeg";
        // @ts-expect-error — React Native FormData accepts { uri, name, type }
        formData.append("photo", { uri: photoUri, name: filename, type: mimeType });
      }
      const response = await fetch(`${API_BASE_URL}/api/messages/threads/${threadId}/messages`, {
        method: "POST",
        headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: formData,
      });
      const json = (await response.json().catch(() => null)) as { success?: boolean; data?: ChatMessage; message?: string } | null;
      if (!response.ok || !json?.success) return { success: false, error: json?.message ?? "Erreur lors de l'envoi" };
      return { success: true, data: json.data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur de connexion" };
    }
  },

  reportThread: (threadId: number, reasonCode: string, reason?: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/messages/threads/${threadId}/report`, { method: "POST", body: JSON.stringify({ reasonCode, reason }) }),
};

// ── Favorites API ─────────────────────────────────────────────────────────────

export const favoritesApi = {
  getAll: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/favorites"),

  add: (proId: number): Promise<ApiResponse<{ id: number; pro_id: number; isFavorite: boolean }>> =>
    apiCall("/api/favorites", { method: "POST", body: JSON.stringify({ pro_id: proId }) }),

  remove: (proId: number): Promise<ApiResponse<{ isFavorite: boolean }>> =>
    apiCall(`/api/favorites/${proId}`, { method: "DELETE" }),
};

// ── Notifications API ─────────────────────────────────────────────────────────

export const notificationsApi = {
  getAll: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/notifications"),
  markAsRead: (id: number): Promise<ApiResponse<void>> => // BLYSS-FIX: 3.1
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

  // Unlike getCalendar (bounded to whatever month is loaded), this searches
  // every reservation — past and future — matching a client name or prestation.
  searchReservations: (q: string) =>
    apiCall<unknown[]>(`/api/pro/reservations/search?q=${encodeURIComponent(q)}`),

  getClients: () => apiCall<unknown[]>("/api/pro/clients"),

  // Unlike getClients (only clients who already have a reservation with this
  // pro), this searches every app client — used to pick a client when the
  // pro manually creates an appointment for someone booking with her for
  // the first time.
  searchClients: (q: string) =>
    apiCall<{ id: number; first_name: string; last_name: string; phone_number: string | null; email: string; profile_photo: string | null }[]>(
      `/api/pro/clients/search?q=${encodeURIComponent(q)}`
    ),

  /**
   * Créneaux calculés côté serveur pour une plage de dates. Remplace la
   * génération locale (calendar.tsx / getAvailableSlots). `role: "pro"` côté
   * mobile pro : pas de contrainte de lead-time, la pro voit tout son planning.
   */
  getAvailability: (params: {
    proId: number;
    serviceIds: number[];
    fromDate: string;
    toDate: string;
    timezone?: string;
    slotStepMinutes?: number;
  }): Promise<ApiResponse<AvailabilityResponse>> => {
    const q = new URLSearchParams({
      service_ids: params.serviceIds.join(","),
      from: params.fromDate,
      to: params.toDate,
      ...(params.timezone ? { timezone: params.timezone } : {}),
      ...(params.slotStepMinutes ? { step: String(params.slotStepMinutes) } : {}),
    });
    return apiCall(`/api/pro/${params.proId}/availability?${q.toString()}`);
  },

  createAppointment: async (data: {
    client_id: number;
    prestation_id: number;
    start_datetime: string;
    end_datetime: string;
    early_execution_requested?: boolean;
    /** Override d'ajout manuel — cf. 3.4. Jamais envoyé sans confirmation pro explicite. */
    manual_override?: {
      mode: ManualOverrideMode;
      note?: string;
      acknowledged_conflict_reservation_ids?: number[];
    };
  }): Promise<CreateAppointmentResult> => {
    // rawApiCall (pas apiCall) : on a besoin du corps complet du 409
    // (alternativeSlots, canOverride) que apiCall écrase.
    const { response, json } = await rawApiCall<{
      success?: boolean;
      data?: { id: number; price: number; override_applied: ManualOverrideMode | null };
      error?: string;
      message?: string;
      alternativeSlots?: AvailabilitySlot[];
      canOverride?: boolean;
    }>("/api/pro/appointments", { method: "POST", body: JSON.stringify(data) });

    if (response.ok && json?.data) {
      return { success: true, data: json.data };
    }
    return {
      success: false,
      error: json?.message ?? json?.error ?? "Erreur lors de la création du rendez-vous",
      code: json?.error,
      alternativeSlots: json?.alternativeSlots,
      canOverride: json?.canOverride,
      status: response.status,
    };
  },

  // Ne modifie plus directement le RDV : crée une proposition que la cliente
  // doit explicitement accepter. La réponse ne contient PAS le nouveau créneau
  // confirmé — seulement l'id de la proposition en attente et sa date d'expiration.
  updateAppointment: (
    id: number,
    data: {
      start_datetime: string;
      end_datetime: string;
      prestation_id?: number;
      reason?: string;
      initiated_via?: "app" | "phone";
    }
  ): Promise<ApiResponse<{ request_id: number; expires_at: string }>> =>
    apiCall(`/api/pro/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

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

  /**
   * Reconciles the backend's subscription state with RevenueCat's live
   * entitlement data. Call after a purchase or restore completes — the
   * RevenueCat webhook is the primary activation path, but this closes the
   * gap when it's delayed, without trusting any client-supplied plan/price.
   */
  syncSubscription: () =>
    apiCall<{ reconciled: boolean; plan?: string }>("/api/pro/subscription/sync", { method: "POST" }),

  getProfile: () => apiCall<User>("/api/users"),

  updateProfile: (data: Record<string, unknown>) =>
    apiCall("/api/users/update", { method: "PUT", body: JSON.stringify(data) }),

  // BLYSS-FIX: 3.3 — removed getPaymentSettings (duplicate of getProfile, same /api/users)

  updatePaymentSettings: (data: { accept_online?: boolean }) =>
    apiCall("/api/users/payments", { method: "PUT", body: JSON.stringify({
      accept_online_payment: data.accept_online,
    }) }),

  getCancellationPolicy: (): Promise<ApiResponse<{ cancellation_notice_hours: number }>> =>
    apiCall("/api/pro/settings/cancellation-policy"),

  updateCancellationPolicy: (cancellation_notice_hours: number): Promise<ApiResponse<{ cancellation_notice_hours: number }>> =>
    apiCall("/api/pro/settings/cancellation-policy", {
      method: "PATCH",
      body: JSON.stringify({ cancellation_notice_hours }),
    }),

  getLiveActivityNextAppointment: () =>
    apiCall<{
      appointmentId: number;
      startAt: string;
      endAt: string;
      prestationName: string | null;
      clientFirstName: string | null;
      showTime: boolean;
      privacyLevel: "full" | "time_only" | "countdown_only";
    } | null>("/api/pro/live-activity/next-appointment"),

  getLiveActivitySettings: () =>
    apiCall<{ enabled: boolean; privacy: "full" | "time_only" | "countdown_only" }>(
      "/api/pro/live-activity/settings"
    ),

  updateLiveActivitySettings: (data: { enabled?: boolean; privacy?: "full" | "time_only" | "countdown_only" }) =>
    apiCall("/api/pro/live-activity/settings", { method: "PUT", body: JSON.stringify(data) }),

  registerLiveActivityToken: (data: {
    kind: "start" | "update";
    token: string;
    activityId?: string;
    reservationId?: number;
  }) => apiCall("/api/pro/live-activity/tokens", { method: "POST", body: JSON.stringify(data) }),

  unregisterLiveActivityTokens: (activityId?: string) => {
    const q = activityId ? `?activityId=${encodeURIComponent(activityId)}` : "";
    return apiCall(`/api/pro/live-activity/tokens${q}`, { method: "DELETE" });
  },

  getSlots: (params: { date: string }) =>
    apiCall<unknown[]>(`/api/pro/slots?date=${encodeURIComponent(params.date)}`),

  createSlot: (data: { date: string; time: string; duration: number }) =>
    apiCall("/api/pro/slots", { method: "POST", body: JSON.stringify(data) }),

  updateSlot: (id: number, data: { status?: string; date?: string; time?: string; duration?: number }) =>
    apiCall(`/api/pro/slots/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteSlot: (id: number) => apiCall(`/api/pro/slots/${id}`, { method: "DELETE" }),

  // ── Horaires d'ouverture (chantier 4) ──────────────────────────────────────
  getWorkingHours: (): Promise<ApiResponse<{ days: WorkingHoursDay[] }>> =>
    apiCall("/api/pro/working-hours"),

  /**
   * Remplace toutes les plages. `migrated: true` ⇒ 1ʳᵉ sauvegarde non vide,
   * la pro vient de basculer sur le moteur de disponibilités.
   */
  setWorkingHours: async (
    days: WorkingHoursDay[]
  ): Promise<
    | { success: true; migrated: boolean }
    | { success: false; error: string; code?: string }
  > => {
    const { response, json } = await rawApiCall<{
      data?: { migrated: boolean };
      error?: string;
      message?: string;
    }>("/api/pro/working-hours", { method: "PUT", body: JSON.stringify({ days }) });
    if (response.ok && json?.data) {
      return { success: true, migrated: !!json.data.migrated };
    }
    return {
      success: false,
      error: json?.message ?? json?.error ?? "Impossible d'enregistrer les horaires",
      code: json?.error,
    };
  },

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

  getFinanceReports: () =>
    apiCall<Array<{
      id: number;
      periodType: "week" | "month";
      periodStart: string;
      periodEnd: string;
      revenue: number;
      previousRevenue: number;
      bookingsCount: number;
      avgBasket: number;
      viewedAt: string | null;
      createdAt: string;
    }>>("/api/pro/finance/reports"),

  getFinanceReport: (id: number) =>
    apiCall<{
      id: number;
      periodType: "week" | "month";
      periodStart: string;
      periodEnd: string;
      revenue: number;
      previousRevenue: number;
      bookingsCount: number;
      avgBasket: number;
      topServices: Array<{ name: string; revenue: number; count: number; percentage: number }>;
      viewedAt: string;
      createdAt: string;
    }>(`/api/pro/finance/reports/${id}`),

  getFinancePerformance: () =>
    apiCall<{
      bestDay: string | null;
      bestHour: string | null;
      avgBasket: number;
      fillRate: number;
      newClients: number;
      returningClients: number;
      monthlyEvolution: Array<{ month: string; revenue: number }>;
    }>("/api/pro/finance/performance"),

  getGallery: () =>
    apiCall<Array<{ id: number; url: string; thumbnail: string; created_at: string }>>("/api/pro/gallery"),

  deleteGallery: (id: number) => apiCall(`/api/pro/gallery/${id}`, { method: "DELETE" }),

  uploadGallery: async (uri: string): Promise<ApiResponse<{ id: number; url: string; thumbnail: string }>> => {
    try {
      const accessToken = await storage.getAccessToken();
      const filename = uri.split("/").pop() ?? "gallery.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const formData = new FormData();
      // @ts-expect-error — React Native FormData accepts { uri, name, type }
      formData.append("image", { uri, name: filename, type: mimeType });
      const response = await fetch(`${API_BASE_URL}/api/pro/gallery`, {
        method: "POST",
        headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: formData,
      });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: { id: number; url: string; thumbnail: string }; message?: string } | null;
      if (!response.ok || !json?.success) return { success: false, error: json?.message ?? "Erreur upload" };
      return { success: true, data: json.data };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur de connexion" };
    }
  },
};

// ── Client API ────────────────────────────────────────────────────────────────

export const clientApi = {
  getMyBookings: (): Promise<ApiResponse<unknown[]>> => apiCall("/api/client/my-booking"),
  getBookingDetail: (id: number): Promise<ApiResponse<unknown>> =>
    apiCall(`/api/client/booking-detail/${id}`),
  cancelReservationWithPolicy: (reservationId: number): Promise<ApiResponse<{ reservation_id: number; deadline?: string }>> =>
    apiCall(`/api/reservations/${reservationId}/cancel`, { method: "POST" }),
  rescheduleBooking: (id: number, data: { start_datetime: string; end_datetime: string; slot_id: number }): Promise<ApiResponse<void>> =>
    apiCall(`/api/client/my-booking/${id}/reschedule`, { method: "PATCH", body: JSON.stringify(data) }),
  getAvailableSlots: (proId: number, date: string): Promise<ApiResponse<Array<{ id: number; time: string }>>> =>
    apiCall(`/api/slots/available/${proId}/${date}`),
  getRescheduleRequest: (
    id: number
  ): Promise<ApiResponse<{
    request: {
      id: number;
      reservation_id: number;
      status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
      expires_at: string;
      proposed_start_datetime: string;
      proposed_end_datetime: string;
      proposed_prestation_id: number | null;
      proposed_price: number | null;
      original_start_datetime: string;
      original_end_datetime: string;
      initiated_via: "app" | "phone";
      reason: string | null;
    };
  }>> => apiCall(`/api/client/reschedule-requests/${id}`),
  acceptRescheduleRequest: (id: number): Promise<ApiResponse<{ reservationId: number }>> =>
    apiCall(`/api/client/reschedule-requests/${id}/accept`, { method: "PATCH" }),
  declineRescheduleRequest: (id: number): Promise<ApiResponse<{ reservationId: number }>> =>
    apiCall(`/api/client/reschedule-requests/${id}/decline`, { method: "PATCH" }),
};

// ── Payments API ──────────────────────────────────────────────────────────────

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
    /** Demande expresse d'exécution anticipée — cf. server.ts POST /api/reservations. */
    early_execution_requested: boolean;
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

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
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

  deleteProfilePhoto: (): Promise<ApiResponse<void>> =>
    apiCall("/api/users/profile-photo", { method: "DELETE" }),

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

// ── Admin Types ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  birth_date?: string;
  role: "client" | "pro";
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  activity_name?: string | null;
  city?: string | null;
  profile_photo?: string | null;
  banner_photo?: string | null;
  pro_status?: string | null;
  bio?: string | null;
  is_verified?: boolean;
  reported_count?: number;
  is_vigilant?: boolean;
  abusive_reports_count?: number;
  is_abusive_reporter?: boolean;
  stats?: {
    total_bookings: number;
    completed: number;
    cancelled: number;
    total_spent: number;
  };
  subscription_history?: AdminSubscription[];
  reports?: {
    against: AdminMessageReport[];
    made: AdminMessageReport[];
    reported_count: number;
    is_vigilant: boolean;
    made_total: number;
    made_justified_count: number;
    made_dismissed_count: number;
    made_abusive_count: number;
    is_abusive_reporter: boolean;
  };
}

export interface AdminMessageThreadListItem {
  id: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  is_locked: boolean;
  client_name: string;
  pro_name: string;
  flags_count: number;
  flags_total: number;
  last_reason_code: string | null;
  last_reason: string | null;
}

export interface AdminMessageReport {
  id: number;
  thread_id: number;
  reason_code: string;
  reason: string | null;
  status: "pending" | "reviewed";
  outcome: "upheld" | "dismissed" | "abusive" | null;
  admin_note: string | null;
  created_at: string;
  handled_at: string | null;
  flagged_by_name?: string;
  reported_user_name?: string;
}

export interface AdminSubscription {
  id: number;
  plan: string;
  billing_type: string;
  monthly_price: number;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
}

export interface AdminBooking {
  id: number;
  status: string;
  start_datetime: string;
  end_datetime: string;
  price: number;
  client_id: number;
  pro_id: number;
  prestation_id?: number;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  pro_name?: string;
  pro_email?: string;
  service_name?: string;
  service_price?: number;
  duration_minutes?: number;
  payment_status?: string;
  created_at: string;
}

export interface AdminPayment {
  id: number;
  reservation_id: number;
  client_name: string;
  pro_name: string;
  type: "deposit" | "balance" | "full" | "on_site";
  amount: number;
  fee: number;
  net_amount: number;
  status: "pending" | "processing" | "succeeded" | "failed" | "refunded";
  stripe_payment_intent_id?: string;
  created_at: string;
}

export interface AdminCoupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  // Backend sometimes returns this as a stringified JSON array rather than a
  // real array — always run it through parsePlans() (app/(admin-tools)/coupons.tsx)
  // before use.
  applicable_plans: string[] | string;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminAnalytics {
  revenue: {
    total_revenue: number;
    month_revenue: number;
    successful_payments: number;
    refunded_payments: number;
    growth?: number | null;
  };
  users: {
    total_users: number;
    total_pros: number;
    total_clients: number;
    new_last_30d: number;
  };
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    confirmed: number;
    last_30d: number;
  };
}

export interface AdminMeta {
  page: number;
  limit: number;
  total: number;
}

// ── Admin API ─────────────────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const adminApi = {
  // Dashboard
  getDashboardStats: (): Promise<ApiResponse<unknown>> => apiCall("/api/admin/dashboard/stats"),

  // Users
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; banned?: boolean }): Promise<ApiResponse<AdminUser[]> & { meta?: AdminMeta }> => {
    const q = params ? buildQuery(params as Record<string, string | number | boolean | undefined | null>) : "";
    return apiCall(`/api/admin/users${q}`);
  },
  getUser: (id: number): Promise<ApiResponse<AdminUser>> =>
    apiCall(`/api/admin/users/${id}`),
  updateUser: (id: number, data: { first_name?: string; last_name?: string; email?: string; role?: string }): Promise<ApiResponse<{ id: number }>> =>
    apiCall(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  banUser: (id: number): Promise<ApiResponse<{ id: number; is_active: boolean }>> =>
    apiCall(`/api/admin/users/${id}/ban`, { method: "POST" }),
  unbanUser: (id: number): Promise<ApiResponse<{ id: number; is_active: boolean }>> =>
    apiCall(`/api/admin/users/${id}/unban`, { method: "POST" }),
  deleteUser: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/users/${id}`, { method: "DELETE" }),
  grantSubscription: (id: number, data: { plan: string; months: number }): Promise<ApiResponse<{ id: number; plan: string; months: number; end_date: string }>> =>
    apiCall(`/api/admin/users/${id}/grant-subscription`, { method: "POST", body: JSON.stringify(data) }),

  // Bookings
  getBookings: (params?: { page?: number; limit?: number; status?: string; date?: string; user_id?: number }): Promise<ApiResponse<AdminBooking[]> & { meta?: AdminMeta }> => {
    const q = params ? buildQuery(params as Record<string, string | number | boolean | undefined | null>) : "";
    return apiCall(`/api/admin/bookings${q}`);
  },
  confirmBooking: (id: number): Promise<ApiResponse<{ id: number; status: string }>> =>
    apiCall(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) }),
  cancelBooking: (id: number): Promise<ApiResponse<{ id: number; status: string }>> =>
    apiCall(`/api/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),

  // Payments
  getPayments: (params?: { page?: number; limit?: number; status?: string }): Promise<ApiResponse<AdminPayment[]> & { meta?: AdminMeta }> => {
    const q = params ? buildQuery(params as Record<string, string | number | boolean | undefined | null>) : "";
    return apiCall(`/api/admin/payments${q}`);
  },
  refundPayment: (id: number): Promise<ApiResponse<{ id: number; status: string }>> =>
    apiCall(`/api/admin/payments/${id}/refund`, { method: "POST" }),

  // Coupons
  getCoupons: (): Promise<ApiResponse<AdminCoupon[]>> => apiCall("/api/admin/coupons"),
  createCoupon: (data: { code: string; discount_type: "percent" | "fixed"; discount_value: number; applicable_plans: string[]; expires_at?: string; max_uses?: number }): Promise<ApiResponse<{ id: number }>> =>
    apiCall("/api/admin/coupons", { method: "POST", body: JSON.stringify(data) }),
  deleteCoupon: (id: number): Promise<ApiResponse<{ id: number }>> =>
    apiCall(`/api/admin/coupons/${id}`, { method: "DELETE" }),
  toggleCoupon: (id: number, active: boolean): Promise<ApiResponse<{ id: number; is_active: boolean }>> =>
    apiCall(`/api/admin/coupons/${id}/toggle`, { method: "PATCH", body: JSON.stringify({ active }) }),

  // Notifications
  sendPush: (data: { target: "user_id" | "all" | "pros" | "clients"; user_id?: number; title: string; body: string }): Promise<ApiResponse<{ sent: number }>> =>
    apiCall("/api/admin/notifications/send", { method: "POST", body: JSON.stringify(data) }),

  // Analytics
  getAnalytics: (): Promise<ApiResponse<AdminAnalytics>> => apiCall("/api/admin/analytics"),
  getRevenueAnalytics: (period?: "week" | "month" | "year"): Promise<ApiResponse<Array<{ period: string; revenue: number; transactions: number }>>> =>
    apiCall(`/api/admin/analytics/revenue${period ? `?period=${period}` : ""}`),
  getUsersAnalytics: (period?: "week" | "month" | "year"): Promise<ApiResponse<Array<{ period: string; new_users: number; new_pros: number; new_clients: number }>>> =>
    apiCall(`/api/admin/analytics/users${period ? `?period=${period}` : ""}`),
  getBookingsAnalytics: (period?: "week" | "month" | "year"): Promise<ApiResponse<Array<{ period: string; total: number; completed: number; cancelled: number; revenue: number }>>> =>
    apiCall(`/api/admin/analytics/bookings${period ? `?period=${period}` : ""}`),

  // Logs
  getLogs: (params?: { date?: string }): Promise<ApiResponse<unknown[]>> => {
    const q = params?.date ? `?date=${params.date}` : "";
    return apiCall(`/api/admin/logs${q}`);
  },

  // Reviews moderation
  getReviews: (params?: { flagged?: boolean; deleted?: boolean; page?: number; limit?: number }): Promise<ApiResponse<unknown[]>> => {
    const q = params ? buildQuery(params as Record<string, string | number | boolean | undefined | null>) : "";
    return apiCall(`/api/admin/reviews${q}`);
  },
  deleteReview: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/reviews/${id}`, { method: "DELETE" }),
  restoreReview: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/reviews/${id}/restore`, { method: "PATCH" }),
  ignoreReviewFlag: (id: number): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/reviews/${id}/ignore`, { method: "PATCH" }),

  // Messages moderation — sur signalement uniquement (voir messages.routes.ts)
  getMessageThreads: (params?: { flagged?: boolean; deleted?: boolean; page?: number; limit?: number }): Promise<ApiResponse<AdminMessageThreadListItem[]> & { meta?: AdminMeta }> => {
    const q = params ? buildQuery(params as Record<string, string | number | boolean | undefined | null>) : "";
    return apiCall(`/api/admin/messages/threads${q}`);
  },
  getMessageThreadDetail: (id: number): Promise<ApiResponse<{ messages: unknown[]; flags: AdminMessageReport[] }>> =>
    apiCall(`/api/admin/messages/threads/${id}`),
  deleteMessageThread: (id: number, note?: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/messages/threads/${id}`, { method: "DELETE", body: JSON.stringify({ note }) }),
  restoreMessageThread: (id: number, note?: string): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/messages/threads/${id}/restore`, { method: "PATCH", body: JSON.stringify({ note }) }),
  ignoreMessageFlag: (id: number, params?: { outcome?: "dismissed" | "abusive"; note?: string }): Promise<ApiResponse<void>> =>
    apiCall(`/api/admin/messages/threads/${id}/ignore`, { method: "PATCH", body: JSON.stringify(params ?? {}) }),
};
