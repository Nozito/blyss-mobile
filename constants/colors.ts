// Single source of truth — mirrors web app tailwind.config.ts + src/index.css CSS variables

/** Returns a hex color with an alpha suffix (e.g. withAlpha(Colors.primary, 0.15) → "#FE5D9D26") */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, "0").toUpperCase()}`;
}

// Palette claire — inchangée, reste la valeur par défaut de `Colors` pour tous
// les écrans pas encore migrés vers `useThemeColors()`.
export const LightColors = {
  // === Brand ===
  primary: "#FE5D9D",
  primaryLight: "#FFE6F0",
  secondary: "#DBA970",
  secondaryLight: "#F7F0E8",
  cream: "#F8F5F1",

  // === Backgrounds ===
  background: "#FFEAF1",
  card: "#FFFFFF",
  muted: "#F8F5F1",
  popover: "#FFFFFF",

  // === Text ===
  foreground: "#09090B",
  cardForeground: "#09090B",
  mutedForeground: "#6D6D78",
  primaryForeground: "#FFFFFF",
  secondaryForeground: "#FFFFFF",
  // NB: "white" est utilisé partout dans l'app comme couleur de fond des
  // cards/surfaces (pas seulement comme "blanc" littéral) — voir DarkColors.white.
  white: "#FFFFFF",
  // Blanc littéral et fixe (texte/icônes sur un fond coloré plein — bouton
  // primary, badge destructive/success, hero gradient) — reste #FFFFFF dans
  // les deux thèmes, contrairement à "white" qui suit le thème.
  onColor: "#FFFFFF",

  // === Border / Input ===
  border: "#EBE6E0",
  input: "#EBE6E0",
  ring: "#FE5D9D",

  // === Accent ===
  accent: "#FFE6F0",
  accentForeground: "#FE5D9D",

  // === Semantic ===
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  destructiveLight: "#FEF2F2",
  destructiveText: "#DC2626",

  success: "#22C55E",
  successForeground: "#FFFFFF",
  successLight: "#F0FDF4",
  successText: "#16A34A",
  successTextDark: "#15803D",
  successBorder: "#BBF7D0",

  warning: "#F59E0B",
  warningForeground: "#FFFFFF",
  warningLight: "#FFF7ED",
  warningText: "#D97706",
  warningTextDark: "#B45309",
  warningBorder: "#FED7AA",

  info: "#3B82F6",
  infoForeground: "#FFFFFF",
  infoLight: "#EFF6FF",
  infoText: "#1D4ED8",

  // === Disabled ===
  disabled: "#D1D5DB",

  // === Role badges (display only) ===
  client: "#FE5D9D",
  pro: "#8B5CF6",
  admin: "#F97316",

  // === Input fields ===
  inputBackground: "#F8F5F1",
  inputBorder: "#EBE6E0",
  inputPlaceholder: "#C0BAB5",
  inputText: "#09090B",

  // === Neutrals ===
  black: "#000000",

  // === Shadows / Overlays ===
  overlay: "rgba(0,0,0,0.4)",
  overlayDark: "rgba(0,0,0,0.5)",
  overlayLight: "rgba(0,0,0,0.2)",
  shadowDark: "rgba(0,0,0,0.08)",
  glassWhite: "rgba(255,255,255,0.88)",

  // === Gradient stops (for use with LinearGradient) ===
  primaryGradientStart: "#FE5D9D",
  primaryGradientMid: "#FF6FAD",
  primaryGradientEnd: "#FF80B8",

  secondaryGradientStart: "#DBA970",
  secondaryGradientEnd: "#E8BC87",
} as const;

// Palette sombre — noir/gris classique, le rose de marque reste identique.
// Mêmes clés que LightColors (même forme), valeurs adaptées pour le contraste
// sur fond sombre.
export const DarkColors: Record<keyof typeof LightColors, string> = {
  // === Brand ===
  primary: "#FE5D9D",
  primaryLight: "#3D1F2C",
  secondary: "#DBA970",
  secondaryLight: "#2A2420",
  cream: "#242024",

  // === Backgrounds ===
  background: "#0A0A0B",
  card: "#1C1C1E",
  muted: "#27272A",
  popover: "#1C1C1E",

  // === Text ===
  foreground: "#FAFAFA",
  cardForeground: "#FAFAFA",
  mutedForeground: "#A1A1AA",
  primaryForeground: "#FFFFFF",
  secondaryForeground: "#FFFFFF",
  // "white" = couleur de surface (cards) dans tout le code existant, pas du
  // blanc littéral — doit donc suivre le thème, pas rester #FFFFFF.
  white: "#1C1C1E",
  onColor: "#FFFFFF",

  // === Border / Input ===
  border: "#2C2C2E",
  input: "#2C2C2E",
  ring: "#FE5D9D",

  // === Accent ===
  accent: "#3D1F2C",
  accentForeground: "#FF7FB4",

  // === Semantic ===
  destructive: "#F87171",
  destructiveForeground: "#FFFFFF",
  destructiveLight: "#3F1D1D",
  destructiveText: "#FCA5A5",

  success: "#4ADE80",
  successForeground: "#052E16",
  successLight: "#14291B",
  successText: "#4ADE80",
  successTextDark: "#86EFAC",
  successBorder: "#166534",

  warning: "#FBBF24",
  warningForeground: "#451A03",
  warningLight: "#2E2410",
  warningText: "#FBBF24",
  warningTextDark: "#FCD34D",
  warningBorder: "#92400E",

  info: "#60A5FA",
  infoForeground: "#0C1E3D",
  infoLight: "#1E2A4A",
  infoText: "#93C5FD",

  // === Disabled ===
  disabled: "#3F3F46",

  // === Role badges (display only) — restent vifs, lisibles sur fond sombre ===
  client: "#FE5D9D",
  pro: "#A78BFA",
  admin: "#FB923C",

  // === Input fields ===
  inputBackground: "#1C1C1E",
  inputBorder: "#2C2C2E",
  inputPlaceholder: "#6B6B70",
  inputText: "#FAFAFA",

  // === Neutrals ===
  black: "#000000",

  // === Shadows / Overlays ===
  overlay: "rgba(0,0,0,0.6)",
  overlayDark: "rgba(0,0,0,0.7)",
  overlayLight: "rgba(0,0,0,0.35)",
  shadowDark: "rgba(0,0,0,0.4)",
  glassWhite: "rgba(28,28,30,0.88)",

  // === Gradient stops (for use with LinearGradient) ===
  primaryGradientStart: "#FE5D9D",
  primaryGradientMid: "#FF6FAD",
  primaryGradientEnd: "#FF80B8",

  secondaryGradientStart: "#DBA970",
  secondaryGradientEnd: "#E8BC87",
};

// Alias historique — écrans pas encore migrés vers useThemeColors() continuent
// à utiliser la palette claire telle quelle, aucune régression.
export const Colors = LightColors;

export type ColorKey = keyof typeof LightColors;
