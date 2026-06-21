import React, { useEffect } from "react";
import { Redirect, useRouter } from "expo-router";
import { NativeTabs, Icon, Badge, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ProLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const { activePlan, isReady: rcReady } = useRevenueCat();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const isAdmin = user?.is_admin ?? false;
  const hasActiveSub = isAdmin || Boolean(activePlan);

  useEffect(() => {
    if (authLoading || !rcReady) return;
    if (!user || isAdmin) return;
    if (!hasActiveSub) {
      router.replace("/(pro)/(profile)/subscription");
    }
    // router is intentionally omitted — it's a stable singleton in Expo Router.
    // user?.id replaces the full user object to avoid re-running on every object re-creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, rcReady, user?.id, isAdmin, hasActiveSub]);

  if (authLoading || !rcReady) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role !== "pro" && !isAdmin) return <Redirect href="/(client)" />;

  // NativeTabs MUST be mounted before the router.replace effect fires.
  // Returning a spinner here (no NativeTabs) caused Expo Router to re-mount
  // the layout on each replace call, creating an infinite redirect loop.

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterialLight"
      tintColor="#FE5D9D"
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

      {/* Routes cachées — non affichées dans la tab bar */}
      <NativeTabs.Trigger name="onboarding" hidden />
    </NativeTabs>
  );
}
