import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

export default function ClientLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role !== "client" && !user.is_admin) return <Redirect href="/(pro)/dashboard" />;

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterial"
      tintColor={Colors.primary}
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
