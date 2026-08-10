import { Platform } from "react-native";
import { requireNativeModule, type EventSubscription } from "expo-modules-core";

export interface LiveRdvContent {
  startAt: string; // ISO 8601 UTC
  endAt: string; // ISO 8601 UTC
  prestationName: string | null;
  clientFirstName: string | null;
  showTime: boolean;
  privacyLevel: "full" | "time_only" | "countdown_only";
}

export interface LiveRdvStartPayload extends LiveRdvContent {
  reservationId: number;
}

// Shapes for the Pro/Admin Home Screen widget suite (RevenueWidget,
// GrowthWidget, AlertsWidget, DaySummaryWidget, PlatformOverviewWidget,
// NextAppointmentWidget) — mirrors the Codable structs in
// targets/liveactivity/BlyssWidgetModels.swift. Each field of
// WidgetSnapshotPayload is optional because a given screen only ever knows
// its own slice; the native side merges it into whatever's already stored.
export interface WidgetNextAppointmentPayload {
  clientFullName: string;
  prestationName: string;
  durationMinutes: number;
  startAt: string; // ISO 8601 UTC
}

export interface WidgetDaySummaryPayload {
  state: "scheduled" | "free" | "finished";
  count?: number;
  nextTime?: string; // ISO 8601 UTC, required when state === "scheduled"
  inProgressCount?: number;
  completedCount?: number; // required when state === "finished"
}

export interface WidgetRevenuePayload {
  monthAmountEuros: number;
  growthPercent: number;
  objectiveAmountEuros?: number;
}

export interface WidgetPlatformOverviewPayload {
  activePros: number;
  reservations: number;
  growthPercent: number;
}

export interface WidgetAlertsPayload {
  paymentsToVerify: number;
  accountsToReview: number;
  criticalIncidents: number;
}

export interface WidgetGrowthPayload {
  todayAmountEuros: number;
  weekAmountEuros: number;
  growthPercent: number;
}

export interface WidgetSnapshotPayload {
  // `| null` clears a real "no upcoming RDV" state — distinct from omitting
  // the key, which leaves whatever was last synced untouched.
  nextAppointment?: WidgetNextAppointmentPayload | null;
  daySummary?: WidgetDaySummaryPayload;
  revenue?: WidgetRevenuePayload;
  platformOverview?: WidgetPlatformOverviewPayload;
  alerts?: WidgetAlertsPayload;
  growth?: WidgetGrowthPayload;
}

interface LiveActivityEventsMap {
  onPushTokenChange: (event: { activityId: string; token: string }) => void;
  onPushToStartTokenChange: (event: { token: string }) => void;
}

// Note: not extending expo-modules-core's `NativeModule<TEventsMap>` type —
// its generic doesn't actually forward TEventsMap (a quirk in this SDK
// version's type defs), which silently drops addListener from the merged
// type. The native object has it at runtime regardless (every Expo native
// module is an EventEmitter); declaring it here explicitly keeps typing sound.
interface NativeLiveActivityModule {
  isSupported(): boolean;
  startActivity(payload: LiveRdvStartPayload): Promise<string | null>;
  updateActivity(payload: LiveRdvContent): Promise<void>;
  endActivity(): Promise<void>;
  getActiveActivityId(): Promise<string | null>;
  writeSharedNextAppointment(payload: LiveRdvStartPayload | null): void;
  writeWidgetSnapshot(payload: WidgetSnapshotPayload): void;
  addListener<EventName extends keyof LiveActivityEventsMap>(
    eventName: EventName,
    listener: LiveActivityEventsMap[EventName]
  ): EventSubscription;
}

const isIOS = Platform.OS === "ios";
// Guarded: a native binary that doesn't (yet) embed this module — a build
// that skipped native prebuild after this module was added, or shipped
// before the widget target's credentials were finalized — must degrade to
// "unsupported" rather than take the whole app down at import time.
let nativeModule: NativeLiveActivityModule | null = null;
if (isIOS) {
  try {
    nativeModule = requireNativeModule<NativeLiveActivityModule>("LiveActivityModule");
  } catch {
    nativeModule = null;
  }
}

/** True only on iOS, with Live Activities enabled in system settings. */
export function isLiveActivitySupported(): boolean {
  return nativeModule?.isSupported() ?? false;
}

export async function startLiveActivity(payload: LiveRdvStartPayload): Promise<string | null> {
  if (!nativeModule) return null;
  return nativeModule.startActivity(payload);
}

export async function updateLiveActivity(payload: LiveRdvContent): Promise<void> {
  await nativeModule?.updateActivity(payload);
}

export async function endLiveActivity(): Promise<void> {
  await nativeModule?.endActivity();
}

export async function getActiveLiveActivityId(): Promise<string | null> {
  if (!nativeModule) return null;
  return nativeModule.getActiveActivityId();
}

/** Feeds the static Home Screen widget — pass null when there's no upcoming RDV. */
export function writeSharedNextAppointment(payload: LiveRdvStartPayload | null): void {
  nativeModule?.writeSharedNextAppointment(payload);
}

/**
 * Feeds the Pro/Admin Home Screen widget suite. Only send the slice(s) you
 * just fetched — the native side merges into whatever's already stored, so
 * unrelated widgets keep their last-known data.
 */
export function writeWidgetSnapshot(payload: WidgetSnapshotPayload): void {
  nativeModule?.writeWidgetSnapshot(payload);
}

export function addPushTokenListener(
  listener: (event: { activityId: string; token: string }) => void
): EventSubscription | undefined {
  return nativeModule?.addListener("onPushTokenChange", listener);
}

export function addPushToStartTokenListener(
  listener: (event: { token: string }) => void
): EventSubscription | undefined {
  return nativeModule?.addListener("onPushToStartTokenChange", listener);
}
