import React from "react";
import { Redirect, useSegments } from "expo-router";
import { NativeTabs, Icon, Badge, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

export default function ProLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const { activePlan, isReady: rcReady } = useRevenueCat();
  const { unreadCount } = useNotifications();
  const segments = useSegments();

  const isAdmin = user?.is_admin ?? false;
  const hasActiveSub = isAdmin || Boolean(activePlan);
  // Already on the paywall itself — don't redirect to it again, or every
  // render would produce a fresh <Redirect> to the same screen we're on.
  const isOnSubscriptionScreen = segments.includes("subscription" as never);

  if (authLoading || !rcReady) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role !== "pro" && !isAdmin) return <Redirect href="/(client)" />;

  // Declarative redirect (resolved during render, before NativeTabs mounts)
  // instead of an imperative router.replace() from an effect — the latter
  // was firing correctly (confirmed via logging) but silently no-op'd when
  // called right after the NativeTabs navigator's own initial transition
  // (e.g. right after "Commencer" on the signup success screen) was still
  // settling, letting a pro with no subscription land on the dashboard with
  // full access. A Redirect resolved at render time doesn't race that
  // transition at all.
  if (!hasActiveSub && !isOnSubscriptionScreen) {
    return <Redirect href="/(pro)/(profile)/subscription" />;
  }

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterial"
      tintColor={Colors.primary}
      minimizeBehavior="never"
      labelVisibilityMode="unlabeled"
    >
      <NativeTabs.Trigger name="dashboard" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="grid-outline" />,
          selected: <VectorIcon family={Ionicons} name="grid" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="calendar-outline" />,
          selected: <VectorIcon family={Ionicons} name="calendar" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(clients)" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="people-outline" />,
          selected: <VectorIcon family={Ionicons} name="people" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notifications" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="notifications-outline" />,
          selected: <VectorIcon family={Ionicons} name="notifications" />,
        }} />
        <Badge hidden={unreadCount === 0}>{String(unreadCount || "")}</Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(profile)" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="person-outline" />,
          selected: <VectorIcon family={Ionicons} name="person" />,
        }} />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
