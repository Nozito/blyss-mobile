import ActivityKit
import Foundation

/// Shared shape with the JS side (see modules/live-activity/LiveActivityModule.swift
/// and the backend's live-activity routes/apns.ts) — keep field names in sync.
struct LiveRdvAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startAt: Date
        var endAt: Date
        var prestationName: String?
        var clientFirstName: String?
        var showTime: Bool
        var privacyLevel: String
    }

    var reservationId: Int
}
