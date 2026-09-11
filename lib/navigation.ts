import type { router } from "expo-router";

// SDK 57 : `expo-router` n'exporte plus le type `Router` — on le dérive de
// l'objet impératif `router`.
type Router = typeof router;

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

/**
 * Déconnexion "propre" : appelle logout() puis vide tout l'historique de
 * navigation avant de renvoyer vers l'écran de base (welcome par défaut).
 *
 * Sans le dismissAll(), les écrans authentifiés (pro/client/admin) quittés
 * via router.replace() restent parfois accessibles en arrière — un swipe-back
 * iOS ou le bouton retour de l'écran de connexion (safeBack) pouvait alors
 * ré-exposer un écran périmé au lieu de renvoyer vers l'accueil. dismissAll()
 * ("popToTop" du stack le plus proche) élimine cette possibilité avant le
 * replace final.
 */
export async function logoutAndGoTo(
  router: Router,
  logout: () => Promise<void>,
  target: Parameters<Router["replace"]>[0] = "/(auth)/welcome" as Parameters<Router["replace"]>[0],
): Promise<void> {
  try {
    await logout();
  } finally {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace(target);
  }
}
