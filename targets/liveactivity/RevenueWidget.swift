import WidgetKit
import SwiftUI

/// Widget avancé (Pro) — "CHIFFRE D'AFFAIRES". One strong number, one trend,
/// one optional objective — no chart in this first version.
struct RevenueWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: RevenuePayload

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "Chiffre d'affaires")
            Spacer(minLength: 2)
            Text(BlyssEuroFormat.string(from: payload.monthAmountEuros))
                .font(.system(size: family == .systemSmall ? 24 : 30, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text("\(BlyssPercentFormat.string(from: payload.growthPercent)) vs mois dernier")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            // Compact formats show less — the objective line only earns its
            // place once there's room for it (systemMedium and up).
            if family != .systemSmall, let objective = payload.objectiveAmountEuros {
                Text("Objectif · \(BlyssEuroFormat.string(from: objective))")
                    .font(.system(size: 12))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "blyss://finance"))
    }
}

struct RevenueWidget: Widget {
    let kind = "RevenueWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider(
                placeholderPayload: BlyssWidgetMock.revenue,
                currentPayload: { BlyssWidgetMock.revenue },
                refreshMinutes: 30
            )
        ) { entry in
            RevenueWidgetView(payload: entry.payload)
        }
        .configurationDisplayName("Chiffre d'affaires")
        .description("Ton chiffre d'affaires du mois, son évolution et ton objectif.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@available(iOS 17.0, *)
#Preview("Small — Light", as: .systemSmall) {
    RevenueWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.revenue)
}

@available(iOS 17.0, *)
#Preview("Medium — Light", as: .systemMedium) {
    RevenueWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.revenue)
}
