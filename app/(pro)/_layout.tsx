import React, { useEffect } from "react";
import { Redirect, useRouter } from "expo-router";
import { NativeTabs, Icon, Label, Badge } from "expo-router/unstable-native-tabs";
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
  }, [authLoading, rcReady, user, isAdmin, hasActiveSub]);

  if (authLoading || !rcReady) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !isAdmin) return <Redirect href="/(client)" />;

  // Bloque le rendu des tabs si pas d'abo — useEffect redirige vers subscription
  if (!hasActiveSub) return <LoadingSpinner fullScreen />;

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterialLight"
      tintColor="#FE5D9D"
      minimizeBehavior="automatic"
    >
      <NativeTabs.Trigger name="dashboard">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Icon sf={{ default: "calendar.circle", selected: "calendar.circle.fill" }} />
        <Label>Agenda</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="clients">
        <Icon sf={{ default: "person.2", selected: "person.2.fill" }} />
        <Label>Clientes</Label>
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
      <NativeTabs.Trigger name="client-detail" hidden />
      <NativeTabs.Trigger name="onboarding" hidden />
    </NativeTabs>
  );
}
