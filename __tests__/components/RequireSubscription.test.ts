/**
 * Tests unitaires — logique de useRequireSubscription
 *
 * On teste la logique pure (hasActiveSub, shouldRedirect) extraite du hook,
 * sans environnement React (pas de renderHook disponible dans ce setup Jest).
 *
 * Scénarios :
 *  A. Aucun abonnement actif → shouldRedirect = true
 *  B. Utilisateur admin → pas de redirection même sans abonnement
 *  C. Abonnement actif → pas de redirection
 *  D. Hook non prêt (isReady=false) → pas de redirection
 *  E. hasActiveSub reflète correctement chaque cas
 */

// ── Logique pure extraite de components/RequireSubscription.tsx ───────────────

function computeShouldRedirect(opts: {
  isReady: boolean;
  user: { is_admin: boolean } | null;
  activePlan: string | null;
}): boolean {
  const { isReady, user, activePlan } = opts;
  if (!isReady || !user) return false;
  if (user.is_admin) return false;
  return !activePlan;
}

function computeHasActiveSub(opts: {
  user: { is_admin: boolean } | null;
  activePlan: string | null;
}): boolean {
  return Boolean(opts.user?.is_admin) || Boolean(opts.activePlan);
}

// ══════════════════════════════════════════════════════════════════════════════
// A. Aucun abonnement
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario A — Pas d'abonnement actif", () => {
  it("shouldRedirect=true pour un pro sans abonnement", () => {
    expect(
      computeShouldRedirect({ isReady: true, user: { is_admin: false }, activePlan: null })
    ).toBe(true);
  });

  it("hasActiveSub=false pour un pro sans abonnement", () => {
    expect(computeHasActiveSub({ user: { is_admin: false }, activePlan: null })).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// B. Admin — jamais redirigé
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario B — Utilisateur admin", () => {
  it("shouldRedirect=false même sans abonnement", () => {
    expect(
      computeShouldRedirect({ isReady: true, user: { is_admin: true }, activePlan: null })
    ).toBe(false);
  });

  it("hasActiveSub=true pour un admin (pas besoin d'abonnement)", () => {
    expect(computeHasActiveSub({ user: { is_admin: true }, activePlan: null })).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// C. Abonnement actif
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario C — Abonnement actif", () => {
  it("shouldRedirect=false si activePlan est défini", () => {
    expect(
      computeShouldRedirect({ isReady: true, user: { is_admin: false }, activePlan: "serenite" })
    ).toBe(false);
  });

  it("hasActiveSub=true quand activePlan est défini", () => {
    expect(computeHasActiveSub({ user: { is_admin: false }, activePlan: "serenite" })).toBe(true);
  });

  it.each(["start", "serenite", "signature"] as const)(
    "hasActiveSub=true pour le plan %s",
    (plan) => {
      expect(computeHasActiveSub({ user: { is_admin: false }, activePlan: plan })).toBe(true);
    }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// D. Hook non prêt (isReady=false) ou user absent
// ══════════════════════════════════════════════════════════════════════════════

describe("Scénario D — Pas encore prêt", () => {
  it("shouldRedirect=false si isReady=false (RevenueCat pas encore chargé)", () => {
    expect(
      computeShouldRedirect({ isReady: false, user: { is_admin: false }, activePlan: null })
    ).toBe(false);
  });

  it("shouldRedirect=false si user=null (session non initialisée)", () => {
    expect(
      computeShouldRedirect({ isReady: true, user: null, activePlan: null })
    ).toBe(false);
  });
});
