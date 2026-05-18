import React from "react";
import { Tabs, Redirect, usePathname } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ProLiquidTabBar } from "@/components/navigation/TabBar";

// Écrans accessibles sans abonnement actif (souscription, succès)
const SUBSCRIPTION_PATHS = ["/subscription", "/subscription-success", "/subscription-settings"];

export default function ProLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();
  const pathname = usePathname();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !user.is_admin) return <Redirect href="/(client)" />;

  // Admins passent toujours. Écrans de souscription accessibles sans abonnement.
  const isSubscriptionScreen = SUBSCRIPTION_PATHS.some((p) => pathname.endsWith(p));
  if (!user.is_admin && user.pro_status !== "active" && !isSubscriptionScreen) {
    return <Redirect href="/(pro)/(profile)/subscription" />;
  }

  return (
    <Tabs
      tabBar={(props) => <ProLiquidTabBar {...props} unreadCount={unreadCount} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard"     options={{ title: "Dashboard" }} />
      <Tabs.Screen name="calendar"      options={{ title: "Agenda" }} />
      <Tabs.Screen name="clients"       options={{ title: "Clientes" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="(profile)"      options={{ title: "Profil" }} />
      {/* Écrans cachés (pas dans la tabbar) */}
      <Tabs.Screen name="client-detail" options={{ href: null }} />
    </Tabs>
  );
}
