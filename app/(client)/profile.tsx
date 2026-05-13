import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/colors";

function calculateClientCompleteness(user: any): number {
  let score = 30; // baseline name + email
  if (user?.profile_photo) score += 20;
  if (user?.phone_number) score += 20;
  if (user?.city) score += 15;
  if (user?.birth_date) score += 15;
  return Math.min(score, 100);
}

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
  const profileCompleteness = useMemo(() => calculateClientCompleteness(user), [user]);

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
      <Card elevated className="mb-6">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ position: "relative" }}>
            <Avatar
              uri={photoUri}
              name={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`}
              size={72}
            />
            <Pressable
              onPress={() => router.push("/(client)/settings")}
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: Colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <Ionicons name="camera" size={13} color="#fff" />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground, marginBottom: 2 }}>
              {user?.first_name} {user?.last_name}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: user?.city ? 6 : 10 }}>
              {user?.email}
            </Text>
            {user?.city && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 }}>
                <Ionicons name="location-outline" size={12} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{user.city}</Text>
              </View>
            )}
            {/* Completeness bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, height: 6, backgroundColor: Colors.muted, borderRadius: 3, overflow: "hidden" }}>
                <LinearGradient
                  colors={[Colors.primary, `${Colors.primary}99`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: "100%", width: `${profileCompleteness}%`, borderRadius: 3 }}
                />
              </View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.primary }}>
                {profileCompleteness}%
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 2 }}>
              Profil complété
            </Text>
          </View>
        </View>
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
