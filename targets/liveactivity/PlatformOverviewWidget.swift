import WidgetKit
import SwiftUI

/// Widget principal (Admin) — "VUE PLATEFORME". Aggregate counts only — no
/// client or pro name is ever shown in an Admin widget.
struct PlatformOverviewWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: PlatformOverviewPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "Vue plateforme")
            Spacer(minLength: 2)
            if family == .systemSmall {
                VStack(alignment: .leading, spacing: 4) {
                    metric(value: "\(payload.activePros)", label: "pros actives")
                    metric(value: "\(payload.reservations)", label: "réservations")
                }
                Spacer(minLength: 2)
                growthLine
            } else {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        metric(value: "\(payload.activePros)", label: "pros actives")
                        metric(value: "\(payload.reservations)", label: "réservations")
                    }
                    Spacer()
                    growthLine
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "blyss://(admin)/dashboard"))
    }

    private func metric(value: String, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.textPrimary)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }

    private var growthLine: some View {
        Text("\(BlyssPercentFormat.string(from: payload.growthPercent)) cette semaine")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(BlyssWidgetPalette.textSecondary)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
    }
}

struct PlatformOverviewWidget: Widget {
    let kind = "PlatformOverviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider(
                placeholderPayload: BlyssWidgetMock.platformOverview,
                currentPayload: { BlyssWidgetMock.platformOverview },
                refreshMinutes: 30
            )
        ) { entry in
            PlatformOverviewWidgetView(payload: entry.payload)
        }
        .configurationDisplayName("Vue plateforme")
        .description("Le nombre de pros actives, de réservations et leur évolution.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@available(iOS 17.0, *)
#Preview("Small — Light", as: .systemSmall) {
    PlatformOverviewWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.platformOverview)
}

@available(iOS 17.0, *)
#Preview("Medium — Light", as: .systemMedium) {
    PlatformOverviewWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.platformOverview)
}
