import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { notificationsApi } from "@/lib/api";

/**
 * Retire ce device de la liste des destinataires push du compte qui se
 * déconnecte (à appeler depuis AuthContext.logout() — pas depuis
 * NotificationContext pour éviter un cycle d'import AuthContext↔NotificationContext).
 * Best-effort et silencieux : la contrainte unique de expo_push_tokens
 * côté backend est (user_id, token), pas token seul — sans cet appel,
 * l'appareil continue de recevoir les notifs de ce compte indéfiniment,
 * même après qu'un autre compte s'y connecte.
 */
export async function deregisterPushToken(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await notificationsApi.deletePushToken(tokenData.data);
  } catch {
    // best-effort — un échec ici ne doit jamais bloquer la déconnexion
  }
}
