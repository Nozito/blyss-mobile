import WidgetKit
import SwiftUI

/// Minimal shortcut widget — the official mark, nothing else. Reuses
/// BlyssLogoMark (LiveRdvLiveActivity.swift) rather than a second copy of
/// the same `Image("blyssLogo").resizable().aspectRatio(contentMode: .fit)`
/// — one real asset, one view, three surfaces (Live Activity, Lock Screen
/// widget below, Home Screen widget below).
typealias BlyssLogoView = BlyssLogoMark

private struct BlyssLogoWidgetEntry: TimelineEntry {
    let date: Date
}

private struct BlyssLogoWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> BlyssLogoWidgetEntry {
        BlyssLogoWidgetEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (BlyssLogoWidgetEntry) -> Void) {
        completion(BlyssLogoWidgetEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BlyssLogoWidgetEntry>) -> Void) {
        // Static content — no refresh needed until iOS reloads it (app
        // launch, day rollover).
        completion(Timeline(entries: [BlyssLogoWidgetEntry(date: Date())], policy: .never))
    }
}

struct BlyssLogoWidgetView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        // accessoryCircular (Lock Screen) is always rendered as a flat
        // system template regardless of the asset's own color — same
        // documented behavior as LiveRdvHomeWidget.swift's logo header.
        BlyssLogoView(height: family == .accessoryCircular ? 22 : 30)
            .padding(family == .accessoryCircular ? 10 : 22)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetURL(URL(string: "blyss://"))
    }
}

struct BlyssLogoWidget: Widget {
    let kind = "BlyssLogoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BlyssLogoWidgetProvider()) { _ in
            BlyssLogoWidgetView()
        }
        .configurationDisplayName("Blyss")
        .description("Un raccourci vers l'application Blyss.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

@available(iOS 17.0, *)
#Preview("Small — Light", as: .systemSmall) {
    BlyssLogoWidget()
} timeline: {
    BlyssLogoWidgetEntry(date: .now)
}

@available(iOS 17.0, *)
#Preview("Circular", as: .accessoryCircular) {
    BlyssLogoWidget()
} timeline: {
    BlyssLogoWidgetEntry(date: .now)
}
