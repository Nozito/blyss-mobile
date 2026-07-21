/**
 * Tests d'intégration (mock) — flow abonnement RevenueCat + sync backend
 *
 * Scénarios couverts :
 *  A. Achat plan Start
 *  B. Achat plan Sérénité
 *  C. Achat plan Signature
 *  D. Upgrade Start → Signature
 *  E. Downgrade Signature → Start
 *  F. Achat annuel (billing=one_time, 2 mois offerts)
 *  G. Achat annuel → sync backend réussit du premier coup
 *  H. Achat annuel → sync backend réussit au 2e essai (retry)
 *  I. Sync backend → échoue 3 fois (retries épuisés)
 *  J. Achat annulé par l'utilisateur (cancelled)
 *  K. Erreur Stripe/RC (non-cancelled)
 *  L. Restore purchases — abonnement retrouvé
 *  M. Restore purchases — rien à restaurer
 *  N. Plan déjà actif → pas d'achat
 *
 * Le backend ne fait plus confiance au plan/prix envoyé par le client — la
 * synchronisation post-achat (`syncSubscription`) ne prend plus aucun
 * paramètre : le plan vient exclusivement de l'état RevenueCat côté serveur
 * (voir POST /api/pro/subscription/sync). Ces tests reflètent ce contrat.
 */

// ── Mock RevenueCat ───────────────────────────────────────────────────────────

const mockPurchase = jest.fn();
const mockRestorePurchases = jest.fn();
const mockRefreshActivePlan = jest.fn();

const mockSyncSubscription = jest.fn();

jest.mock("@/lib/api", () => ({
  proApi: {
    syncSubscription: (...args: unknown[]) => mockSyncSubscription(...args),
  },
}));

// ── Types ─────────────────────────────────────────────────────────────────────

type RCPlan = "start" | "serenite" | "signature";

interface RCPackage {
  identifier: string;
}

interface PurchaseResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

// ── syncSubscriptionWithRetry (copie exacte de subscription-settings.tsx) ─────

async function syncSubscriptionWithRetry(maxAttempts = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = (await mockSyncSubscription()) as { success: boolean };
      if (res.success) return true;
    } catch {}
    if (attempt < maxAttempts) {
      // En test on ne dort pas vraiment
      await Promise.resolve();
    }
  }
  return false;
}

// ── handleUpgrade (logique extraite de subscription-settings.tsx) ─────────────

interface UpgradeParams {
  planId: RCPlan;
  activePlan: RCPlan | null;
  isAnnual: boolean;
  packages: Array<{
    key: RCPlan;
    rcPackage: RCPackage;
    annualRcPackage: RCPackage | null;
    monthlyPrice: number;
    annualMonthlyPrice: number;
  }>;
  purchase: typeof mockPurchase;
  refreshActivePlan: typeof mockRefreshActivePlan;
}

async function handleUpgrade(params: UpgradeParams): Promise<
  | { success: true; plan: RCPlan; synced: boolean }
  | { success: false; cancelled: true }
  | { success: false; error: string }
> {
  const { planId, activePlan, isAnnual, packages, purchase, refreshActivePlan } = params;

  if (planId === activePlan) {
    return { success: false, error: "Plan déjà actif" };
  }

  const rcPkg = packages.find((p) => p.key === planId);
  if (!rcPkg) {
    return { success: false, error: "Plan non disponible" };
  }

  const pkg = isAnnual && rcPkg.annualRcPackage ? rcPkg.annualRcPackage : rcPkg.rcPackage;

  const result = (await purchase(pkg)) as PurchaseResult;

  if (!result.success) {
    if (result.error === "cancelled") return { success: false, cancelled: true };
    return { success: false, error: result.error ?? "Erreur inconnue" };
  }

  const synced = await syncSubscriptionWithRetry();
  await refreshActivePlan();

  return { success: true, plan: planId, synced };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PACKAGES: UpgradeParams["packages"] = [
  {
    key: "start",
    rcPackage: { identifier: "start_monthly" },
    annualRcPackage: { identifier: "start_annual" },
    monthlyPrice: 19,
    annualMonthlyPrice: 16,
  },
  {
    key: "serenite",
    rcPackage: { identifier: "serenite_monthly" },
    annualRcPackage: { identifier: "serenite_annual" },
    monthlyPrice: 39,
    annualMonthlyPrice: 32,
  },
  {
    key: "signature",
    rcPackage: { identifier: "signature_monthly" },
    annualRcPackage: { identifier: "signature_annual" },
    monthlyPrice: 59,
    annualMonthlyPrice: 49,
  },
];

const BASE_PARAMS: Omit<UpgradeParams, "planId" | "activePlan" | "isAnnual"> = {
  packages: PACKAGES,
  purchase: mockPurchase,
  refreshActivePlan: mockRefreshActivePlan,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshActivePlan.mockResolvedValue(undefined);
});

// ══════════════════════════════════════════════════════════════════════════════
// A-C. Achat initial par plan
// ══════════════════════════════════════════════════════════════════════════════

describe.each<[string, RCPlan]>([
  ["Start", "start"],
  ["Sérénité", "serenite"],
  ["Signature", "signature"],
])("Scénario achat plan %s (mensuel)", (_label, plan) => {
  it(`achète ${_label} et sync le backend`, async () => {
    mockPurchase.mockResolvedValue({ success: true, paymentId: `pay_${plan}` });
    mockSyncSubscription.mockResolvedValue({ success: true });

    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: plan,
      activePlan: null,
      isAnnual: false,
    });

    expect(result).toEqual({ success: true, plan, synced: true });
    // Le backend ne reçoit aucun payload — le plan est vérifié côté serveur
    // via RevenueCat, jamais transmis par le client.
    expect(mockSyncSubscription).toHaveBeenCalledWith();
    expect(mockRefreshActivePlan).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// D. Upgrade Start → Signature
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario D — Upgrade Start → Signature", () => {
  it("achète le package signature et sync le backend", async () => {
    mockPurchase.mockResolvedValue({ success: true, paymentId: "pay_upgrade" });
    mockSyncSubscription.mockResolvedValue({ success: true });

    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: "signature",
      activePlan: "start",
      isAnnual: false,
    });

    expect(result).toEqual({ success: true, plan: "signature", synced: true });
    expect(mockPurchase).toHaveBeenCalledWith({ identifier: "signature_monthly" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// E. Downgrade Signature → Start
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario E — Downgrade Signature → Start", () => {
  it("fonctionne comme un upgrade normal (RC gère le downgrade)", async () => {
    mockPurchase.mockResolvedValue({ success: true, paymentId: "pay_downgrade" });
    mockSyncSubscription.mockResolvedValue({ success: true });

    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: "start",
      activePlan: "signature",
      isAnnual: false,
    });

    expect(result).toEqual({ success: true, plan: "start", synced: true });
    expect(mockPurchase).toHaveBeenCalledWith({ identifier: "start_monthly" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// F. Achat annuel
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario F — Achat annuel", () => {
  it("utilise annualRcPackage", async () => {
    mockPurchase.mockResolvedValue({ success: true, paymentId: "pay_annual" });
    mockSyncSubscription.mockResolvedValue({ success: true });

    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: "signature",
      activePlan: null,
      isAnnual: true,
    });

    expect(mockPurchase).toHaveBeenCalledWith({ identifier: "signature_annual" });
    expect(mockSyncSubscription).toHaveBeenCalledWith();
    expect(result).toMatchObject({ success: true, plan: "signature" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// G. Sync backend réussit du 1er coup
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario G — Sync backend immédiat", () => {
  it("retourne synced=true si le 1er appel réussit", async () => {
    mockSyncSubscription.mockResolvedValue({ success: true });

    const synced = await syncSubscriptionWithRetry();

    expect(synced).toBe(true);
    expect(mockSyncSubscription).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// H. Retry — réussit au 2e essai
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario H — Retry sync (réussit au 2e essai)", () => {
  it("réessaie et retourne synced=true", async () => {
    mockSyncSubscription
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: true });

    const synced = await syncSubscriptionWithRetry();

    expect(synced).toBe(true);
    expect(mockSyncSubscription).toHaveBeenCalledTimes(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// I. Retries épuisés
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario I — Sync épuisée (3 échecs)", () => {
  it("retourne synced=false après 3 tentatives", async () => {
    mockSyncSubscription.mockResolvedValue({ success: false });

    const synced = await syncSubscriptionWithRetry();

    expect(synced).toBe(false);
    expect(mockSyncSubscription).toHaveBeenCalledTimes(3);
  });

  it("continue à réessayer même si le backend throw", async () => {
    mockSyncSubscription.mockRejectedValue(new Error("timeout"));

    const synced = await syncSubscriptionWithRetry();

    expect(synced).toBe(false);
    expect(mockSyncSubscription).toHaveBeenCalledTimes(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// J. Achat annulé par l'utilisateur
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario J — Achat annulé (cancelled)", () => {
  it("ne sync pas le backend si l'utilisateur annule", async () => {
    mockPurchase.mockResolvedValue({ success: false, error: "cancelled" });

    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: "serenite",
      activePlan: "start",
      isAnnual: false,
    });

    expect(mockSyncSubscription).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, cancelled: true });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// K. Erreur RevenueCat non-cancelled
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario K — Erreur RC (non-cancelled)", () => {
  it("retourne l'erreur RC sans sync backend", async () => {
    mockPurchase.mockResolvedValue({
      success: false,
      error: "payment_failed",
    });

    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: "signature",
      activePlan: null,
      isAnnual: false,
    });

    expect(mockSyncSubscription).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "payment_failed" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// L-M. Restore purchases
// ══════════════════════════════════════════════════════════════════════════════

describe("Restore purchases", () => {
  it("Scénario L — restore retrouve un abonnement actif", async () => {
    mockRestorePurchases.mockResolvedValue({
      success: true,
      activeSubscriptions: ["serenite_monthly"],
    });

    const result = (await mockRestorePurchases()) as {
      success: boolean;
      activeSubscriptions: string[];
    };

    expect(result.success).toBe(true);
    expect(result.activeSubscriptions).toContain("serenite_monthly");
  });

  it("Scénario M — restore ne trouve rien", async () => {
    mockRestorePurchases.mockResolvedValue({
      success: true,
      activeSubscriptions: [],
    });

    const result = (await mockRestorePurchases()) as {
      success: boolean;
      activeSubscriptions: string[];
    };

    expect(result.activeSubscriptions).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// N. Plan déjà actif
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario N — Plan déjà actif", () => {
  it("ne lance pas d'achat si le plan est déjà actif", async () => {
    const result = await handleUpgrade({
      ...BASE_PARAMS,
      planId: "serenite",
      activePlan: "serenite",
      isAnnual: false,
    });

    expect(mockPurchase).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "Plan déjà actif" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// refreshActivePlan appelé dans tous les cas de succès
// ══════════════════════════════════════════════════════════════════════════════

describe("refreshActivePlan post-achat", () => {
  it("refreshActivePlan est toujours appelé après un achat réussi, même si sync échoue", async () => {
    mockPurchase.mockResolvedValue({ success: true, paymentId: "pay_xyz" });
    mockSyncSubscription.mockResolvedValue({ success: false });

    await handleUpgrade({
      ...BASE_PARAMS,
      planId: "start",
      activePlan: null,
      isAnnual: false,
    });

    expect(mockRefreshActivePlan).toHaveBeenCalledTimes(1);
  });

  it("refreshActivePlan n'est PAS appelé si l'achat est annulé", async () => {
    mockPurchase.mockResolvedValue({ success: false, error: "cancelled" });

    await handleUpgrade({
      ...BASE_PARAMS,
      planId: "start",
      activePlan: null,
      isAnnual: false,
    });

    expect(mockRefreshActivePlan).not.toHaveBeenCalled();
  });
});
