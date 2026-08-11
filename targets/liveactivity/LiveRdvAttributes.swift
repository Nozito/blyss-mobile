import ActivityKit
import Foundation

/// Shared shape with the JS side (see modules/live-activity/LiveActivityModule.swift
/// and the backend's live-activity routes/apns.ts) — keep field names in sync.
///
/// Canonical copy. `modules/live-activity/ios/LiveRdvAttributes.swift` is a
/// symlink to this file (ActivityAttributes must compile into both the main
/// app target and the Widget Extension target, and @bacons/apple-targets has
/// no shared-file mechanism across targets — a symlink makes drift between
/// them impossible instead of relying on a "keep in sync" comment).
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
