import SwiftUI
import UIKit

/// Color tokens for the Pro/Admin widget suite (NextAppointment, DaySummary,
/// Revenue, PlatformOverview, Alerts, Growth, Logo).
///
/// v1 shipped brand-free (system semantics only). This is v2: the Blyss
/// palette is back for `background` and `accent` — text hierarchy stays on
/// system semantics (.primary/.secondary/.tertiaryLabel/.separator) so
/// contrast keeps adapting correctly in both themes and under increased
/// contrast. `$accent` / `blyssBackground` are the same named colors the
/// Live Activity already uses (LiveRdvLiveActivity.swift, Assets.xcassets) —
/// one definition, shared across every surface in this target.
enum BlyssWidgetPalette {
    static var textPrimary: Color { .primary }
    static var textSecondary: Color { .secondary }
    /// SwiftUI has no `Color.tertiary` (only the `.tertiary` ShapeStyle,
    /// which can't be stored as a `Color`) — `.tertiaryLabel` is the
    /// equivalent system semantic that adapts the same way across
    /// Light/Dark/increased-contrast.
    static var textTertiary: Color { Color(uiColor: .tertiaryLabel) }
    static var separator: Color { Color(uiColor: .separator) }

    /// Brand pink (#FE5D9D) — reserved for each widget's single hero figure
    /// (a time, a count, an amount). Never used for body/secondary text.
    static var accent: Color { Color("$accent") }
    /// Widget card background — same value as the app's own background
    /// (constants/colors.ts: #FFEAF1 light / #0A0A0B dark), not a generic
    /// white/near-black card.
    static var background: Color { Color("blyssBackground") }
}
