import WidgetKit
import SwiftUI

/// Widget secondaire (Admin) — "À TRAITER". No aggressive red, no anxious
/// badge — a single hero total (same language as every other widget in the
/// suite) plus a condensed breakdown, rather than a stacked list of lines.
struct AlertsWidgetView: View {
    let payload: AlertsPayload

    private var total: Int {
        payload.paymentsToVerify + payload.accountsToReview + payload.criticalIncidents
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "À traiter")
            Spacer(minLength: 2)
            if payload.isAllClear {
                Text("Tout est à jour")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BlyssWidgetPalette.textPrimary)
                    .lineLimit(1)
            } else {
                pending
            }
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .blyssContainerBackground(BlyssWidgetPalette.background)
        .widgetURL(URL(string: "blyss://(admin)/dashboard"))
    }

    private var pending: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(total)")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.accent)
                .lineLimit(1)
            Text("à traiter")
                .font(.system(size: 12))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)

            if !breakdown.isEmpty {
                Text(breakdown)
                    .font(.system(size: 11.5))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .padding(.top, 2)
            }
            if payload.criticalIncidents > 0 {
                Text("\(payload.criticalIncidents) incident\(payload.criticalIncidents > 1 ? "s" : "") critique\(payload.criticalIncidents > 1 ? "s" : "")")
                    .font(.system(size: 11.5, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
        }
    }

    /// "2 paiements · 1 compte" — condensed onto a single line, short nouns
    /// only (no "à vérifier"/"à examiner" suffixes: there's no room for them
    /// once both categories are present, and the eyebrow already says "À
    /// traiter" so the intent is clear without repeating it per line).
    private var breakdown: String {
        var parts: [String] = []
        if payload.paymentsToVerify > 0 {
            parts.append("\(payload.paymentsToVerify) paiement\(payload.paymentsToVerify > 1 ? "s" : "")")
        }
        if payload.accountsToReview > 0 {
            parts.append("\(payload.accountsToReview) compte\(payload.accountsToReview > 1 ? "s" : "")")
        }
        return parts.joined(separator: " · ")
    }
}

struct AlertsWidget: Widget {
    let kind = "AlertsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider(
                placeholderPayload: BlyssWidgetMock.alertsPending,
                currentPayload: { WidgetSnapshotStore.read()?.alerts ?? BlyssWidgetMock.alertsPending },
                refreshMinutes: 15
            )
        ) { entry in
            AlertsWidgetView(payload: entry.payload)
        }
        .configurationDisplayName("À traiter")
        .description("Paiements, comptes et incidents qui attendent une action.")
        .supportedFamilies([.systemSmall])
    }
}

@available(iOS 17.0, *)
#Preview("Pending — Light", as: .systemSmall) {
    AlertsWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.alertsPending)
}

@available(iOS 17.0, *)
#Preview("Critical incident", as: .systemSmall) {
    AlertsWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.alertsCritical)
}

@available(iOS 17.0, *)
#Preview("All clear", as: .systemSmall) {
    AlertsWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.alertsClear)
}
