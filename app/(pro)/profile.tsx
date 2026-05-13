import React, { useMemo } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/colors";
import { proApi } from "@/lib/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

function calculateProfileCompleteness(user: any): number {
  if (!user) return 0;
  let score = 0;
  if (user.profile_photo) score += 10;
  if (user.activity_name?.trim().length >= 2) score += 15;
  if (user.city?.trim().length >= 2) score += 15;
  if (user.bio?.trim().length >= 20) score += 15;
  if (user.instagram_account?.startsWith("@")) score += 10;
  if (user.profile_visibility === "public") score += 5;
  // baseline name + email always present
  score += 30;
  return Math.min(score, 100);
}

function calculateBlyssAge(createdAt?: string): { value: string; unit: string } | null {
  if (!createdAt) return null;
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const months = Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
  if (months < 1) return null;
  const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
  if (years >= 1) return { value: `${years}`, unit: years > 1 ? "ans" : "an" };
  return { value: `${months}`, unit: "mois" };
}

export default function ProProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const photoUri = user?.profile_photo
    ? user.profile_photo.startsWith("http")
      ? user.profile_photo
      : `${API_URL}${user.profile_photo}`
    : undefined;

  const profileCompleteness = useMemo(() => calculateProfileCompleteness(user), [user]);
  const blyssAge = useMemo(() => calculateBlyssAge(user?.created_at), [user]);

  const { data: subData } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
    staleTime: 5 * 60_000,
  });
  const subscription = subData?.data;

  const PLAN_LABELS: Record<string, string> = {
    start: "Start",
    serenite: "Sérénité",
    signature: "Signature",
  };
  const currentPlanLabel = subscription?.plan
    ? `Plan ${PLAN_LABELS[subscription.plan] ?? subscription.plan}`
    : "Aucun abonnement";

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
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).springify()} style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>
          Mon profil pro
        </Text>
        <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
          Gère ton compte et ton activité
        </Text>
      </Animated.View>

      {/* Profile Card avec complétude */}
      <Animated.View entering={FadeInDown.delay(50).springify()} style={{ marginBottom: 16 }}>
        <Card elevated>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ position: "relative" }}>
              <Avatar
                uri={photoUri}
                name={`${user?.first_name ?? ""} ${user?.last_name ?? ""}`}
                size={72}
              />
              <Pressable
                onPress={() => router.push("/(pro)/settings")}
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
                {user?.activity_name ?? `${user?.first_name} ${user?.last_name}`}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 10 }}>
                {user?.email}
              </Text>
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
      </Animated.View>

      {/* Stats grid 3 colonnes */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={{ marginBottom: 16 }}>
        <Card elevated>
          <View style={{ flexDirection: "row" }}>
            {[
              {
                icon: "people-outline" as const,
                value: user?.clients_count != null ? String(user.clients_count) : "—",
                label: (user?.clients_count ?? 0) > 1 ? "Clientes" : "Cliente",
              },
              {
                icon: "star-outline" as const,
                value: user?.avg_rating ? user.avg_rating.toFixed(1) : "—",
                label: "Note moy.",
              },
              {
                icon: "trending-up-outline" as const,
                value: blyssAge ? blyssAge.value : "—",
                label: blyssAge ? `${blyssAge.unit} Blyss` : "Sur Blyss",
              },
            ].map((stat, i, arr) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 8,
                  borderRightWidth: i < arr.length - 1 ? 1 : 0,
                  borderRightColor: Colors.border,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: `${Colors.primary}18`,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                  }}
                >
                  <Ionicons name={stat.icon} size={16} color={Colors.primary} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.mutedForeground, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>

      {/* Abonnement card */}
      <Animated.View entering={FadeInDown.delay(150).springify()} style={{ marginBottom: 20 }}>
        <Pressable
          onPress={() =>
            router.push(subscription ? "/(pro)/subscription-settings" : "/(pro)/subscription")
          }
          style={{ borderRadius: 16, overflow: "hidden" }}
        >
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: `${Colors.primary}33`,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {/* Pink gradient overlay */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 16,
                backgroundColor: `${Colors.primary}06`,
              }}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: Colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Ionicons name="card-outline" size={22} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.foreground }}>
                    Mon abonnement
                  </Text>
                  {subscription?.status === "active" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 20,
                        backgroundColor: "#F0FDF4",
                        borderWidth: 1,
                        borderColor: "#BBF7D0",
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={10} color="#16A34A" />
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#16A34A" }}>Actif</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground, fontWeight: "500" }}>
                  {currentPlanLabel}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Menu sections */}
      {menuSections.map((section, si) => (
        <Animated.View
          key={section.title}
          entering={FadeInDown.delay(200 + si * 60).springify()}
          style={{ marginBottom: 16 }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: Colors.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}
          >
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
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.border,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: item.destructive
                      ? `${Colors.destructive}15`
                      : `${Colors.primary}15`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={item.destructive ? Colors.destructive : Colors.primary}
                  />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: "500",
                    color: item.destructive ? Colors.destructive : Colors.foreground,
                  }}
                >
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
              </Pressable>
            ))}
          </Card>
        </Animated.View>
      ))}
    </ScrollView>
  );
}
