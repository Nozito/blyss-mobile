import WidgetKit
import SwiftUI

/// Widget avancé (Pro) — "CHIFFRE D'AFFAIRES". One strong number, one trend,
/// one optional objective — no chart in this first version.
struct RevenueWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: RevenuePayload

    private var objectiveProgress: Double? {
        guard let objective = payload.objectiveAmountEuros, objective > 0 else { return nil }
        return Double(payload.monthAmountEuros) / Double(objective)
    }

    var body: some View {
        Group {
            if family == .systemMedium, let objective = payload.objectiveAmountEuros {
                mediumWithObjective(objective)
            } else {
                small
            }
        }
        .background(BlyssWidgetPalette.background)
        .widgetURL(URL(string: "blyss://finance"))
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "Chiffre d'affaires")
            Spacer(minLength: 2)
            Text(BlyssEuroFormat.string(from: payload.monthAmountEuros))
                .font(.system(size: family == .systemSmall ? 24 : 30, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.accent)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            growthLine
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func mediumWithObjective(_ objective: Int) -> some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                WidgetHeaderView(label: "Chiffre d'affaires")
                Text(BlyssEuroFormat.string(from: payload.monthAmountEuros))
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                growthLine
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            WidgetVerticalDivider().padding(.vertical, 4)

            VStack(alignment: .leading, spacing: 6) {
                Text("Objectif")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                Text(BlyssEuroFormat.string(from: objective))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                WidgetProgressBar(progress: objectiveProgress ?? 0)
                Text("\(Int(((objectiveProgress ?? 0) * 100).rounded()))% atteint")
                    .font(.system(size: 10.5))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
            }
            .frame(width: 128, alignment: .leading)
            .padding(.leading, 16)
        }
        .padding(16)
    }

    private var growthLine: some View {
        HStack(spacing: 4) {
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10, weight: .bold))
            Text("\(BlyssPercentFormat.string(from: payload.growthPercent)) vs mois dernier")
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(BlyssWidgetPalette.textSecondary)
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
