import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

// SDK 57 : Icon / VectorIcon vivent sous NativeTabs.Trigger.
const { Icon, VectorIcon } = NativeTabs.Trigger;
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
      <NativeTabs.Trigger name="index">
        <Icon src={<VectorIcon family={Ionicons} name="home-outline" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <Icon src={<VectorIcon family={Ionicons} name="calendar-outline" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites">
        <Icon src={<VectorIcon family={Ionicons} name="heart-outline" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notifications">
        <Icon src={<VectorIcon family={Ionicons} name="notifications-outline" />} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(profile)">
        <Icon src={<VectorIcon family={Ionicons} name="person-outline" />} />
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
