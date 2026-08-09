import WidgetKit
import SwiftUI

/// Widget avancé (Admin) — "REVENUS BLYSS". Two amounts and a trend — stays
/// a widget, never grows into a full dashboard.
struct GrowthWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: GrowthPayload

    var body: some View {
        VStack(alignment: .leading, spacing: family == .systemSmall ? 6 : 10) {
            WidgetHeaderView(label: "Revenus Blyss")
            Spacer(minLength: 2)
            amount(value: BlyssEuroFormat.string(from: payload.todayAmountEuros), caption: "Aujourd'hui", emphasized: true)
            if family != .systemSmall {
                amount(value: BlyssEuroFormat.string(from: payload.weekAmountEuros), caption: "Cette semaine", emphasized: false)
            }
            Spacer(minLength: 2)
            Text(BlyssPercentFormat.string(from: payload.growthPercent))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
                .lineLimit(1)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "blyss://(admin)/dashboard"))
    }

    private func amount(value: String, caption: String, emphasized: Bool) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.system(size: emphasized ? 22 : 16, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(caption)
                .font(.system(size: 11))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
        }
    }
}

struct GrowthWidget: Widget {
    let kind = "GrowthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider(
                placeholderPayload: BlyssWidgetMock.growth,
                currentPayload: { BlyssWidgetMock.growth },
                refreshMinutes: 30
            )
        ) { entry in
            GrowthWidgetView(payload: entry.payload)
        }
        .configurationDisplayName("Revenus & croissance")
        .description("Les revenus Blyss du jour, de la semaine et leur évolution.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@available(iOS 17.0, *)
#Preview("Small — Light", as: .systemSmall) {
    GrowthWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.growth)
}

@available(iOS 17.0, *)
#Preview("Medium — Light", as: .systemMedium) {
    GrowthWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.growth)
}
