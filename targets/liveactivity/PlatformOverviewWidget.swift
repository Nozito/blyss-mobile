import WidgetKit
import SwiftUI

/// Widget principal (Admin) — "VUE PLATEFORME". Aggregate counts only — no
/// client or pro name is ever shown in an Admin widget.
struct PlatformOverviewWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: PlatformOverviewPayload

    var body: some View {
        Group {
            if family == .systemSmall {
                small
            } else {
                medium
            }
        }
        .blyssContainerBackground(BlyssWidgetPalette.background)
        .widgetURL(URL(string: "blyss://(admin)/dashboard"))
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "Vue plateforme")
            Spacer(minLength: 2)
            metric(value: "\(payload.activePros)", label: "pros actives")
            metric(value: "\(payload.reservations)", label: "réservations")
            Spacer(minLength: 2)
            Text("\(BlyssPercentFormat.string(from: payload.growthPercent)) cette semaine")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
                .lineLimit(1)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetHeaderView(label: "Vue plateforme")
            HStack(spacing: 0) {
                column(value: "\(payload.activePros)", label: "pros actives", rose: true)
                WidgetVerticalDivider().padding(.vertical, 2)
                column(value: "\(payload.reservations)", label: "réservations", rose: true)
                WidgetVerticalDivider().padding(.vertical, 2)
                column(value: BlyssPercentFormat.string(from: payload.growthPercent), label: "cette semaine", rose: false)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(16)
    }

    private func column(value: String, label: String, rose: Bool) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(rose ? BlyssWidgetPalette.accent : BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
    }

    private func metric(value: String, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.accent)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
        }
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
                currentPayload: { WidgetSnapshotStore.read()?.platformOverview ?? BlyssWidgetMock.platformOverview },
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
