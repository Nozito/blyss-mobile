// Single source of truth — mirrors web app tailwind.config.ts + src/index.css CSS variables

/** Returns a hex color with an alpha suffix (e.g. withAlpha(Colors.primary, 0.15) → "#FF5EA026") */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, "0").toUpperCase()}`;
}

export const Colors = {
  // === Brand ===
  // --blyss-pink: hsl(336 99% 68%)
  primary: "#FF5EA0",
  // --blyss-pink-light: hsl(336 100% 95%)
  primaryLight: "#FFEAF5",
  // --blyss-gold: hsl(32 60% 65%)
  secondary: "#C9934A",
  // --blyss-gold-light: hsl(32 50% 94%)
  secondaryLight: "#F4E8D9",
  // --blyss-cream: hsl(30 33% 96%)
  cream: "#F7F3EF",

  // === Backgrounds ===
  // --background: #ffeaf1
  background: "#FFEAF1",
  // --card: hsl(0 0% 100%)
  card: "#FFFFFF",
  // --muted: hsl(30 33% 96%)
  muted: "#F7F3EF",
  // --popover: hsl(0 0% 100%)
  popover: "#FFFFFF",

  // === Text ===
  // --foreground: hsl(240 10% 3.9%)
  foreground: "#09090B",
  cardForeground: "#09090B",
  // --muted-foreground: hsl(240 5% 45%)
  mutedForeground: "#6B7280",
  // --primary-foreground: hsl(0 0% 100%)
  primaryForeground: "#FFFFFF",
  // --secondary-foreground: hsl(0 0% 100%)
  secondaryForeground: "#FFFFFF",
  white: "#FFFFFF",

  // === Border / Input ===
  // --border: hsl(30 20% 90%)
  border: "#EDE7E0",
  // --input: hsl(30 20% 90%)
  input: "#EDE7E0",
  // --ring: hsl(336 99% 68%)
  ring: "#FF5EA0",

  // === Accent ===
  // --accent: hsl(336 100% 95%)
  accent: "#FFEAF5",
  accentForeground: "#FF5EA0",

  // === Semantic ===
  // --destructive: hsl(0 84% 60%)
  destructive: "#F03A3A",
  destructiveForeground: "#FFFFFF",
  success: "#22C55E",
  successForeground: "#FFFFFF",
  warning: "#F59E0B",
  warningForeground: "#FFFFFF",
  info: "#3B82F6",
  infoForeground: "#FFFFFF",

  // === Role badges (display only) ===
  client: "#FF5EA0",
  pro: "#8B5CF6",
  admin: "#F97316",

  // === Input fields ===
  inputBackground: "#F8F5F2",
  inputBorder: "#E4E0DC",
  inputPlaceholder: "#C0BAB5",
  inputText: "#09090B",

  // === Shadows / Overlays ===
  overlay: "rgba(0,0,0,0.4)",
  overlayLight: "rgba(0,0,0,0.2)",
  glassWhite: "rgba(255,255,255,0.88)",

  // === Gradient stops (for use with LinearGradient) ===
  primaryGradientStart: "#FF5EA0",
  primaryGradientMid: "#FF6FAD",
  primaryGradientEnd: "#FF80B8",

  secondaryGradientStart: "#C9934A",
  secondaryGradientEnd: "#D9A870",
} as const;

export type ColorKey = keyof typeof Colors;
