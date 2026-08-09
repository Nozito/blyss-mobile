import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.2, *)
struct LiveRdvLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: LiveRdvAttributes.self) { context in
            LiveRdvLockScreenView(context: context)
                // Fixed black, regardless of system light/dark — per design spec
                // the card must always read as a black Live Activity, unlike the
                // Home Screen widget which follows the app's theme.
                .activityBackgroundTint(.black)
                .activitySystemActionForegroundColor(.white)
                .widgetURL(LiveRdvDeepLink.url(reservationId: context.attributes.reservationId, startAt: context.state.startAt))
        } dynamicIsland: { context in
            let phase = LiveRdvPhase(state: context.state)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: phase.symbolName)
                        .foregroundStyle(Color("$accent"))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.state.showTime {
                        Text(context.state.startAt, style: .time)
                            .font(.caption)
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(phase.headline(state: context.state))
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        if let prestation = context.state.prestationName {
                            Text(prestation)
                                .font(.caption2)
                                .foregroundStyle(.white.opacity(0.7))
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let name = context.state.clientFirstName {
                        Text("Cliente : \(name)")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
            } compactLeading: {
                Image(systemName: phase.symbolName)
                    .foregroundStyle(Color("$accent"))
            } compactTrailing: {
                LiveRdvCountdownText(state: context.state)
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(Color("$accent"))
            } minimal: {
                Image(systemName: phase.symbolName)
                    .foregroundStyle(Color("$accent"))
            }
            .keylineTint(Color("$accent"))
        }
    }
}

/// Single source of truth for which of the three (non-overlapping) states the
/// activity is in, so the header label and the focal line never contradict
/// each other (e.g. never show "Prochain" next to "Terminé").
private enum LiveRdvPhase {
    case upcoming
    case inProgress
    case ended

    init(state: LiveRdvAttributes.ContentState) {
        let now = Date()
        if now >= state.endAt {
            self = .ended
        } else if now >= state.startAt {
            self = .inProgress
        } else {
            self = .upcoming
        }
    }

    var headerLabel: String {
        switch self {
        case .upcoming: return "Prochain"
        case .inProgress: return "En cours"
        case .ended: return "Terminé"
        }
    }

    var symbolName: String {
        switch self {
        case .upcoming: return "calendar"
        case .inProgress: return "clock.fill"
        case .ended: return "checkmark.circle.fill"
        }
    }

    func headline(state: LiveRdvAttributes.ContentState) -> String {
        switch self {
        case .upcoming, .inProgress:
            return state.clientFirstName ?? "Rendez-vous"
        case .ended:
            return "Rendez-vous terminé"
        }
    }
}

private struct LiveRdvLockScreenView: View {
    let context: ActivityViewContext<LiveRdvAttributes>

    private var phase: LiveRdvPhase { LiveRdvPhase(state: context.state) }

    private var durationMinutes: Int {
        Int(context.state.endAt.timeIntervalSince(context.state.startAt) / 60)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Level 3 — header: logo + phase label, small, never the focal point.
            HStack(spacing: 5) {
                Image(systemName: "sparkles")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color("$accent"))
                Text("Blyss")
                    .font(.system(.caption2, design: .serif).weight(.bold).italic())
                Text("· \(phase.headerLabel)")
                    .font(.caption2)
            }
            .foregroundStyle(.white.opacity(0.6))

            // Level 1 — the single focal point: qui + quand.
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                if let name = context.state.clientFirstName, phase != .ended {
                    Text(name)
                } else if phase == .ended {
                    Text("Rendez-vous terminé")
                }
                if context.state.showTime, phase != .ended {
                    Text(context.state.startAt, style: .time)
                }
            }
            .font(.title2.weight(.bold))
            .foregroundStyle(Color("$accent"))
            .lineLimit(1)
            .minimumScaleFactor(0.8)

            // Level 2 — quoi: prestation + duration.
            if phase != .ended, (context.state.prestationName != nil || durationMinutes > 0) {
                HStack(spacing: 4) {
                    if let prestation = context.state.prestationName {
                        Text(prestation)
                    }
                    if durationMinutes > 0 {
                        if context.state.prestationName != nil { Text("·") }
                        Text("\(durationMinutes) min")
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
                .lineLimit(1)
            }
        }
        .padding(16)
    }
}

extension LiveRdvPhase: Equatable {}

/// Native auto-updating countdown — no polling, the system re-renders this
/// every second on its own via Text(timerInterval:).
private struct LiveRdvCountdownText: View {
    let state: LiveRdvAttributes.ContentState

    var body: some View {
        let now = Date()
        if state.startAt > now {
            Text(timerInterval: now...state.startAt, countsDown: true)
        } else if state.endAt > now {
            Text("En cours")
        } else {
            Text("Terminé")
        }
    }
}
