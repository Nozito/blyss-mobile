import React, { useEffect } from "react";
import { Tabs, Redirect, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ProLiquidTabBar } from "@/components/navigation/TabBar";

export default function ProLayout() {
  const { user, isLoading: authLoading } = useAuth();
  const { activePlan, isReady: rcReady } = useRevenueCat();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const isAdmin = user?.is_admin ?? false;
  const hasActiveSub = isAdmin || Boolean(activePlan);

  // Redirige vers subscription dès que auth + RC sont prêts et qu'il n'y a pas de plan.
  // useEffect = hors du render, pattern recommandé par Expo Router.
  useEffect(() => {
    if (authLoading || !rcReady) return;
    if (!user || isAdmin) return;
    if (!hasActiveSub) {
      router.replace("/(pro)/(profile)/subscription");
    }
  }, [authLoading, rcReady, user, isAdmin, hasActiveSub]);

  // Attendre que auth ET RC soient initialisés avant d'afficher quoi que ce soit
  if (authLoading || !rcReady) return <LoadingSpinner fullScreen />;

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !isAdmin) return <Redirect href="/(client)" />;

  // Tabs est toujours le return direct (Expo Router l'exige).
  // Le tab bar est masqué si pas d'abonnement : aucune navigation possible.
  return (
    <Tabs
      tabBar={(props) => {
        if (!hasActiveSub) return null;
        // Masque la tab bar sur l'écran d'onboarding post-paiement
        const currentRoute = props.state.routes[props.state.index]?.name;
        if (currentRoute === "onboarding") return null;
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
      <Tabs.Screen name="onboarding"    options={{ href: null }} />
    </Tabs>
  );
}
