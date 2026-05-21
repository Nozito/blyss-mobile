import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
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
      minimizeBehavior="automatic"
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Accueil</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <Icon sf={{ default: "calendar.circle", selected: "calendar.circle.fill" }} />
        <Label>Réservations</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>Favoris</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notifications">
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Notifs</Label>
        <Badge hidden={unreadCount === 0}>{String(unreadCount || "")}</Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(profile)">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profil</Label>
      </NativeTabs.Trigger>

      {/* Routes cachées — non affichées dans la tab bar */}
      <NativeTabs.Trigger name="specialists" hidden />
      <NativeTabs.Trigger name="my-bookings" hidden />
      <NativeTabs.Trigger name="booking" hidden />
    </NativeTabs>
  );
}
