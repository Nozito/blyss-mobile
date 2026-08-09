/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "LiveRdvWidget",
  displayName: "Live RDV",
  // ActivityKit content-state Text(timerInterval:) needs 16.1+; targeting
  // 16.2 to match the earliest fully-stable Live Activity API surface.
  deploymentTarget: "16.2",
  frameworks: ["SwiftUI", "ActivityKit", "WidgetKit"],
  // Mirrors constants/colors.ts (LightColors/DarkColors) — single source of
  // truth for the app's palette, kept in sync by hand since the widget
  // target can't import the RN color module directly.
  //
  // Note: @bacons/apple-targets@5.0.0's actual implementation reads
  // `color.light` / `color.dark` — the README's `{ color, darkColor }`
  // example is stale for this version. Verified via with-widget.js source.
  colors: {
    $accent: { light: "#FE5D9D", dark: "#FE5D9D" }, // primary — brand pink, same in both themes
    $widgetBackground: { light: "#FFFFFF", dark: "#1C1C1E" }, // card
    blyssBackground: { light: "#FFEAF1", dark: "#0A0A0B" },
    blyssCard: { light: "#FFFFFF", dark: "#1C1C1E" },
    blyssForeground: { light: "#09090B", dark: "#FAFAFA" },
    blyssMuted: { light: "#6D6D78", dark: "#A1A1AA" },
    blyssBorder: { light: "#EBE6E0", dark: "#2C2C2E" },
  },
  // App Group mirrors ios.entitlements['com.apple.security.application-groups']
  // from app.config.ts automatically (see @bacons/apple-targets README) — the
  // static home-screen widget reads the shared next-appointment payload from it.
};
