import React from "react";
import { Tabs, Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LiquidTabBar } from "@/components/navigation/TabBar";

export default function ClientLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "client" && !user.is_admin) return <Redirect href="/(pro)/dashboard" />;

  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"         options={{ title: "Accueil" }} />
      <Tabs.Screen name="bookings"      options={{ title: "Mes réservations" }} />
      <Tabs.Screen name="favorites"     options={{ title: "Mes favoris" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="(profile)"     options={{ title: "Profil" }} />
      {/* Hidden screens */}
      <Tabs.Screen name="specialists" options={{ href: null }} />
      <Tabs.Screen name="my-bookings" options={{ href: null }} />
      <Tabs.Screen name="booking"     options={{ href: null }} />
      <Tabs.Screen name="payments"    options={{ href: null }} />
    </Tabs>
  );
}
