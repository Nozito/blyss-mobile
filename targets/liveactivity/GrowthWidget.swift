import WidgetKit
import SwiftUI

/// Widget avancé (Admin) — "REVENUS BLYSS". Two amounts and a trend — stays
/// a widget, never grows into a full dashboard.
struct GrowthWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: GrowthPayload

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
        VStack(alignment: .leading, spacing: 6) {
            WidgetHeaderView(label: "Revenus Blyss")
            Spacer(minLength: 2)
            amount(value: BlyssEuroFormat.string(from: payload.todayAmountEuros), caption: "Aujourd'hui", size: 24)
            // Same pill size as the medium layout below — the badge reads as
            // the same UI element regardless of which family it's shown in.
            WidgetPercentPill(text: BlyssPercentFormat.string(from: payload.growthPercent), size: .large)
                .padding(.top, 2)
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetHeaderView(label: "Revenus Blyss")
            HStack(spacing: 0) {
                amount(value: BlyssEuroFormat.string(from: payload.todayAmountEuros), caption: "Aujourd'hui", size: 26)
                    .frame(maxWidth: .infinity, alignment: .leading)
                WidgetVerticalDivider().padding(.vertical, 2)
                amount(value: BlyssEuroFormat.string(from: payload.weekAmountEuros), caption: "Cette semaine", size: 26, rose: false)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 16)
            }
            WidgetPercentPill(text: BlyssPercentFormat.string(from: payload.growthPercent), size: .large)
        }
        .padding(16)
    }

    private func amount(value: String, caption: String, size: CGFloat, rose: Bool = true) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(caption)
                .font(.system(size: 11))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
            Text(value)
                .font(.system(size: size, weight: .bold))
                .foregroundStyle(rose ? BlyssWidgetPalette.accent : BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }
}

struct GrowthWidget: Widget {
    let kind = "GrowthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider<WidgetAccess<GrowthPayload>>(
                placeholderPayload: .granted(BlyssWidgetMock.growth),
                currentPayload: {
                    guard WidgetSnapshotStore.hasAdminAccess() else { return .locked }
                    return .granted(WidgetSnapshotStore.read()?.growth ?? BlyssWidgetMock.growth)
                },
                refreshMinutes: 30
            )
        ) { entry in
            switch entry.payload {
            case .locked:
                WidgetLockedStateView(audience: "admin")
                    .blyssContainerBackground(BlyssWidgetPalette.background)
            case .granted(let payload):
                GrowthWidgetView(payload: payload)
            }
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
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(BlyssWidgetMock.growth))
}

@available(iOS 17.0, *)
#Preview("Medium — Light", as: .systemMedium) {
    GrowthWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(BlyssWidgetMock.growth))
}
