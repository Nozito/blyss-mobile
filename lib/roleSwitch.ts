import { router } from "expo-router";
import type { AdminRole } from "@/components/ui/RoleSelectionModal";

const ROUTES: Record<AdminRole, string> = {
  client: "/(client)",
  pro: "/(pro)/dashboard",
  admin: "/(admin)/dashboard",
};

/**
 * Bascule d'espace (client / pro / admin) depuis un bottom-sheet.
 *
 * `router.replace` déclenché dans le même tick que la fermeture du sheet
 * échoue ("The action 'REPLACE' … was not handled by any navigator") : la
 * modale RN est encore montée et le navigateur courant n'est pas celui du
 * groupe cible. On laisse la modale se démonter avant de recomposer la stack.
 */
export function switchRole(role: AdminRole): void {
  setTimeout(() => {
    router.replace(ROUTES[role] as never);
  }, 60);
}
