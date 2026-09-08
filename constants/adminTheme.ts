import { Platform } from "react-native";
import { Colors, withAlpha } from "@/constants/colors";

const MONO_FAMILY = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// DA "Choc" — reprise du langage du tunnel d'onboarding client, alignée sur
// le web admin refondu : nuit prune quasi-noire, rose de marque en aplat
// franc, titres 900 CAPITALES à chasse serrée, chiffres monospace, filets
// nets. Zéro dégradé, zéro glow, angles quasi vifs.
export const ADMIN = {
  bg:           "#0F0810",
  surface:      "#1E1119",
  surfaceHover: "#2A1824",
  border:       "rgba(243,231,238,0.10)",
  borderStrong: "#F3E7EE",        // filet franc (traits d'accent, séparateurs forts)
  text:         "#F3E7EE",
  textSub:      "#A87F95",
  textMuted:    "rgba(243,231,238,0.32)",

  accent:       Colors.primary,   // #FE5D9D
  accentBg:     withAlpha(Colors.primary, 0.14),
  accentBorder: withAlpha(Colors.primary, 0.34),
  accentInk:    "#14070C",        // texte posé SUR un aplat rose plein
  accentSub:    "#5C1332",        // libellés secondaires sur aplat rose

  cardRadius:   4,
  sheetRadius:  20,
  shadowColor:  "#000",
  shadowOpts: {
    shadowOpacity: 0.28,
    shadowRadius:  16,
    shadowOffset:  { width: 0, height: 6 },
  },

  // ── Semantic tokens ──────────────────────────────────────────────────────
  danger:      Colors.destructive,
  dangerBg:    withAlpha(Colors.destructive, 0.14),
  dangerBorder: withAlpha(Colors.destructive, 0.34),

  success:      Colors.success,
  successBg:    withAlpha(Colors.success, 0.14),
  successBorder: withAlpha(Colors.success, 0.34),

  warning:      Colors.warning,
  warningBg:    withAlpha(Colors.warning, 0.14),
  warningBorder: withAlpha(Colors.warning, 0.34),

  info:      Colors.info,
  infoBg:    withAlpha(Colors.info, 0.14),
  infoBorder: withAlpha(Colors.info, 0.34),

  // ── Overlays (sheets / modals) ───────────────────────────────────────────
  overlay:     withAlpha("#0A0509", 0.74),
  sheetHandle: withAlpha("#F3E7EE", 0.2),

  // ── Ruban rayé rose × prune (accent de marque, filet ou barre) ───────────
  ribbonStripe: ["#FE5D9D", "#3D1F2C"] as const,

  // ── Spacing — rythme 8pt. ───────────────────────────────────────────────
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const,

  // ── Typographie ────────────────────────────────────────────────────────
  //  hero    → la métrique phare, énorme
  //  display → titre d'écran
  //  title   → titre de section (capitales aussi)
  //  body    → texte courant
  //  label   → sur-titre / libellé (mono-esque, très espacé)
  //  mono    → chiffres, montants, IDs
  type: {
    hero:    { fontSize: 56, fontWeight: "900", letterSpacing: -2.6, textTransform: "uppercase" } as const,
    display: { fontSize: 34, fontWeight: "900", letterSpacing: -1.4, textTransform: "uppercase" } as const,
    title:   { fontSize: 15, fontWeight: "900", letterSpacing: -0.3, textTransform: "uppercase" } as const,
    // Nom d'une personne / entité — jamais en capitales, mais dense.
    name:    { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 } as const,
    body:    { fontSize: 13, fontWeight: "600", letterSpacing: 0 } as const,
    label:   { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" } as const,
    mono:    { fontFamily: MONO_FAMILY, fontWeight: "700", letterSpacing: -0.4 } as const,
    // Conservé pour compat des écrans pas encore repris.
    caption: { fontSize: 12, fontWeight: "500", letterSpacing: 0.1 } as const,
  },
} as const;

/** Police monospace multiplateforme pour les chiffres. */
export const MONO = { fontFamily: MONO_FAMILY } as const;
