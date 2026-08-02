import { Colors, withAlpha } from "@/constants/colors";

// Warm anthracite dark theme, accented with the Blyss brand pink — a
// restrained "professional tool" surface, not a disconnected neon/glass
// dashboard. Flat cards, no decorative gradients/blur/glow.
export const ADMIN = {
  bg:           "#17151A",
  surface:      "#1F1C22",
  surfaceHover: "#26222A",
  border:       "rgba(245,241,238,0.08)",
  borderStrong: "rgba(245,241,238,0.16)",
  text:         "#F5F1EE",
  textSub:      "rgba(245,241,238,0.58)",
  textMuted:    "rgba(245,241,238,0.34)",
  accent:       Colors.primary,
  accentBg:     withAlpha(Colors.primary, 0.14),
  accentBorder: withAlpha(Colors.primary, 0.32),
  cardRadius:   16,
  sheetRadius:  24,
  shadowColor:  "#000",
  shadowOpts: {
    shadowOpacity: 0.18,
    shadowRadius:  10,
    shadowOffset:  { width: 0, height: 3 },
  },

  // ── Semantic tokens ──────────────────────────────────────────────────────
  // Single source of truth for status colors across all admin screens.
  // Always import these instead of reaching into Colors.* directly or
  // hardcoding rgba()/hex.
  danger:      Colors.destructive,
  dangerBg:    withAlpha(Colors.destructive, 0.14),
  dangerBorder: withAlpha(Colors.destructive, 0.32),

  success:      Colors.success,
  successBg:    withAlpha(Colors.success, 0.14),
  successBorder: withAlpha(Colors.success, 0.32),

  warning:      Colors.warning,
  warningBg:    withAlpha(Colors.warning, 0.14),
  warningBorder: withAlpha(Colors.warning, 0.32),

  info:      Colors.info,
  infoBg:    withAlpha(Colors.info, 0.14),
  infoBorder: withAlpha(Colors.info, 0.32),

  // ── Overlays (sheets / modals) ───────────────────────────────────────────
  overlay:     withAlpha(Colors.black, 0.55),
  sheetHandle: withAlpha("#F5F1EE", 0.2),

  // ── Spacing — everything on an 8pt rhythm. Use these, never raw numbers. ─
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const,

  // ── Typography — 4 sizes total. Nothing in between. ─────────────────────
  type: {
    display: { fontSize: 26, fontWeight: "700",  letterSpacing: -0.5 } as const,
    title:   { fontSize: 17, fontWeight: "600",  letterSpacing: -0.2 } as const,
    body:    { fontSize: 14, fontWeight: "400",  letterSpacing: 0    } as const,
    caption: { fontSize: 12, fontWeight: "500",  letterSpacing: 0.1  } as const,
  },
} as const;
