/**
 * Couleur de fond partagée par le splash natif (app.config.ts → plugin expo-splash-screen),
 * le launch splash JS et les transitions in-app. Les trois DOIVENT rester identiques :
 * un écart, même léger, produit un flash de couleur visible au moment du hand-off.
 */
export const SPLASH_BACKGROUND_COLOR = "#FFF0F5";
