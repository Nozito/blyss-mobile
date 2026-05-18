import React, { useEffect } from "react";
import { Tabs, Redirect, usePathname, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ProLiquidTabBar } from "@/components/navigation/TabBar";

const SUBSCRIPTION_PATHS = ["/subscription", "/subscription-success", "/subscription-settings"];

export default function ProLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();

  const hasActiveSub = user?.is_admin || user?.pro_status === "active";
  const isOnSubscriptionScreen = SUBSCRIPTION_PATHS.some((p) => pathname.endsWith(p));

  // Redirige vers l'abonnement dès que le statut est connu et inactif.
  // useEffect évite les problèmes de render synchrone avec Expo Router.
  useEffect(() => {
    if (!isLoading && user && !hasActiveSub && !isOnSubscriptionScreen) {
      router.replace("/(pro)/(profile)/subscription");
    }
  }, [isLoading, user, hasActiveSub, isOnSubscriptionScreen]);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !user.is_admin) return <Redirect href="/(client)" />;

  return (
    <Tabs
      tabBar={(props) => {
        // Pas de tab bar tant que l'abonnement n'est pas actif :
        // l'utilisateur ne peut pas naviguer vers d'autres pages pro.
        if (!hasActiveSub) return null;
        return <ProLiquidTabBar {...props} unreadCount={unreadCount} />;
      }}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard"     options={{ title: "Dashboard" }} />
      <Tabs.Screen name="calendar"      options={{ title: "Agenda" }} />
      <Tabs.Screen name="clients"       options={{ title: "Clientes" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="(profile)"     options={{ title: "Profil" }} />
      <Tabs.Screen name="client-detail" options={{ href: null }} />
    </Tabs>
  );
}
