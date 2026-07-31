/**
 * Instrumentation minimale du démarrage — sans dépendance externe.
 *
 * Repères posés :
 *  - module_eval          : ce module s'exécute (proxy du démarrage JS ; ne capture PAS
 *                            le temps natif avant l'exécution du bundle — pas de hook natif ici)
 *  - fonts_auth_ready      : polices + état auth résolus (readiness réelle, pas de timer artificiel)
 *  - native_splash_hidden  : le splash natif (storyboard iOS / drawable Android) a disparu
 *  - launch_splash_dismissed : le splash JS (logo animé) a fini son fondu — écran pleinement utilisable
 *
 * Équivalent conceptuel Android : module_eval ~ Application.onCreate, fonts_auth_ready ~ TTID,
 * launch_splash_dismissed ~ TTFD (Time To Full Display).
 */

type StartupMark =
  | "module_eval"
  | "fonts_auth_ready"
  | "native_splash_hidden"
  | "launch_splash_dismissed";

const origin = Date.now();
const marks: Partial<Record<StartupMark, number>> = {};

export function markStartup(mark: StartupMark): void {
  if (marks[mark] != null) return; // idempotent — seule la première occurrence compte
  marks[mark] = Date.now();
  if (__DEV__) {
    console.log(`[startup] ${mark} @ +${marks[mark]! - origin}ms`);
  }
}

export interface StartupReport {
  toFontsAuthReadyMs: number | null;
  toNativeSplashHiddenMs: number | null;
  toFullyInteractiveMs: number | null;
}

export function getStartupReport(): StartupReport {
  const rel = (k: StartupMark) => (marks[k] != null ? marks[k]! - origin : null);
  return {
    toFontsAuthReadyMs: rel("fonts_auth_ready"),
    toNativeSplashHiddenMs: rel("native_splash_hidden"),
    toFullyInteractiveMs: rel("launch_splash_dismissed"),
  };
}

/** Log le rapport complet une fois le launch splash disparu (dev uniquement). */
export function logStartupReport(): void {
  if (!__DEV__) return;
  console.log("[startup] report", getStartupReport());
}
