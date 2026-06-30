// Single source of truth — mirrors web app tailwind.config.ts + src/index.css CSS variables

/** Returns a hex color with an alpha suffix (e.g. withAlpha(Colors.primary, 0.15) → "#FE5D9D26") */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, "0").toUpperCase()}`;
}

export const Colors = {
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
  white: "#FFFFFF",

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

export type ColorKey = keyof typeof Colors;
