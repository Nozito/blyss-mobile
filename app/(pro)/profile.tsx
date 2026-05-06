import React from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Colors } from "@/constants/colors";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ProProfileScreen() {
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

  const menuSections = [
    {
      title: "Mon activité",
      items: [
        { icon: "person-outline" as const, label: "Modifier mon profil", route: "/(pro)/settings" as string | null, destructive: false as boolean },
        { icon: "globe-outline" as const, label: "Profil public", route: "/(pro)/public-profile" as string | null, destructive: false as boolean },
        { icon: "diamond-outline" as const, label: "Mon abonnement", route: "/(pro)/subscription" as string | null, destructive: false as boolean },
        { icon: "settings-outline" as const, label: "Gérer l'abonnement", route: "/(pro)/subscription-settings" as string | null, destructive: false as boolean },
        { icon: "trending-up-outline" as const, label: "Finances", route: "/(pro)/finance" as string | null, destructive: false as boolean },
        { icon: "card-outline" as const, label: "Paiements", route: "/(pro)/payments" as string | null, destructive: false as boolean },
        { icon: "notifications-outline" as const, label: "Notifications", route: "/(pro)/notifications" as string | null, destructive: false as boolean },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help-circle-outline" as const, label: "Aide & support", route: "/(pro)/help" as string | null, destructive: false as boolean },
        { icon: "shield-outline" as const, label: "Mes données personnelles", route: "/(pro)/rgpd" as string | null, destructive: false as boolean },
      ],
    },
    {
      title: "Session",
      items: [
        { icon: "log-out-outline" as const, label: "Se déconnecter", route: null as string | null, destructive: true as boolean },
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
      {/* Profile header */}
      <Card elevated className="items-center py-6 mb-6">
        <Avatar uri={photoUri} name={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`} size={80} />
        <Text className="text-xl font-bold text-foreground mt-3">
          {user?.activity_name ?? `${user?.first_name} ${user?.last_name}`}
        </Text>
        <Text className="text-muted-foreground text-sm mt-0.5">{user?.email}</Text>

        <View className="flex-row gap-3 mt-3">
          {user?.avg_rating != null && (
            <View className="items-center">
              <Text className="text-lg font-bold text-secondary">
                {user.avg_rating.toFixed(1)} ★
              </Text>
              <Text className="text-xs text-muted-foreground">Note</Text>
            </View>
          )}
          {user?.clients_count != null && (
            <View className="w-px bg-border" />
          )}
          {user?.clients_count != null && (
            <View className="items-center">
              <Text className="text-lg font-bold text-foreground">
                {user.clients_count}
              </Text>
              <Text className="text-xs text-muted-foreground">Clientes</Text>
            </View>
          )}
        </View>

        {user?.pro_status && (
          <View className="mt-3">
            <Badge
              variant={user.pro_status === "active" ? "success" : "warning"}
              size="sm"
            >
              {user.pro_status === "active" ? "Actif" : "Inactif"}
            </Badge>
          </View>
        )}
      </Card>

      {menuSections.map((section) => (
        <View key={section.title} className="mb-5">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {section.title}
          </Text>
          <Card>
            {section.items.map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={() =>
                  item.destructive
                    ? handleLogout()
                    : router.push(item.route as Parameters<typeof router.push>[0])
                }
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
                      : `${Colors.primary}15`,
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={item.destructive ? Colors.destructive : Colors.primary}
                  />
                </View>
                <Text
                  className={`flex-1 text-sm font-medium ${
                    item.destructive ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}
