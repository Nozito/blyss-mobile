import * as SecureStore from "expo-secure-store";

const KEYS = {
  ACCESS_TOKEN: "blyss_access_token",
  REFRESH_TOKEN: "blyss_refresh_token",
  USER_CACHE: "blyss_user_cache",
} as const;

export const storage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN).catch(() => null),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN).catch(() => null),
    ]);
  },

  async getUserCache(): Promise<Record<string, unknown> | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEYS.USER_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: Record<string, unknown>; cachedAt: number };
      // Cache expiration: 30 minutes — assez frais pour le display instantané
      if (Date.now() - parsed.cachedAt > 30 * 60 * 1000) return null;
      return parsed.data;
    } catch {
      return null;
    }
  },

  async setUserCache(data: Record<string, unknown>): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER_CACHE, JSON.stringify({ data, cachedAt: Date.now() }));
  },

  async clearUserCache(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.USER_CACHE).catch(() => null);
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearTokens(),
      this.clearUserCache(),
    ]);
  },
};
