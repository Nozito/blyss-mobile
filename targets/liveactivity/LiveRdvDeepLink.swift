import Foundation

enum LiveRdvDeepLink {
    /// Matches the universal-link path registered in app.config.ts
    /// (associatedDomains: applinks:blyssapp.fr) and Expo Router's
    /// `/calendar` route ((pro) is a routing group, not a URL segment).
    static func url(reservationId: Int, startAt: Date) -> URL? {
        var components = URLComponents(string: "blyss://calendar")
        let formatter = ISO8601DateFormatter()
        components?.queryItems = [
            URLQueryItem(name: "appointmentId", value: String(reservationId)),
            URLQueryItem(name: "date", value: formatter.string(from: startAt)),
        ]
        return components?.url
    }
}
