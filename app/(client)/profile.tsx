import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/colors";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export default function ClientProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const photoUri = user?.profile_photo
    ? user.profile_photo.startsWith("http")
      ? user.profile_photo
      : `${API_URL}${user.profile_photo}`
    : undefined;

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Non", style: "cancel" },
      { text: "Oui", style: "destructive", onPress: logout },
    ]);
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Mon compte",
      items: [
        {
          icon: "person-outline",
          label: "Modifier mon profil",
          onPress: () => router.push("/(client)/settings"),
        },
        {
          icon: "notifications-outline",
          label: "Notifications",
          onPress: () => router.push("/(client)/notifications"),
        },
        {
          icon: "card-outline",
          label: "Moyens de paiement",
          onPress: () => router.push("/(client)/payments"),
        },
      ],
    },
    {
      title: "Légal",
      items: [
        {
          icon: "help-circle-outline",
          label: "Aide & support",
          onPress: () => router.push("/(client)/help" as any),
        },
        {
          icon: "shield-outline",
          label: "Mes données personnelles",
          onPress: () => router.push("/(client)/rgpd" as any),
        },
      ],
    },
    {
      title: "Session",
      items: [
        {
          icon: "log-out-outline",
          label: "Se déconnecter",
          onPress: handleLogout,
          destructive: true,
        },
      ],
    },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <Card elevated className="items-center py-6 mb-6">
        <Avatar
          uri={photoUri}
          name={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`}
          size={80}
        />
        <Text className="text-xl font-bold text-foreground mt-3">
          {user?.first_name} {user?.last_name}
        </Text>
        <Text className="text-muted-foreground text-sm mt-0.5">{user?.email}</Text>
        {user?.city && (
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="location-outline" size={13} color={Colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">{user.city}</Text>
          </View>
        )}
      </Card>

      {/* Menu sections */}
      {menuSections.map((section) => (
        <View key={section.title} className="mb-5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {section.title}
          </Text>
          <Card>
            {section.items.map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                className={[
                  "flex-row items-center gap-3 py-3.5",
                  idx < section.items.length - 1 ? "border-b border-border" : "",
                ].join(" ")}
              >
                <View
                  className="w-8 h-8 rounded-xl items-center justify-center"
                  style={{
                    backgroundColor: item.destructive
                      ? `${Colors.destructive}15`
                      : Colors.primaryLight,
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={item.destructive ? Colors.destructive : Colors.primary}
                  />
                </View>
                <Text
                  className={[
                    "flex-1 text-sm font-medium",
                    item.destructive ? "text-destructive" : "text-foreground",
                  ].join(" ")}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={Colors.mutedForeground}
                />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}
