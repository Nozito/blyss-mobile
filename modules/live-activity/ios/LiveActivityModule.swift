import ActivityKit
import ExpoModulesCore
import WidgetKit

private let appGroupId = "group.blyss.app"
private let sharedDefaultsKey = "nextAppointment"
private let homeWidgetKind = "LiveRdvHomeWidget"

// Mirrors LiveRdvHomeProvider's private decode shape in
// targets/liveactivity/LiveRdvHomeWidget.swift — keep in sync.
// Duplicate of targets/liveactivity/LiveRdvHomeWidget.swift's SharedNextAppointment
// — this struct is decoded/encoded across the app target and the Widget
// Extension target, and @bacons/apple-targets has no shared-file mechanism
// across targets (same constraint as LiveRdvAttributes). Keep these in sync.
private struct SharedNextAppointment: Codable {
    let startAt: Date
    let endAt: Date
    let prestationName: String?
    let clientFirstName: String?
    let showTime: Bool
}

public class LiveActivityModule: Module {
    private var pushToStartTokenTask: Task<Void, Never>?
    private var pushTokenTasks: [String: Task<Void, Never>] = [:]

    public func definition() -> ModuleDefinition {
        Name("LiveActivityModule")

        Events("onPushTokenChange", "onPushToStartTokenChange")

        OnCreate {
            if #available(iOS 17.2, *) {
                self.observePushToStartToken()
            }
        }

        OnDestroy {
            self.pushToStartTokenTask?.cancel()
            self.pushTokenTasks.values.forEach { $0.cancel() }
        }

        Function("isSupported") { () -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            return ActivityAuthorizationInfo().areActivitiesEnabled
        }

        AsyncFunction("startActivity") { (payload: [String: Any]) -> String? in
            guard #available(iOS 16.2, *) else { return nil }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
            guard
                let reservationId = payload["reservationId"] as? Int,
                let contentState = Self.decodeContentState(payload)
            else { return nil }

            // Only one Live RDV activity at a time.
            for existing in Activity<LiveRdvAttributes>.activities {
                await existing.end(nil, dismissalPolicy: .immediate)
            }

            let attributes = LiveRdvAttributes(reservationId: reservationId)
            do {
                let activity = try Activity<LiveRdvAttributes>.request(
                    attributes: attributes,
                    content: .init(state: contentState, staleDate: contentState.endAt),
                    pushType: .token
                )
                self.observePushToken(for: activity)
                return activity.id
            } catch {
                return nil
            }
        }

        AsyncFunction("updateActivity") { (payload: [String: Any]) in
            guard #available(iOS 16.2, *) else { return }
            guard let contentState = Self.decodeContentState(payload) else { return }
            for activity in Activity<LiveRdvAttributes>.activities {
                await activity.update(.init(state: contentState, staleDate: contentState.endAt))
            }
        }

        AsyncFunction("endActivity") {
            guard #available(iOS 16.2, *) else { return }
            for activity in Activity<LiveRdvAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }

        AsyncFunction("getActiveActivityId") { () -> String? in
            guard #available(iOS 16.2, *) else { return nil }
            return Activity<LiveRdvAttributes>.activities.first?.id
        }

        // Writes the next-appointment payload to the shared App Group so the
        // static Home Screen widget can render it even outside the Live
        // Activity's trigger window. Pass nil to clear it (no upcoming RDV).
        Function("writeSharedNextAppointment") { (payload: [String: Any]?) in
            Self.writeSharedDefaults(payload)
            WidgetCenter.shared.reloadTimelines(ofKind: homeWidgetKind)
        }
    }

    @available(iOS 17.2, *)
    private func observePushToStartToken() {
        pushToStartTokenTask = Task { [weak self] in
            for await data in Activity<LiveRdvAttributes>.pushToStartTokenUpdates {
                let token = data.map { String(format: "%02x", $0) }.joined()
                self?.sendEvent("onPushToStartTokenChange", ["token": token])
            }
        }
    }

    @available(iOS 16.2, *)
    private func observePushToken(for activity: Activity<LiveRdvAttributes>) {
        pushTokenTasks[activity.id]?.cancel()
        pushTokenTasks[activity.id] = Task { [weak self] in
            for await data in activity.pushTokenUpdates {
                let token = data.map { String(format: "%02x", $0) }.joined()
                self?.sendEvent("onPushTokenChange", ["activityId": activity.id, "token": token])
            }
        }
    }

    // Backend timestamps are ISO 8601 with milliseconds (e.g. "...T00:55:07.786Z").
    // Plain ISO8601DateFormatter() rejects the fractional-seconds component by
    // default and silently returns nil — withFractionalSeconds is required.
    private static func isoFormatter() -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }

    private static func decodeContentState(_ payload: [String: Any]) -> LiveRdvAttributes.ContentState? {
        guard
            let startAtStr = payload["startAt"] as? String,
            let endAtStr = payload["endAt"] as? String,
            let startAt = isoFormatter().date(from: startAtStr),
            let endAt = isoFormatter().date(from: endAtStr)
        else { return nil }

        return LiveRdvAttributes.ContentState(
            startAt: startAt,
            endAt: endAt,
            prestationName: payload["prestationName"] as? String,
            clientFirstName: payload["clientFirstName"] as? String,
            showTime: payload["showTime"] as? Bool ?? true,
            privacyLevel: payload["privacyLevel"] as? String ?? "full"
        )
    }

    private static func writeSharedDefaults(_ payload: [String: Any]?) {
        guard let defaults = UserDefaults(suiteName: appGroupId) else { return }
        guard let payload, let state = decodeContentState(payload) else {
            defaults.removeObject(forKey: sharedDefaultsKey)
            return
        }

        let shared = SharedNextAppointment(
            startAt: state.startAt,
            endAt: state.endAt,
            prestationName: state.prestationName,
            clientFirstName: state.clientFirstName,
            showTime: state.showTime
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(shared) {
            defaults.set(data, forKey: sharedDefaultsKey)
        }
    }
}
