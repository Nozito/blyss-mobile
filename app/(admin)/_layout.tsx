import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user || !user.is_admin) return <Redirect href="/(auth)/login" />;

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterialLight"
      tintColor={Colors.admin}
      minimizeBehavior="automatic"
      labelVisibilityMode="unlabeled"
    >
      <NativeTabs.Trigger name="dashboard">
        <Icon src={{ default: <VectorIcon family={Ionicons} name="grid-outline" />, selected: <VectorIcon family={Ionicons} name="grid" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users">
        <Icon src={{ default: <VectorIcon family={Ionicons} name="people-outline" />, selected: <VectorIcon family={Ionicons} name="people" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings">
        <Icon src={{ default: <VectorIcon family={Ionicons} name="calendar-outline" />, selected: <VectorIcon family={Ionicons} name="calendar" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="payments">
        <Icon src={{ default: <VectorIcon family={Ionicons} name="card-outline" />, selected: <VectorIcon family={Ionicons} name="card" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon src={{ default: <VectorIcon family={Ionicons} name="ellipsis-horizontal-outline" />, selected: <VectorIcon family={Ionicons} name="ellipsis-horizontal" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="analytics"     hidden />
      <NativeTabs.Trigger name="logs"          hidden />
      <NativeTabs.Trigger name="notifications" hidden />
      <NativeTabs.Trigger name="coupons"       hidden />
    </NativeTabs>
  );
}
