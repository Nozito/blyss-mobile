import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ADMIN } from "@/constants/adminTheme";

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen backgroundColor={ADMIN.bg} />;
  if (!user || !user.is_admin) return <Redirect href="/(auth)/login" />;

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterialDark"
      tintColor={ADMIN.accent}
      minimizeBehavior="automatic"
      labelVisibilityMode="unlabeled"
    >
      <NativeTabs.Trigger name="dashboard" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="grid-outline" />,
          selected: <VectorIcon family={Ionicons} name="grid" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="users" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="people-outline" />,
          selected: <VectorIcon family={Ionicons} name="people" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="calendar-outline" />,
          selected: <VectorIcon family={Ionicons} name="calendar" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="payments" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="card-outline" />,
          selected: <VectorIcon family={Ionicons} name="card" />,
        }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more" options={{ title: "" }}>
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="ellipsis-horizontal-circle-outline" />,
          selected: <VectorIcon family={Ionicons} name="ellipsis-horizontal-circle" />,
        }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
