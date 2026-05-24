import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Platform, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const ACCENT = "#F97316";
const BG = "#0B0E14";

function AdminHeaderTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: "700", color: "#F8FAFC" }}>{title}</Text>
      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: "rgba(249,115,22,0.18)", borderWidth: 1, borderColor: "rgba(249,115,22,0.35)" }}>
        <Text style={{ fontSize: 9, fontWeight: "800", color: ACCENT, letterSpacing: 1, textTransform: "uppercase" }}>Admin</Text>
      </View>
    </View>
  );
}

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!user || !user.is_admin) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: BG },
        headerShadowVisible: false,
        headerTintColor: "#F8FAFC",
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "rgba(248,250,252,0.38)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0.5,
          borderTopColor: "rgba(249,115,22,0.15)",
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: Platform.OS === "android" ? "rgba(11,14,20,0.97)" : "transparent",
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={{ flex: 1, borderTopWidth: 0.5, borderTopColor: "rgba(249,115,22,0.15)", backgroundColor: "rgba(11,14,20,0.85)" }}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          headerTitle: () => <AdminHeaderTitle title="Dashboard" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
          tabBarLabel: "Dashboard",
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          headerTitle: () => <AdminHeaderTitle title="Utilisateurs" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          tabBarLabel: "Users",
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          headerTitle: () => <AdminHeaderTitle title="Réservations" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          tabBarLabel: "RDV",
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          headerTitle: () => <AdminHeaderTitle title="Paiements" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
          tabBarLabel: "Paiements",
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          headerTitle: () => <AdminHeaderTitle title="Plus" />,
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle" size={size} color={color} />,
          tabBarLabel: "Plus",
        }}
      />
      <Tabs.Screen name="analytics"     options={{ href: null, headerTitle: () => <AdminHeaderTitle title="Analytics" /> }} />
      <Tabs.Screen name="logs"          options={{ href: null, headerTitle: () => <AdminHeaderTitle title="Logs" /> }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerTitle: () => <AdminHeaderTitle title="Notifications" /> }} />
      <Tabs.Screen name="coupons"       options={{ href: null, headerTitle: () => <AdminHeaderTitle title="Coupons" /> }} />
    </Tabs>
  );
}
