import type { Router } from "expo-router";

/**
 * Remplace router.back() partout — évite "GO_BACK not handled" quand il n'y a pas d'historique
 * (deep link, notification push, redémarrage sur un écran intermédiaire).
 */
export function safeBack(router: Router, fallback = "/(auth)/welcome"): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as Parameters<typeof router.replace>[0]);
  }
}
