import WidgetKit
import SwiftUI

/// Complementary static widget — visible on the Home Screen (and Lock
/// Screen via .accessoryRectangular) even outside the Live Activity's
/// trigger window (e.g. "demain à 10h30"), refreshed by timeline reload
/// rather than a per-second countdown. Reads the payload the app/native
/// module writes to the shared App Group whenever it fetches the pro's
/// next appointment.
private let appGroupId = "group.blyss.app"
private let sharedDefaultsKey = "nextAppointment"

// Duplicate of modules/live-activity/ios/LiveActivityModule.swift's
// SharedNextAppointment — this struct is decoded/encoded across the app
// target and the Widget Extension target, and @bacons/apple-targets has no
// shared-file mechanism across targets (same constraint as LiveRdvAttributes).
// Keep these in sync.
private struct SharedNextAppointment: Codable {
    let startAt: Date
    let endAt: Date
    let prestationName: String?
    let clientFirstName: String?
    let showTime: Bool
}

struct LiveRdvHomeEntry: TimelineEntry {
    let date: Date
    let startAt: Date?
    let endAt: Date?
    let prestationName: String?
    let clientFirstName: String?
    let showTime: Bool
}

struct LiveRdvHomeProvider: TimelineProvider {
    func placeholder(in context: Context) -> LiveRdvHomeEntry {
        LiveRdvHomeEntry(date: Date(), startAt: nil, endAt: nil, prestationName: nil, clientFirstName: nil, showTime: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (LiveRdvHomeEntry) -> Void) {
        completion(Self.readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LiveRdvHomeEntry>) -> Void) {
        let entry = Self.readEntry()
        // No per-second decoding needed here (unlike the Live Activity):
        // a periodic timeline reload is enough for a "demain à 10h30" style
        // display. The app also force-reloads this widget's timeline after
        // every next-appointment fetch (WidgetCenter.reloadTimelines).
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 20, to: Date()) ?? Date().addingTimeInterval(1200)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }

    static func readEntry() -> LiveRdvHomeEntry {
        guard
            let defaults = UserDefaults(suiteName: appGroupId),
            let data = defaults.data(forKey: sharedDefaultsKey)
        else {
            return LiveRdvHomeEntry(date: Date(), startAt: nil, endAt: nil, prestationName: nil, clientFirstName: nil, showTime: true)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let shared = try? decoder.decode(SharedNextAppointment.self, from: data) else {
            return LiveRdvHomeEntry(date: Date(), startAt: nil, endAt: nil, prestationName: nil, clientFirstName: nil, showTime: true)
        }

        return LiveRdvHomeEntry(
            date: Date(),
            startAt: shared.startAt,
            endAt: shared.endAt,
            prestationName: shared.prestationName,
            clientFirstName: shared.clientFirstName,
            showTime: shared.showTime
        )
    }
}

struct LiveRdvHomeWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: LiveRdvHomeProvider.Entry

    var body: some View {
        Group {
            if let startAt = entry.startAt, startAt > Date() {
                VStack(alignment: .leading, spacing: 4) {
                    // accessoryRectangular is always rendered by the system as a
                    // flat template (no color), so the gradient mark reduces to a
                    // plain glyph there — expected, matches every other accessory
                    // widget on the Lock Screen.
                    BlyssLogoMark(height: LiveActivityLogoSize.homeWidget)
                    Text(startAt, style: .relative)
                        .font(.headline)
                        .foregroundStyle(family == .accessoryRectangular ? .primary : Color("AccentColor"))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    if entry.showTime {
                        Text(startAt, style: .time)
                            .font(.caption)
                            .foregroundStyle(family == .accessoryRectangular ? .secondary : Color("blyssForeground"))
                    }
                    if let name = entry.clientFirstName {
                        Text(name)
                            .font(.caption)
                            .foregroundStyle(family == .accessoryRectangular ? .secondary : Color("blyssMuted"))
                            .lineLimit(1)
                    }
                }
                .padding(family == .accessoryRectangular ? 0 : 16)
                .widgetURL(URL(string: "blyss://calendar"))
            } else {
                VStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .foregroundStyle(family == .accessoryRectangular ? .secondary : Color("blyssMuted"))
                    Text("Aucun RDV à venir")
                        .font(.caption2)
                        .foregroundStyle(family == .accessoryRectangular ? .secondary : Color("blyssMuted"))
                }
                .padding(family == .accessoryRectangular ? 0 : 16)
            }
        }
        .background(family == .accessoryRectangular ? Color.clear : Color("blyssCard"))
    }
}

struct LiveRdvHomeWidget: Widget {
    let kind: String = "LiveRdvHomeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LiveRdvHomeProvider()) { entry in
            LiveRdvHomeWidgetView(entry: entry)
        }
        .configurationDisplayName("Prochain RDV")
        .description("Affiche ton prochain rendez-vous confirmé, même longtemps à l'avance.")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}
