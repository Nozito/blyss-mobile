const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL && process.env.NODE_ENV !== "test") {
  throw new Error(
    "[Blyss] EXPO_PUBLIC_API_URL est manquante. Définis-la dans ton .env ou via EAS secrets."
  );
}

export const ENV = {
  API_URL: API_URL ?? "",
  STRIPE_PK: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  REVENUECAT_IOS: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
} as const;
