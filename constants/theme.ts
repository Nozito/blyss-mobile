export { Colors, withAlpha } from "./colors";
export type { ColorKey } from "./colors";
export { Shadows } from "./shadows";
export type { ShadowKey } from "./shadows";
export { Fonts } from "./fonts";

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 64,
} as const;

export const BorderRadius = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  "4xl": 32,
  full: 9999,
} as const;

export const FontSize = {
  "2xs": 10,
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 15,
  xl: 16,
  "2xl": 18,
  "3xl": 22,
  "4xl": 26,
  "5xl": 30,
  "6xl": 36,
} as const;

export const FontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
  black: "900" as const,
} as const;

export const LineHeight = {
  tight: 16,
  snug: 18,
  normal: 20,
  relaxed: 22,
  loose: 24,
  airy: 28,
} as const;

/** Padding below scrollable content to clear the native tab bar + safe area */
export const TAB_BOTTOM_PADDING = 96;

/** Minimum touch target size (Apple HIG: 44pt) */
export const MIN_TOUCH_SIZE = 44;
