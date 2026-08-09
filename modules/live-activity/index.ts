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
