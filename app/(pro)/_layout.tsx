import React from "react";
import { Tabs, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ProLiquidTabBar } from "@/components/navigation/TabBar";
import { RequireSubscription } from "@/components/RequireSubscription";

export default function ProLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !user.is_admin) return <Redirect href="/(client)" />;

  return (
    <RequireSubscription>
      <Tabs
        tabBar={(props) => <ProLiquidTabBar {...props} unreadCount={unreadCount} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="dashboard"     options={{ title: "Dashboard" }} />
        <Tabs.Screen name="calendar"      options={{ title: "Agenda" }} />
        <Tabs.Screen name="clients"       options={{ title: "Clientes" }} />
        <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
        <Tabs.Screen name="(profile)"     options={{ title: "Profil" }} />
        <Tabs.Screen name="client-detail" options={{ href: null }} />
      </Tabs>
    </RequireSubscription>
  );
}
