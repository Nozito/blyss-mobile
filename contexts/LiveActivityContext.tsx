import React, { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import { useRevenueCat } from "./RevenueCatContext";
import { useNotifications } from "./NotificationContext";
import { proApi } from "@/lib/api";
import {
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  writeSharedNextAppointment,
  addPushTokenListener,
  addPushToStartTokenListener,
  type LiveRdvStartPayload,
} from "live-activity";
import { syncNextAppointmentWidget } from "@/lib/widgetSync";

// Live Activity starts this far before the appointment — aligned with the
// existing H-2 reminder window (backend/lib/reminders.ts) but wider, since
// ActivityKit activities are meant for imminent events, not a full day out.
const TRIGGER_WINDOW_MS = 3 * 60 * 60 * 1000;
// How often to refresh while the app is foregrounded — keeps the shared
// widget payload and the trigger-window check current without polling hard.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
// "new_booking" included so a freshly confirmed reservation reflects in the
// activity immediately instead of waiting for the next poll — see
// NotificationContext.tsx:231 for the same literal used at runtime.
const MUTATION_NOTIF_TYPES = new Set(["booking_cancelled", "booking_rescheduled", "new_booking"]);

interface LiveActivityContextType {
  isSupported: boolean;
  /**
   * Forces an immediate re-check of the next appointment. Call this right
   * after a pro cancels/completes/reschedules their own reservation — the
   * backend only notifies the *client* over WS for that mutation (see
   * PATCH /api/pro/reservations/:id/status), so the pro's own foreground
   * fast-path (which watches incoming notifications) never fires for their
   * own action. Without this, teardown would wait for the 5-minute poll.
   */
  refreshNow: () => void;
}

const LiveActivityContext = createContext<LiveActivityContextType>({
  isSupported: false,
  refreshNow: () => {},
});

export function LiveActivityProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { activePlan, isReady: rcReady } = useRevenueCat();
  const { notifications } = useNotifications();

  const isAdmin = user?.is_admin ?? false;
  const hasActiveSub = isAdmin || Boolean(activePlan);
  const isEligiblePro = Platform.OS === "ios" && isAuthenticated && user?.role === "pro" && rcReady && hasActiveSub;

  const activeAppointmentIdRef = useRef<number | null>(null);
  const activeActivityIdRef = useRef<string | null>(null);
  const lastNotifIdRef = useRef<number | null>(null);
  // Coalesces overlapping triggers (poll tick, WS fast-path, refreshNow(),
  // AppState resume can all fire close together) into a single in-flight
  // request, queuing at most one more run rather than letting two calls
  // race on activeAppointmentIdRef/activeActivityIdRef concurrently.
  const isRefreshingRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const doRefresh = async () => {
    const res = await proApi.getLiveActivityNextAppointment();
    if (!res.success) return;
    const next = res.data;

    if (!next) {
      writeSharedNextAppointment(null);
      syncNextAppointmentWidget(null);
      if (activeActivityIdRef.current) {
        await endLiveActivity();
        await proApi.unregisterLiveActivityTokens(activeActivityIdRef.current);
        activeActivityIdRef.current = null;
        activeAppointmentIdRef.current = null;
      }
      return;
    }

    const payload: LiveRdvStartPayload = {
      reservationId: next.appointmentId,
      startAt: next.startAt,
      endAt: next.endAt,
      prestationName: next.prestationName,
      clientFirstName: next.clientFirstName,
      showTime: next.showTime,
      privacyLevel: next.privacyLevel,
    };

    // Feed the static Home Screen widget regardless of the trigger window —
    // it's meant to be useful even for "demain à 10h30".
    writeSharedNextAppointment(payload);
    syncNextAppointmentWidget(next);

    const msUntilStart = new Date(next.startAt).getTime() - Date.now();
    const inWindow = msUntilStart <= TRIGGER_WINDOW_MS;

    if (activeAppointmentIdRef.current === next.appointmentId) {
      if (activeActivityIdRef.current) {
        await updateLiveActivity(payload);
      } else if (inWindow && isLiveActivitySupported()) {
        // Same appointment re-entering scope after being out of window —
        // shouldn't normally happen (window only shrinks), but stay correct.
        const activityId = await startLiveActivity(payload);
        activeActivityIdRef.current = activityId;
      }
      return;
    }

    // Different (or first) appointment — end whatever was running, start
    // fresh only if we're inside the trigger window.
    if (activeActivityIdRef.current) {
      await endLiveActivity();
      await proApi.unregisterLiveActivityTokens(activeActivityIdRef.current);
      activeActivityIdRef.current = null;
    }
    activeAppointmentIdRef.current = next.appointmentId;

    if (inWindow && isLiveActivitySupported()) {
      const activityId = await startLiveActivity(payload);
      activeActivityIdRef.current = activityId;
    }
  };

  const refresh = async () => {
    if (isRefreshingRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    isRefreshingRef.current = true;
    try {
      await doRefresh();
    } finally {
      isRefreshingRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refresh();
      }
    }
  };

  // Initial fetch + periodic refresh while eligible.
  useEffect(() => {
    if (!isEligiblePro) return;
    refresh().catch(() => {});
    const interval = setInterval(() => refresh().catch(() => {}), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isEligiblePro]);

  // Foreground fast-path: a cancellation/reschedule notification just landed
  // over the existing WS channel (NotificationContext already parses it into
  // `notifications`) — refresh immediately instead of waiting for the next
  // 5-minute tick.
  useEffect(() => {
    if (!isEligiblePro) return;
    const latest = notifications[0];
    if (!latest || latest.id === lastNotifIdRef.current) return;
    lastNotifIdRef.current = latest.id;
    if (MUTATION_NOTIF_TYPES.has(latest.type)) {
      refresh().catch(() => {});
    }
  }, [isEligiblePro, notifications]);

  // Safety net against a "ghost" activity: the 5-minute poll only runs while
  // the app is foregrounded, so if the pro closes the app after their last
  // appointment and doesn't reopen it, nothing client-side ever calls
  // endLiveActivity() — the activity can be left showing indefinitely until
  // an (unauditable, backend-side) push arrives or iOS expires it on its own
  // schedule. Forcing a refresh every time the app becomes active guarantees
  // a sync point regardless of how long it was backgrounded/killed for.
  useEffect(() => {
    if (!isEligiblePro) return;
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === "active") refresh().catch(() => {});
    };
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  }, [isEligiblePro]);

  // Push token registration — lets the server start/update/end the activity
  // remotely (app killed), independent of the foreground WS fast-path above.
  useEffect(() => {
    if (!isEligiblePro) return;
    const startSub = addPushToStartTokenListener(({ token }) => {
      proApi.registerLiveActivityToken({ kind: "start", token }).catch(() => {});
    });
    const updateSub = addPushTokenListener(({ activityId, token }) => {
      if (activeAppointmentIdRef.current == null) return;
      proApi
        .registerLiveActivityToken({
          kind: "update",
          token,
          activityId,
          reservationId: activeAppointmentIdRef.current,
        })
        .catch(() => {});
    });
    return () => {
      startSub?.remove();
      updateSub?.remove();
    };
  }, [isEligiblePro]);

  // Teardown on logout / loss of pro access — the activity must not survive
  // past the point where (pro)/_layout.tsx would redirect to the paywall.
  useEffect(() => {
    if (isEligiblePro) return;
    endLiveActivity().catch(() => {});
    writeSharedNextAppointment(null);
    syncNextAppointmentWidget(null);
    if (isAuthenticated) {
      // Still logged in (e.g. subscription lost) — best-effort server cleanup.
      proApi.unregisterLiveActivityTokens().catch(() => {});
    }
    activeActivityIdRef.current = null;
    activeAppointmentIdRef.current = null;
  }, [isEligiblePro, isAuthenticated]);

  const refreshNow = () => {
    if (!isEligiblePro) return;
    refresh().catch(() => {});
  };

  return (
    <LiveActivityContext.Provider value={{ isSupported: Platform.OS === "ios", refreshNow }}>
      {children}
    </LiveActivityContext.Provider>
  );
}

export function useLiveActivity(): LiveActivityContextType {
  return useContext(LiveActivityContext);
}
