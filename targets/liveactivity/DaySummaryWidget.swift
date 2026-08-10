import WidgetKit
import SwiftUI

/// Widget secondaire (Pro) — "MA JOURNÉE". A synthesis, never a client list:
/// a count, the next time, and — once the day is over — how many were done.
struct DaySummaryWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: DaySummaryPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "Ma journée")
            Spacer(minLength: 2)
            content
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(BlyssWidgetPalette.background)
        .widgetURL(URL(string: "blyss://calendar"))
    }

    @ViewBuilder
    private var content: some View {
        switch payload.state {
        case let .scheduled(count, nextTime, inProgressCount):
            scheduled(count: count, nextTime: nextTime, inProgressCount: inProgressCount)
        case .free:
            VStack(alignment: .leading, spacing: 2) {
                Text("Journée libre")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.textPrimary)
                Text("Aucun rendez-vous")
                    .font(.system(size: 12))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
            }
        case let .finished(completedCount):
            VStack(alignment: .leading, spacing: 2) {
                Text("Journée terminée")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.textPrimary)
                Text("\(completedCount) rendez-vous réalisé\(completedCount > 1 ? "s" : "")")
                    .font(.system(size: 12))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
            }
        }
    }

    @ViewBuilder
    private func scheduled(count: Int, nextTime: Date, inProgressCount: Int) -> some View {
        if family == .systemSmall {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count)")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.accent)
                Text("rendez-vous")
                    .font(.system(size: 12))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                Text("Prochain · \(nextTime.formatted(date: .omitted, time: .shortened))")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
                    .padding(.top, 2)
            }
        } else {
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(count)")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(BlyssWidgetPalette.accent)
                    Text("rendez-vous aujourd'hui")
                        .font(.system(size: 12))
                        .foregroundStyle(BlyssWidgetPalette.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                WidgetVerticalDivider().padding(.vertical, 4)
                VStack(alignment: .leading, spacing: 8) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Prochain")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(BlyssWidgetPalette.textSecondary)
                        Text(nextTime.formatted(date: .omitted, time: .shortened))
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(BlyssWidgetPalette.textPrimary)
                    }
                    if inProgressCount > 0 {
                        WidgetPercentPill(text: "\(inProgressCount) en cours")
                    }
                }
                .padding(.leading, 16)
            }
        }
    }
}

struct DaySummaryWidget: Widget {
    let kind = "DaySummaryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider(
                placeholderPayload: BlyssWidgetMock.daySummaryScheduled,
                currentPayload: { BlyssWidgetMock.daySummaryScheduled },
                refreshMinutes: 15
            )
        ) { entry in
            DaySummaryWidgetView(payload: entry.payload)
        }
        .configurationDisplayName("Ma journée")
        .description("Le nombre de rendez-vous de ta journée et l'heure du prochain.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@available(iOS 17.0, *)
#Preview("Scheduled — Small", as: .systemSmall) {
    DaySummaryWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.daySummaryScheduled)
}

@available(iOS 17.0, *)
#Preview("Scheduled — Medium", as: .systemMedium) {
    DaySummaryWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.daySummaryScheduled)
}

@available(iOS 17.0, *)
#Preview("Free day", as: .systemSmall) {
    DaySummaryWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.daySummaryFree)
}

@available(iOS 17.0, *)
#Preview("Finished day", as: .systemSmall) {
    DaySummaryWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.daySummaryFinished)
}
