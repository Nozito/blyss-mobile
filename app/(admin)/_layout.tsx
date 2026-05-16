import React, { useCallback } from "react";
import { Tabs, Redirect, useRouter } from "expo-router";
import { Platform, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Se déconnecter ?",
      "Tu vas être redirigé vers l'écran de connexion.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: async () => {
            await authApi.logout();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  }, [router]);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user || !user.is_admin) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 16, fontWeight: "700", color: Colors.foreground },
        headerRight: () => (
          <Pressable
            onPress={handleLogout}
            style={{ paddingHorizontal: 16 }}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </Pressable>
        ),
        tabBarActiveTintColor: Colors.admin,
        tabBarInactiveTintColor: Colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: Platform.OS === "android" ? "rgba(255,255,255,0.95)" : "transparent",
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={80} tint="light" style={{ flex: 1 }} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Utilisateurs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Réservations",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="logs" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
