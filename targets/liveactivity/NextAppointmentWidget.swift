import WidgetKit
import SwiftUI

/// Widget principal (Pro) — "PROCHAIN RENDEZ-VOUS". The client's name is the
/// focal point, the time must be readable at a glance, the prestation stays
/// secondary — same hierarchy in every family, just laid out differently.
struct NextAppointmentWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let payload: NextAppointmentPayload?

    var body: some View {
        Group {
            if let payload {
                switch family {
                case .accessoryCircular:
                    circular(payload)
                case .accessoryRectangular:
                    rectangular(payload)
                case .systemMedium:
                    medium(payload)
                default:
                    small(payload)
                }
            } else {
                WidgetEmptyStateView(
                    systemImage: "calendar",
                    title: "Aucun rendez-vous",
                    subtitle: family == .systemSmall || family == .systemMedium ? "à venir" : nil
                )
            }
        }
        .blyssContainerBackground(family == .accessoryCircular || family == .accessoryRectangular ? Color.clear : BlyssWidgetPalette.background)
        .widgetURL(URL(string: "blyss://calendar"))
    }

    private func small(_ p: NextAppointmentPayload) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            WidgetHeaderView(label: "Prochain rendez-vous")
            Spacer(minLength: 2)
            Text(p.clientFullName)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text("\(p.prestationName) · \(p.durationMinutes) min")
                .font(.system(size: 12))
                .foregroundStyle(BlyssWidgetPalette.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 2)
            Text(p.startAt, style: .time)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(BlyssWidgetPalette.accent)
                .lineLimit(1)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func medium(_ p: NextAppointmentPayload) -> some View {
        HStack(alignment: .center, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                WidgetHeaderView(label: "Prochain rendez-vous")
                Text(p.clientFullName)
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text("\(p.prestationName) · \(p.durationMinutes) min")
                    .font(.system(size: 13))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            WidgetVerticalDivider().padding(.vertical, 4)
            VStack(spacing: 3) {
                Text(p.startAt, style: .time)
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(BlyssWidgetPalette.accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(BlyssRelativeTime.until(p.startAt))
                    .font(.system(size: 11))
                    .foregroundStyle(BlyssWidgetPalette.textSecondary)
                    .lineLimit(1)
            }
            .padding(.leading, 16)
        }
        .padding(16)
    }

    private func rectangular(_ p: NextAppointmentPayload) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(p.clientFullName)
                .font(.headline)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text("\(p.prestationName) · \(p.startAt.formatted(date: .omitted, time: .shortened))")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    // accessoryCircular is deliberately time-only per the brief — the name
    // and prestation don't fit legibly at that size, and trying to cram
    // them in would defeat "compréhensible en moins d'une seconde".
    private func circular(_ p: NextAppointmentPayload) -> some View {
        Text(p.startAt, style: .time)
            .font(.system(size: 15, weight: .semibold))
            .minimumScaleFactor(0.7)
            .lineLimit(1)
    }
}

struct NextAppointmentWidget: Widget {
    let kind = "NextAppointmentWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            // Payload is Optional so the "no upcoming appointment" state can
            // be represented (and previewed) through the same widget/entry
            // type rather than a second parallel Widget declaration.
            provider: BlyssWidgetProvider<WidgetAccess<NextAppointmentPayload?>>(
                placeholderPayload: .granted(BlyssWidgetMock.nextAppointment),
                // `nil` is a real, meaningful state here ("no upcoming RDV"),
                // not a stand-in for "no data yet" — only fall back to mock
                // when the snapshot has never been written at all, not just
                // when its `nextAppointment` field happens to be nil.
                currentPayload: {
                    guard WidgetSnapshotStore.hasProAccess() else { return .locked }
                    guard let snapshot = WidgetSnapshotStore.read() else { return .granted(BlyssWidgetMock.nextAppointment) }
                    return .granted(snapshot.nextAppointment)
                },
                refreshMinutes: 15
            )
        ) { entry in
            switch entry.payload {
            case .locked:
                WidgetLockedStateView(audience: "pro")
                    .blyssContainerBackground(BlyssWidgetPalette.background)
            case .granted(let payload):
                NextAppointmentWidgetView(payload: payload)
            }
        }
        .configurationDisplayName("Prochain rendez-vous")
        .description("Le nom de ta cliente, la prestation et l'heure de ton prochain rendez-vous.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

@available(iOS 17.0, *)
#Preview("Small — Light", as: .systemSmall) {
    NextAppointmentWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(BlyssWidgetMock.nextAppointment))
}

@available(iOS 17.0, *)
#Preview("Medium — Light", as: .systemMedium) {
    NextAppointmentWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(BlyssWidgetMock.nextAppointment))
}

@available(iOS 17.0, *)
#Preview("Circular", as: .accessoryCircular) {
    NextAppointmentWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(BlyssWidgetMock.nextAppointment))
}

@available(iOS 17.0, *)
#Preview("Rectangular", as: .accessoryRectangular) {
    NextAppointmentWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(BlyssWidgetMock.nextAppointment))
}

@available(iOS 17.0, *)
#Preview("Small — Empty", as: .systemSmall) {
    NextAppointmentWidget()
} timeline: {
    BlyssWidgetEntry(date: .now, payload: WidgetAccess.granted(Optional<NextAppointmentPayload>.none))
}
