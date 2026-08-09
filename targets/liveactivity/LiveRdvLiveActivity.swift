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
                    BlyssLogoMark(height: LiveActivityLogoSize.dynamicIslandExpanded)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(phase.headerLabel)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.6))
                        if context.state.showTime {
                            Text(context.state.startAt, style: .time)
                                .font(.caption.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        LiveRdvFocalName(phase: phase, clientFirstName: context.state.clientFirstName)
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        if let detail = LiveRdvDetailText.make(
                            prestationName: context.state.prestationName,
                            durationMinutes: context.state.durationMinutes
                        ) {
                            Text(detail)
                                .font(.caption2)
                                .foregroundStyle(.white.opacity(0.7))
                                .lineLimit(1)
                        }
                    }
                }
            } compactLeading: {
                BlyssLogoMark(height: LiveActivityLogoSize.compact)
            } compactTrailing: {
                LiveRdvCountdownText(state: context.state)
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(Color("$accent"))
            } minimal: {
                BlyssLogoMark(height: LiveActivityLogoSize.compact)
            }
            .keylineTint(Color("$accent"))
        }
    }
}

// ── Logo ─────────────────────────────────────────────────────────────────

/// Every placement's logo height in one place, tuned by context: the lock
/// screen header carries the most visual weight since it's the largest,
/// least crowded moment; the Dynamic Island's expanded view sits close
/// behind it; the compact/minimal pill is the smallest by necessity.
/// Shared (not private) — LiveRdvHomeWidget.swift reuses the same sizing
/// scale and logo view for its own header.
enum LiveActivityLogoSize {
    static let compact: CGFloat = 14
    static let homeWidget: CGFloat = 16
    static let lockScreenHeader: CGFloat = 20
    static let dynamicIslandExpanded: CGFloat = 18
}

/// The official Blyss mark ("blyssLogo" — a full-color gradient asset, not a
/// template glyph), scaled by height only so its native proportions are
/// always preserved.
struct BlyssLogoMark: View {
    let height: CGFloat

    var body: some View {
        Image("blyssLogo")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(height: height)
    }
}

// ── Phase ────────────────────────────────────────────────────────────────

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
}

extension LiveRdvPhase: Equatable {}

extension LiveRdvAttributes.ContentState {
    var durationMinutes: Int {
        Int(endAt.timeIntervalSince(startAt) / 60)
    }
}

/// "Prestation · 45 min" — shared between the lock screen's secondary line
/// and the Dynamic Island's expanded center, so the formatting never drifts
/// between the two surfaces.
private enum LiveRdvDetailText {
    static func make(prestationName: String?, durationMinutes: Int) -> String? {
        switch (prestationName, durationMinutes > 0) {
        case let (name?, true): return "\(name) · \(durationMinutes) min"
        case let (name?, false): return name
        case (nil, true): return "\(durationMinutes) min"
        case (nil, false): return nil
        }
    }
}

/// The client's name — or the phase-appropriate fallback once the
/// appointment has ended — shared by the lock screen's primary line and the
/// Dynamic Island's expanded center.
private struct LiveRdvFocalName: View {
    let phase: LiveRdvPhase
    let clientFirstName: String?

    var body: some View {
        Text(phase == .ended ? "Rendez-vous terminé" : (clientFirstName ?? "Rendez-vous"))
    }
}

// ── Lock screen ──────────────────────────────────────────────────────────

private struct LiveRdvLockScreenView: View {
    let context: ActivityViewContext<LiveRdvAttributes>

    private var phase: LiveRdvPhase { LiveRdvPhase(state: context.state) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            LiveRdvHeaderRow(
                phase: phase,
                startAt: context.state.startAt,
                showTime: context.state.showTime
            )
            LiveRdvFocalName(phase: phase, clientFirstName: context.state.clientFirstName)
                .font(.title2.weight(.bold))
                .foregroundStyle(Color("$accent"))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            if phase != .ended,
               let detail = LiveRdvDetailText.make(
                   prestationName: context.state.prestationName,
                   durationMinutes: context.state.durationMinutes
               ) {
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
            }
        }
        .padding(16)
    }
}

/// Level 3 — header: logo, phase status, and time. Small and quiet — never
/// the focal point — but the logo here carries the most weight of any of its
/// placements since this is the widest, least crowded row in the activity.
private struct LiveRdvHeaderRow: View {
    let phase: LiveRdvPhase
    let startAt: Date
    let showTime: Bool

    var body: some View {
        HStack(spacing: 8) {
            BlyssLogoMark(height: LiveActivityLogoSize.lockScreenHeader)
            Text(phase.headerLabel)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.6))
            Spacer(minLength: 8)
            if showTime, phase != .ended {
                Text(startAt, style: .time)
                    .font(.caption2.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
    }
}

// ── Countdown ────────────────────────────────────────────────────────────

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
