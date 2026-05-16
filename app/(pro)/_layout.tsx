import React from "react";
import { Tabs, Redirect } from "expo-router";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const VISIBLE_TABS = [
    { name: "dashboard",     icon: "grid" },
    { name: "calendar",      icon: "calendar" },
    { name: "clients",       icon: "people" },
    { name: "notifications", icon: "notifications" },
    { name: "profile",       icon: "person" },
  ];

  const tabs = VISIBLE_TABS.map(({ name, icon }) => {
    const route = state.routes.find((r: any) => r.name === name);
    if (!route) return null;
    const focused = state.routes[state.index]?.name === name;
    return (
      <Pressable
        key={name}
        onPress={() => navigation.navigate(name)}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons
          name={(focused ? icon : `${icon}-outline`) as any}
          size={26}
          color={focused ? "#FE5D9D" : "rgba(100, 80, 90, 0.55)"}
        />
      </Pressable>
    );
  });

  if (Platform.OS === "android") {
    return (
      <View style={{
        position: "absolute",
        bottom: insets.bottom + 12,
        left: 24, right: 24, height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255, 240, 245, 0.92)",
        flexDirection: "row", alignItems: "center", justifyContent: "space-around",
        shadowColor: "#FE5D9D",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
      }}>
        {tabs}
      </View>
    );
  }

  return (
    <View style={{
      position: "absolute",
      bottom: insets.bottom + 12,
      left: 24, right: 24, height: 64,
      borderRadius: 32,
      overflow: "hidden",
      shadowColor: "#FE5D9D",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
    }}>
      <BlurView
        intensity={70}
        tint="light"
        style={{ ...StyleSheet.absoluteFillObject, borderRadius: 32 }}
      />
      <View style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255, 240, 245, 0.45)",
        borderRadius: 32,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.6)",
      }} />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around" }}>
        {tabs}
      </View>
    </View>
  );
}

export default function ProLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !user.is_admin) return <Redirect href="/(client)" />;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} unreadCount={unreadCount} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="calendar" options={{ title: "Agenda" }} />
      <Tabs.Screen name="clients" options={{ title: "Clientes" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
      {/* Hidden screens */}
      <Tabs.Screen name="finance" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="rgpd" options={{ href: null }} />
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="public-profile" options={{ href: null }} />
      <Tabs.Screen name="subscription-success" options={{ href: null }} />
      <Tabs.Screen name="upgrade" options={{ href: null }} />
      <Tabs.Screen name="subscription-settings" options={{ href: null }} />
    </Tabs>
  );
}
