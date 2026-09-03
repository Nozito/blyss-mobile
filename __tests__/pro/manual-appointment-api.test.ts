/**
 * Tests — helpers API de l'ajout manuel pro (chantier 3.4)
 *
 * proApi.getAvailability  → mappe la réponse enveloppée
 * proApi.createAppointment → succès / refus exploitable (canOverride,
 *                            alternativeSlots), transmission de manual_override
 */

jest.mock("@/lib/storage", () => ({
  storage: {
    getAccessToken: jest.fn().mockResolvedValue("tok"),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    clearAll: jest.fn(),
  },
}));

import { proApi } from "@/lib/api";

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

describe("proApi.getAvailability", () => {
  it("retourne les jours + créneaux calculés", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(200, {
        success: true,
        data: {
          timezone: "Europe/Paris",
          requested_duration_minutes: 60,
          total_blocked_minutes: 60,
          days: [{ date: "2026-09-07", slots: [{ start: "2026-09-07T07:00:00.000Z", end: "2026-09-07T08:00:00.000Z" }] }],
        },
      })
    );

    const res = await proApi.getAvailability({
      proId: 7,
      serviceIds: [10],
      fromDate: "2026-09-07",
      toDate: "2026-09-07",
    });

    expect(res.success).toBe(true);
    expect(res.data?.days[0].slots).toHaveLength(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/pro/7/availability");
    expect(url).toContain("service_ids=10");
  });
});

describe("proApi.createAppointment", () => {
  const base = {
    client_id: 42,
    prestation_id: 10,
    start_datetime: "2026-09-07T08:00:00.000Z",
    end_datetime: "2026-09-07T09:00:00.000Z",
  };

  it("succès : renvoie l'id + override_applied", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: { id: 55, price: 80, override_applied: null } }));
    const res = await proApi.createAppointment(base);
    expect(res).toEqual({ success: true, data: { id: 55, price: 80, override_applied: null } });
  });

  it("409 hors horaires : expose canOverride + alternativeSlots", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(409, {
        success: false,
        error: "OUTSIDE_WORKING_HOURS",
        message: "Hors horaires",
        canOverride: true,
        alternativeSlots: [{ start: "2026-09-07T10:00:00.000Z", end: "2026-09-07T11:00:00.000Z" }],
      })
    );
    const res = await proApi.createAppointment(base) as Extract<
      Awaited<ReturnType<typeof proApi.createAppointment>>,
      { success: false }
    >;
    expect(res.success).toBe(false);
    expect(res.code).toBe("OUTSIDE_WORKING_HOURS");
    expect(res.canOverride).toBe(true);
    expect(res.alternativeSlots).toHaveLength(1);
    expect(res.status).toBe(409);
  });

  it("transmet manual_override dans le corps de la requête", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: { id: 56, price: 80, override_applied: "conflict" } }));
    await proApi.createAppointment({
      ...base,
      manual_override: { mode: "conflict", note: "Cliente prévenue" },
    });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.manual_override).toEqual({ mode: "conflict", note: "Cliente prévenue" });
  });

  it("422 sans canOverride : échec simple, pas de proposition d'override", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(422, { success: false, error: "OUTSIDE_BOOKING_WINDOW", message: "Trop tôt" })
    );
    const res = await proApi.createAppointment(base) as Extract<
      Awaited<ReturnType<typeof proApi.createAppointment>>,
      { success: false }
    >;
    expect(res.success).toBe(false);
    expect(res.canOverride).toBeUndefined();
  });

  it("ne transmet jamais client_contact (flux walk-in supprimé)", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: { id: 60, price: 40, override_applied: null } }));
    await proApi.createAppointment(base);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.client_contact).toBeUndefined();
  });
});

describe("proApi.searchClients — périmètre RGPD", () => {
  it("appelle /api/pro/clients/search sans paramètre exact", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: [] }));
    await proApi.searchClients("Léa");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/pro/clients/search?q=L%C3%A9a");
    expect(url).not.toContain("exact");
  });
});
