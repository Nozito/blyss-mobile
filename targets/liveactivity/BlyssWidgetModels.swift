import WidgetKit
import Foundation

// MARK: - Generic timeline infrastructure
//
// Every Pro/Admin widget below shares the exact same TimelineProvider shape:
// one entry, refreshed on a fixed interval, built from a "current payload"
// closure. Factoring that out means each widget only ever has to describe
// *what* its payload is and how to render it — never how a TimelineProvider
// works. Swapping v1's mocked `currentPayload` for a real one (e.g. reading
// a shared App Group payload, the same way LiveRdvHomeWidget.swift already
// does for the Live Activity's next appointment) is a one-line change per
// widget, with no view or Widget declaration touched.

struct BlyssWidgetEntry<Payload>: TimelineEntry {
    let date: Date
    let payload: Payload
}

struct BlyssWidgetProvider<Payload>: TimelineProvider {
    let placeholderPayload: Payload
    let currentPayload: () -> Payload
    /// How often WidgetKit should ask for a fresh timeline. Mocked data
    /// doesn't change, but a short interval keeps the provider shaped
    /// exactly like it'll need to be once `currentPayload` reads live data.
    let refreshMinutes: Int

    func placeholder(in context: Context) -> BlyssWidgetEntry<Payload> {
        BlyssWidgetEntry(date: Date(), payload: placeholderPayload)
    }

    func getSnapshot(in context: Context, completion: @escaping (BlyssWidgetEntry<Payload>) -> Void) {
        completion(BlyssWidgetEntry(date: Date(), payload: currentPayload()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BlyssWidgetEntry<Payload>>) -> Void) {
        let entry = BlyssWidgetEntry(date: Date(), payload: currentPayload())
        let next = Calendar.current.date(byAdding: .minute, value: refreshMinutes, to: Date())
            ?? Date().addingTimeInterval(TimeInterval(refreshMinutes * 60))
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Pro payloads

struct NextAppointmentPayload: Codable {
    let clientFullName: String
    let prestationName: String
    let durationMinutes: Int
    let startAt: Date
}

enum DaySummaryState {
    case scheduled(count: Int, nextTime: Date, inProgressCount: Int)
    case free
    case finished(completedCount: Int)
}

struct DaySummaryPayload {
    let state: DaySummaryState
}

struct RevenuePayload: Codable {
    let monthAmountEuros: Int
    let growthPercent: Double
    let objectiveAmountEuros: Int?
}

// MARK: - Admin payloads
//
// None of these ever carry a client or pro name — Admin widgets are
// aggregate-only by design (see PlatformOverviewWidgetView / AlertsWidgetView
// / GrowthWidgetView: every field below is a count, an amount, or a rate).

struct PlatformOverviewPayload: Codable {
    let activePros: Int
    let reservations: Int
    let growthPercent: Double
}

struct AlertsPayload: Codable {
    let paymentsToVerify: Int
    let accountsToReview: Int
    let criticalIncidents: Int

    var isAllClear: Bool {
        paymentsToVerify == 0 && accountsToReview == 0 && criticalIncidents == 0
    }
}

struct GrowthPayload: Codable {
    let todayAmountEuros: Int
    let weekAmountEuros: Int
    let growthPercent: Double
}

// MARK: - Live data (shared App Group)
//
// Same App Group + UserDefaults pattern LiveRdvHomeWidget.swift already uses
// for the Live Activity's next appointment (group.blyss.app), extended to
// carry a snapshot for all 6 Pro/Admin widgets. The app writes this blob
// (merging in whichever piece it just fetched — dashboard, finance stats,
// admin analytics...) via LiveActivityModule.writeWidgetSnapshot, then
// reloads the relevant widget kind's timeline. `DaySummaryPayload` isn't
// Codable itself (its `state` is an enum with associated values), so it
// round-trips through `DaySummarySnapshot` instead.
private let widgetSnapshotAppGroupId = "group.blyss.app"
private let widgetSnapshotKey = "widgetSnapshot"

struct DaySummarySnapshot: Codable {
    let state: String // "scheduled" | "free" | "finished"
    let count: Int?
    let nextTime: Date?
    let inProgressCount: Int?
    let completedCount: Int?

    var payload: DaySummaryPayload? {
        switch state {
        case "scheduled":
            guard let count, let nextTime, let inProgressCount else { return nil }
            return DaySummaryPayload(state: .scheduled(count: count, nextTime: nextTime, inProgressCount: inProgressCount))
        case "free":
            return DaySummaryPayload(state: .free)
        case "finished":
            guard let completedCount else { return nil }
            return DaySummaryPayload(state: .finished(completedCount: completedCount))
        default:
            return nil
        }
    }
}

struct WidgetSnapshot: Codable {
    let nextAppointment: NextAppointmentPayload?
    let daySummary: DaySummarySnapshot?
    let revenue: RevenuePayload?
    let platformOverview: PlatformOverviewPayload?
    let alerts: AlertsPayload?
    let growth: GrowthPayload?
}

enum WidgetSnapshotStore {
    // Mirrors LiveActivityModule.swift's isoFormatter() — the JS side writes
    // dates via `Date.toISOString()`, which always includes milliseconds.
    private static func isoFormatter() -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }

    static func read() -> WidgetSnapshot? {
        guard
            let defaults = UserDefaults(suiteName: widgetSnapshotAppGroupId),
            let data = defaults.data(forKey: widgetSnapshotKey)
        else { return nil }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = isoFormatter().date(from: string) { return date }
            if let date = ISO8601DateFormatter().date(from: string) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO 8601 date: \(string)")
        }
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }
}

// MARK: - Mock data (v1) — also the source for every #Preview below

enum BlyssWidgetMock {
    static let nextAppointment = NextAppointmentPayload(
        clientFullName: "Camille Martin",
        prestationName: "Pose gel",
        durationMinutes: 45,
        startAt: Calendar.current.date(bySettingHour: 15, minute: 30, second: 0, of: Date()) ?? Date()
    )

    static let daySummaryScheduled = DaySummaryPayload(
        state: .scheduled(
            count: 3,
            nextTime: Calendar.current.date(bySettingHour: 15, minute: 30, second: 0, of: Date()) ?? Date(),
            inProgressCount: 1
        )
    )
    static let daySummaryFree = DaySummaryPayload(state: .free)
    static let daySummaryFinished = DaySummaryPayload(state: .finished(completedCount: 3))

    static let revenue = RevenuePayload(monthAmountEuros: 2_840, growthPercent: 12, objectiveAmountEuros: 3_500)

    static let platformOverview = PlatformOverviewPayload(activePros: 128, reservations: 486, growthPercent: 8.4)

    static let alertsPending = AlertsPayload(paymentsToVerify: 2, accountsToReview: 1, criticalIncidents: 0)
    static let alertsCritical = AlertsPayload(paymentsToVerify: 0, accountsToReview: 0, criticalIncidents: 1)
    static let alertsClear = AlertsPayload(paymentsToVerify: 0, accountsToReview: 0, criticalIncidents: 0)

    static let growth = GrowthPayload(todayAmountEuros: 12_480, weekAmountEuros: 76_420, growthPercent: 9.2)
}
