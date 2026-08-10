import SwiftUI

/// Small-caps-style eyebrow label ("PROCHAIN RENDEZ-VOUS", "MA JOURNÉE"...)
/// shared by every widget so the label treatment never drifts between them.
struct WidgetHeaderView: View {
    let label: String

    var body: some View {
        Text(label.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.6)
            .foregroundStyle(BlyssWidgetPalette.textSecondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }
}

/// Shared "nothing to show" layout — used whenever a widget's payload has no
/// data for the current state (e.g. no upcoming appointment).
struct WidgetEmptyStateView: View {
    let systemImage: String
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: systemImage)
                .font(.system(size: 17))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// French, no-decimal euro formatting ("2 840 €") shared by every widget
/// that surfaces a monetary amount.
enum BlyssEuroFormat {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "fr_FR")
        f.currencySymbol = "€"
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 0
        return f
    }()

    static func string(from euros: Int) -> String {
        formatter.string(from: NSNumber(value: euros)) ?? "\(euros) €"
    }
}

/// "+12%" / "-4%" — shared growth-percentage formatting (one decimal when
/// the value isn't a whole number, matching the brief's "+12%" and "+8,4%"
/// examples).
enum BlyssPercentFormat {
    static func string(from percent: Double) -> String {
        let sign = percent >= 0 ? "+" : ""
        let rounded = (percent * 10).rounded() / 10
        if rounded == rounded.rounded() {
            return "\(sign)\(Int(rounded))%"
        }
        return "\(sign)\(rounded.formatted(.number.precision(.fractionLength(1))))%"
    }
}

/// "dans 2 h 15" / "dans 45 min" — the countdown line under a widget's hero
/// time, so the medium layout's second column carries real information
/// instead of repeating the time already shown.
enum BlyssRelativeTime {
    static func until(_ date: Date, from now: Date = Date()) -> String {
        let minutes = max(0, Int(date.timeIntervalSince(now) / 60))
        if minutes < 1 { return "maintenant" }
        if minutes < 60 { return "dans \(minutes) min" }
        let hours = minutes / 60
        let rest = minutes % 60
        return rest == 0 ? "dans \(hours) h" : "dans \(hours) h \(String(format: "%02d", rest))"
    }
}

/// Hairline vertical rule splitting a systemMedium layout into two columns —
/// `.separator` is one of the explicitly allowed system colors, so this adds
/// real structure without becoming a "decorative gray card" effect.
struct WidgetVerticalDivider: View {
    var body: some View {
        Rectangle()
            .fill(BlyssWidgetPalette.separator)
            .frame(width: 1)
    }
}

/// A capsule badge for a trend or status ("+12%", "1 en cours"). Two sizes so
/// the badge stays legible next to whatever figure it sits beside — a 13pt
/// pill next to a 30pt number reads as an afterthought.
struct WidgetPercentPill: View {
    enum Size {
        case small, large

        var font: Font {
            switch self {
            case .small: return .system(size: 13, weight: .bold)
            case .large: return .system(size: 15, weight: .bold)
            }
        }
        var padding: (h: CGFloat, v: CGFloat) {
            switch self {
            case .small: return (11, 4)
            case .large: return (14, 6)
            }
        }
    }

    let text: String
    var size: Size = .small

    var body: some View {
        Text(text)
            .font(size.font)
            .foregroundStyle(BlyssWidgetPalette.textSecondary)
            .lineLimit(1)
            .padding(.horizontal, size.padding.h)
            .padding(.vertical, size.padding.v)
            .overlay(
                Capsule().strokeBorder(BlyssWidgetPalette.separator, lineWidth: 1.5)
            )
    }
}

/// Thin progress track for "how close to the objective" — the brand accent
/// as a fill is legitimate here (it's the same hero-figure treatment as
/// everywhere else), the track itself stays on `.separator`.
struct WidgetProgressBar: View {
    /// 0...1
    let progress: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(BlyssWidgetPalette.separator)
                Capsule()
                    .fill(BlyssWidgetPalette.accent)
                    .frame(width: geo.size.width * min(max(progress, 0), 1))
            }
        }
        .frame(height: 4)
    }
}
