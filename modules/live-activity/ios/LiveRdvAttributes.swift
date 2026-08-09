import ActivityKit
import Foundation

// Duplicate of targets/liveactivity/LiveRdvAttributes.swift — ActivityAttributes
// must be compiled into BOTH the main app target (to call Activity.request)
// and the Widget Extension target (to render), and @bacons/apple-targets has
// no shared-file mechanism across targets. Keep these two files identical.
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
