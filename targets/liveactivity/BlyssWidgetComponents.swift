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
