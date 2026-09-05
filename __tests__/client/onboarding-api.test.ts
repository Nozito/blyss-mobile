/**
 * Tests — #34 : lib/api clientOnboardingApi + proApi.getNailStyles/setNailStyles.
 * (logique de mapping / query params, fetch mocké — pas de composant RN.)
 */

jest.mock("@/lib/storage", () => ({
  storage: {
    getAccessToken: jest.fn().mockResolvedValue("tok"),
    getRefreshToken: jest.fn().mockResolvedValue(null),
    clearAll: jest.fn(),
  },
}));

import { clientOnboardingApi, proApi, NAIL_STYLES } from "@/lib/api";

const mockFetch = jest.fn();
(global as { fetch: unknown }).fetch = mockFetch;

function ok(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  });
}

beforeEach(() => mockFetch.mockReset());

describe("clientOnboardingApi", () => {
  it("getStatus → GET /api/client/onboarding/status", async () => {
    mockFetch.mockReturnValueOnce(ok({ current_step: 2, completed: false, skipped: false, style_nails: "nail_art" }));
    const res = await clientOnboardingApi.getStatus();
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/client\/onboarding\/status$/);
    expect(res.success && res.data?.current_step).toBe(2);
  });

  it("setPreferences envoie styles[] + city quand la ville est fournie", async () => {
    mockFetch.mockReturnValueOnce(ok({ styles: ["vernis_gel"], style_nails: "vernis_gel" }));
    await clientOnboardingApi.setPreferences(["vernis_gel", "nail_art"], "Lyon");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ styles: ["vernis_gel", "nail_art"], city: "Lyon" });
  });

  it("setPreferences omet city quand absente", async () => {
    mockFetch.mockReturnValueOnce(ok({ styles: ["autre"], style_nails: "autre" }));
    await clientOnboardingApi.setPreferences(["autre"]);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ styles: ["autre"] });
  });

  it("setAttribution → POST avec payload", async () => {
    mockFetch.mockReturnValueOnce(ok(null));
    await clientOnboardingApi.setAttribution("instagram");
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/client\/onboarding\/attribution$/);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ source: "instagram" });
  });

  it("getRecommendations encode ville + lat/lng en query params", async () => {
    mockFetch.mockReturnValueOnce(ok({ style_nails: null, styles: [], style_filter_active: false, recommendations: [] }));
    await clientOnboardingApi.getRecommendations({ city: "Saint-Étienne", lat: 45.44, lng: 4.39 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("city=Saint-%C3%89tienne");
    expect(url).toContain("lat=45.44");
    expect(url).toContain("lng=4.39");
  });

  it("getRecommendations sans localisation → pas de query string", async () => {
    mockFetch.mockReturnValueOnce(ok({ style_nails: null, styles: [], style_filter_active: false, recommendations: [] }));
    await clientOnboardingApi.getRecommendations();
    expect(mockFetch.mock.calls[0][0]).not.toContain("?");
  });

  it("tapCta / complete / skip → POST", async () => {
    for (const fn of [clientOnboardingApi.tapCta, clientOnboardingApi.complete, clientOnboardingApi.skip]) {
      mockFetch.mockReturnValueOnce(ok(null));
      await fn();
      expect(mockFetch.mock.calls.at(-1)![1].method).toBe("POST");
    }
  });
});

describe("proApi nail-styles", () => {
  it("getNailStyles → GET /api/pro/nail-styles", async () => {
    mockFetch.mockReturnValueOnce(ok({ styles: ["nail_art", "french_nude"] }));
    const res = await proApi.getNailStyles();
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/pro\/nail-styles$/);
    expect(res.success && res.data?.styles).toEqual(["nail_art", "french_nude"]);
  });

  it("setNailStyles → PUT avec { styles }", async () => {
    mockFetch.mockReturnValueOnce(ok({ styles: ["pose_resine"] }));
    await proApi.setNailStyles(["pose_resine"]);
    expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ styles: ["pose_resine"] });
  });

  it("NAIL_STYLES = taxonomie #34", () => {
    expect(NAIL_STYLES).toEqual(["nail_art", "french_nude", "couleurs_vives", "vernis_gel", "pose_resine", "autre"]);
  });
});
