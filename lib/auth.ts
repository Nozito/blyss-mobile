import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "blyss_access_token";

export const getToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = (token: string): Promise<void> =>
  SecureStore.setItemAsync(TOKEN_KEY, token);

export const removeToken = (): Promise<void> =>
  SecureStore.deleteItemAsync(TOKEN_KEY);

export function isTokenExpired(token: string): boolean {
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}
