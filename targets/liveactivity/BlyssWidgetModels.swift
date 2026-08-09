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

struct NextAppointmentPayload {
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

struct RevenuePayload {
    let monthAmountEuros: Int
    let growthPercent: Double
    let objectiveAmountEuros: Int?
}

// MARK: - Admin payloads
//
// None of these ever carry a client or pro name — Admin widgets are
// aggregate-only by design (see PlatformOverviewWidgetView / AlertsWidgetView
// / GrowthWidgetView: every field below is a count, an amount, or a rate).

struct PlatformOverviewPayload {
    let activePros: Int
    let reservations: Int
    let growthPercent: Double
}

struct AlertsPayload {
    let paymentsToVerify: Int
    let accountsToReview: Int
    let criticalIncidents: Int

    var isAllClear: Bool {
        paymentsToVerify == 0 && accountsToReview == 0 && criticalIncidents == 0
    }
}

struct GrowthPayload {
    let todayAmountEuros: Int
    let weekAmountEuros: Int
    let growthPercent: Double
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
    static let alertsClear = AlertsPayload(paymentsToVerify: 0, accountsToReview: 0, criticalIncidents: 0)

    static let growth = GrowthPayload(todayAmountEuros: 12_480, weekAmountEuros: 76_420, growthPercent: 9.2)
}
