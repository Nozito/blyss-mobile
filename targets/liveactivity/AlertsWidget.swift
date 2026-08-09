import WidgetKit
import SwiftUI

/// Widget secondaire (Admin) — "À TRAITER". No aggressive red, no anxious
/// badge — typographic weight and system semantic colors are the only way
/// this widget distinguishes "needs attention" from "all clear".
struct AlertsWidgetView: View {
    let payload: AlertsPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeaderView(label: "À traiter")
            Spacer(minLength: 2)
            if payload.isAllClear {
                allClear
            } else {
                pending
            }
            Spacer(minLength: 2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "blyss://(admin)/dashboard"))
    }

    private var allClear: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 16))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
            Text("Tout est à jour")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
        }
    }

    private var pending: some View {
        VStack(alignment: .leading, spacing: 6) {
            if payload.paymentsToVerify > 0 {
                line(count: payload.paymentsToVerify, label: payload.paymentsToVerify > 1 ? "paiements à vérifier" : "paiement à vérifier")
            }
            if payload.accountsToReview > 0 {
                line(count: payload.accountsToReview, label: payload.accountsToReview > 1 ? "comptes à examiner" : "compte à examiner")
            }
            if payload.criticalIncidents > 0 {
                line(count: payload.criticalIncidents, label: payload.criticalIncidents > 1 ? "incidents critiques" : "incident critique", emphasized: true)
            } else {
                Text("Aucun incident critique")
                    .font(.system(size: 12))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
            }
        }
    }

    private func line(count: Int, label: String, emphasized: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text("\(count)")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(emphasized ? BlyssWidgetPalette.textPrimary : BlyssWidgetPalette.textSecondary)
            Text(label)
                .font(.system(size: 13, weight: emphasized ? .semibold : .regular))
                .foregroundStyle(emphasized ? BlyssWidgetPalette.textPrimary : BlyssWidgetPalette.textSecondary)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.85)
    }
}

struct AlertsWidget: Widget {
    let kind = "AlertsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: BlyssWidgetProvider(
                placeholderPayload: BlyssWidgetMock.alertsPending,
                currentPayload: { BlyssWidgetMock.alertsPending },
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
#Preview("All clear", as: .systemSmall) {
    AlertsWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: BlyssWidgetMock.alertsClear)
}
