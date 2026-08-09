import SwiftUI
import UIKit

/// Color tokens for the Pro/Admin widget suite (NextAppointment, DaySummary,
/// Revenue, PlatformOverview, Alerts, Growth, Logo).
///
/// v1 is intentionally brand-free: every case below maps 1:1 to a system
/// semantic color (Apple HIG: sobre, éditorial, natif). When the Blyss
/// palette is reintroduced, only the right-hand side of each case changes
/// here — no widget view needs to be touched.
enum BlyssWidgetPalette {
    static var textPrimary: Color { .primary }
    static var textSecondary: Color { .secondary }
    /// SwiftUI has no `Color.tertiary` (only the `.tertiary` ShapeStyle,
    /// which can't be stored as a `Color`) — `.tertiaryLabel` is the
    /// equivalent system semantic that adapts the same way across
    /// Light/Dark/increased-contrast.
    static var textTertiary: Color { Color(uiColor: .tertiaryLabel) }
    static var separator: Color { Color(uiColor: .separator) }
}
