/**
 * Couleurs de fond partagées par le splash natif (app.config.ts → plugin expo-splash-screen,
 * variantes light/dark), le launch splash JS et les transitions in-app. Chaque paire DOIT
 * rester identique à sa contrepartie native : un écart, même léger, produit un flash de
 * couleur visible au moment du hand-off. La variante dark matche DarkColors.background
 * (constants/colors.ts).
 */
export const SPLASH_BACKGROUND_COLOR = "#FFF0F5";
export const SPLASH_BACKGROUND_COLOR_DARK = "#0A0A0B";
