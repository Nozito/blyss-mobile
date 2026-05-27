import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, Badge, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ClientLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "client" && !user.is_admin) return <Redirect href="/(pro)/dashboard" />;

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterialLight"
      tintColor="#FE5D9D"
      minimizeBehavior="never"
      labelVisibilityMode="unlabeled"
    >
      <NativeTabs.Trigger name="index" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="home-outline" />,
          selected: <VectorIcon family={Ionicons} name="home" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="calendar-outline" />,
          selected: <VectorIcon family={Ionicons} name="calendar" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="heart-outline" />,
          selected: <VectorIcon family={Ionicons} name="heart" />,
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
