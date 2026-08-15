export const ENV = {
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? "",
  STRIPE_PK: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  REVENUECAT_IOS: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
  POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
} as const;

const REQUIRED: Array<{ key: keyof typeof ENV; label: string }> = [
  { key: "API_URL", label: "EXPO_PUBLIC_API_URL" },
];

export function validateEnv(): void {
  if (process.env.NODE_ENV === "test") return;
  const missing = REQUIRED.filter(({ key }) => !ENV[key]);
  if (missing.length > 0) {
    const vars = missing.map(({ label }) => label).join(", ");
    throw new Error(`[Blyss] Variables d'environnement manquantes : ${vars}\nDéfinis-les dans .env ou via EAS secrets.`);
  }
}
