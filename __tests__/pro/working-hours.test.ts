/**
 * Tests — helpers horaires d'ouverture (chantier 4.3)
 *
 * validateWorkingHours (miroir client de la validation serveur) +
 * proApi.getWorkingHours / setWorkingHours (mapping, migrated, 422).
 */

jest.mock("@/lib/storage", () => ({
  storage: {
    getAccessToken: jest.fn().mockResolvedValue("tok"),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    clearAll: jest.fn(),
  },
}));

import { validateWorkingHours, WORKING_HOURS_TIMES, emptyWorkingWeek } from "@/lib/workingHours";
import { proApi } from "@/lib/api";

const mockFetch = jest.fn();
(global as { fetch: unknown }).fetch = mockFetch;

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

beforeEach(() => mockFetch.mockReset());

describe("validateWorkingHours", () => {
  it("accepte une semaine vide", () => {
    expect(validateWorkingHours(emptyWorkingWeek())).toBeNull();
  });

  it("accepte plusieurs plages non chevauchantes le même jour (ordre quelconque)", () => {
    expect(
      validateWorkingHours([
        { weekday: 1, ranges: [{ start_time: "13:30", end_time: "18:00" }, { start_time: "09:00", end_time: "12:30" }] },
      ])
    ).toBeNull();
  });

  it("rejette end <= start", () => {
    expect(
      validateWorkingHours([{ weekday: 2, ranges: [{ start_time: "18:00", end_time: "09:00" }] }])
    ).toMatch(/finir après/);
  });

  it("rejette deux plages qui se chevauchent", () => {
    expect(
      validateWorkingHours([
        { weekday: 3, ranges: [{ start_time: "09:00", end_time: "13:00" }, { start_time: "12:00", end_time: "18:00" }] },
      ])
    ).toMatch(/chevauchent/);
  });

  it("WORKING_HOURS_TIMES couvre 06:00 → 23:45 par pas de 15 min", () => {
    expect(WORKING_HOURS_TIMES[0]).toBe("06:00");
    expect(WORKING_HOURS_TIMES[WORKING_HOURS_TIMES.length - 1]).toBe("23:45");
    expect(WORKING_HOURS_TIMES).toHaveLength(18 * 4);
  });
});

describe("proApi.getWorkingHours", () => {
  it("mappe la réponse { days }", async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse(200, { success: true, data: { days: [{ weekday: 1, ranges: [{ start_time: "09:00", end_time: "18:00" }] }] } })
    );
    const res = await proApi.getWorkingHours();
    expect(res.success).toBe(true);
    expect(res.data?.days[0].ranges[0].start_time).toBe("09:00");
  });
});

describe("proApi.setWorkingHours", () => {
  it("succès → { success:true, migrated }", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: { migrated: true } }));
    const res = await proApi.setWorkingHours([{ weekday: 1, ranges: [{ start_time: "09:00", end_time: "18:00" }] }]);
    expect(res).toEqual({ success: true, migrated: true });
  });

  it("422 chevauchement → { success:false, code:'OVERLAPPING_RANGES' }", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(422, { success: false, error: "OVERLAPPING_RANGES", message: "…" }));
    const res = (await proApi.setWorkingHours([])) as Extract<
      Awaited<ReturnType<typeof proApi.setWorkingHours>>,
      { success: false }
    >;
    expect(res.success).toBe(false);
    expect(res.code).toBe("OVERLAPPING_RANGES");
  });

  it("envoie { days } dans le corps", async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(200, { success: true, data: { migrated: false } }));
    const days = [{ weekday: 2, ranges: [{ start_time: "10:00", end_time: "17:00" }] }];
    await proApi.setWorkingHours(days);
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ days });
    expect((mockFetch.mock.calls[0][1] as RequestInit).method).toBe("PUT");
  });
});
