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

import { clientOnboardingApi, proApi, NAIL_STYLES, NAIL_SERVICES } from "@/lib/api";

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

  it("setPreferences envoie style + city quand la ville est fournie", async () => {
    mockFetch.mockReturnValueOnce(ok({ style_nails: "vernis_gel" }));
    await clientOnboardingApi.setPreferences("vernis_gel", "Lyon");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ style_nails: "vernis_gel", city: "Lyon" });
  });

  it("setPreferences omet city quand absente", async () => {
    mockFetch.mockReturnValueOnce(ok({ style_nails: "autre" }));
    await clientOnboardingApi.setPreferences("autre");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ style_nails: "autre" });
  });

  it("setPreferences envoie services[] quand non vide, les omet sinon", async () => {
    mockFetch.mockReturnValueOnce(ok({ style_nails: "nail_art" }));
    await clientOnboardingApi.setPreferences("nail_art", "Lyon", ["nouvelle_pose", "depose"]);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      style_nails: "nail_art",
      city: "Lyon",
      services: ["nouvelle_pose", "depose"],
    });

    mockFetch.mockReturnValueOnce(ok({ style_nails: "nail_art" }));
    await clientOnboardingApi.setPreferences("nail_art", undefined, []);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ style_nails: "nail_art" });
  });

  it("followPro / setAttribution → POST avec payload", async () => {
    mockFetch.mockReturnValueOnce(ok(null));
    await clientOnboardingApi.followPro(42);
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/client\/onboarding\/follow$/);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ pro_id: 42 });

    mockFetch.mockReturnValueOnce(ok(null));
    await clientOnboardingApi.setAttribution("instagram");
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ source: "instagram" });
  });

  it("getRecommendations encode la ville en query param", async () => {
    mockFetch.mockReturnValueOnce(ok({ style_nails: null, style_filter_active: false, recommendations: [] }));
    await clientOnboardingApi.getRecommendations("Saint-Étienne");
    expect(mockFetch.mock.calls[0][0]).toContain("?city=Saint-%C3%89tienne");
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

  it("NAIL_SERVICES = axe prestation #34 passe 3b", () => {
    expect(NAIL_SERVICES).toEqual([
      "nouvelle_pose",
      "remplissage",
      "depose",
      "semi_permanent",
      "capsules",
      "soin_pieds",
    ]);
  });
});
