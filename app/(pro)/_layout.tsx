import React from "react";
import { Tabs, Redirect } from "expo-router";
import { View, Text, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Colors } from "@/constants/colors";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function TabIcon({
  name,
  focused,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", gap: 3 }}>
      <Ionicons
        name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)}
        size={22}
        color={focused ? Colors.primary : "#9CA3AF"}
      />
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary }} />
      )}
      {badge != null && badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -8,
            backgroundColor: "#FF3B30",
            borderRadius: 10,
            minWidth: 16,
            height: 16,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ProLayout() {
  const { user, isLoading } = useAuth();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "pro" && !user.is_admin) return <Redirect href="/(client)" />;

  const proColor = Colors.primary;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: proColor,
        tabBarInactiveTintColor: Colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: -2 },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0.5,
          borderTopColor: "#F5E0EB",
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor:
            Platform.OS === "android" ? "rgba(255,255,255,0.97)" : "transparent",
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
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Agenda",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clientes",
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "Prestations",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="sparkles" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="person"
              focused={focused}
              badge={unreadCount > 0 ? unreadCount : undefined}
            />
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="finance" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
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
