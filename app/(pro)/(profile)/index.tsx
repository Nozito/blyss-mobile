import React, { useMemo, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/colors";
import { proApi, usersApi } from "@/lib/api";

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
  const { user, logout, refreshProfile, patchUser } = useAuth();
  // Fix 3 — RC is source of truth; backend subscription is fallback only
  const { activePlan } = useRevenueCat();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);

  const handlePickAvatar = () => {
    Alert.alert("Photo de profil", "Choisir depuis…", [
      {
        text: "Galerie",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== "granted") {
            Alert.alert("Permission refusée", "Autorise l'accès à la galerie dans les réglages.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadPhoto(result.assets[0].uri);
          }
        },
      },
      {
        text: "Caméra",
        onPress: async () => {
          if (!Device.isDevice) {
            Alert.alert(
              "Caméra indisponible",
              "La caméra n'est pas disponible sur le simulateur. Utilise un vrai appareil ou choisis une photo depuis la galerie.",
              [{ text: "OK", style: "cancel" }]
            );
            return;
          }
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== "granted") {
            Alert.alert("Permission refusée", "Autorise l'accès à la caméra dans les réglages.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadPhoto(result.assets[0].uri);
          }
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    const res = await usersApi.uploadProfilePhoto(uri);
    setUploading(false);
    if (!res.success) {
      Alert.alert("Erreur", res.error ?? "Impossible de mettre à jour la photo.");
      return;
    }
    // Fix 1b: mise à jour locale immédiate avant le refetch
    if (res.data?.photo) patchUser({ profile_photo: res.data.photo });
    await refreshProfile();
  };

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
  // Fix 3 — RC activePlan is source of truth; backend is fallback for when RC hasn't loaded yet
  const currentPlanLabel = activePlan
    ? `Plan ${PLAN_LABELS[activePlan]}`
    : subscription?.plan
      ? `Plan ${PLAN_LABELS[subscription.plan] ?? subscription.plan}`
      : "Aucun abonnement";

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Êtes-vous sûr de vouloir vous déconnecter ?", [
      { text: "Non", style: "cancel" },
      { text: "Oui", style: "destructive", onPress: logout },
    ]);
  };

  const menuItems: Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; route: string }> = [
    { icon: "person-outline", label: "Modifier mon profil", route: "/(pro)/(profile)/settings" },
    { icon: "briefcase-outline", label: "Mes prestations", route: "/(pro)/(profile)/services" },
    { icon: "trending-up-outline", label: "Finance", route: "/(pro)/(profile)/finance" },
    { icon: "card-outline", label: "Encaissements", route: "/(pro)/(profile)/payments" },
    { icon: "help-circle-outline", label: "Aide & support", route: "/(pro)/(profile)/help" },
    { icon: "shield-outline", label: "Mes données personnelles", route: "/(pro)/(profile)/rgpd" },
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
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>
          Mon profil pro
        </Text>
        <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 2 }}>
          Gère ton compte et ton activité
        </Text>
      </View>

      {/* Profile Card avec complétude */}
      <View style={{ marginBottom: 16 }}>
        <View style={{
          backgroundColor: Colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: Colors.border,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>

            {/* Avatar avec badge caméra */}
            <Pressable onPress={handlePickAvatar}
              style={{ position: "relative", width: 72, height: 72 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 20,
                backgroundColor: "#FE5D9D20",
                alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }}
                    style={{ width: 72, height: 72 }} />
                ) : (
                  <Text style={{
                    fontSize: 24, fontWeight: "800", color: "#FE5D9D"
                  }}>
                    {`${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`}
                  </Text>
                )}
                {uploading && (
                  <View style={{
                    ...StyleSheet.absoluteFillObject,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
              </View>
              {/* Badge caméra */}
              <View style={{
                position: "absolute", bottom: -4, right: -4,
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: "#FE5D9D",
                alignItems: "center", justifyContent: "center",
                shadowColor: "#FE5D9D", shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
              }}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </Pressable>

            {/* Texte + barre */}
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 17, fontWeight: "800",
                color: Colors.foreground, marginBottom: 2
              }}>
                {`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
                  || "Profil Pro"}
              </Text>
              <Text style={{
                fontSize: 13, color: Colors.mutedForeground, marginBottom: 10
              }}>
                {user?.activity_name?.trim() || "Non renseignée"}
              </Text>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 8
              }}>
                <View style={{
                  flex: 1, height: 4, backgroundColor: "#F0F0F0",
                  borderRadius: 2, overflow: "hidden"
                }}>
                  <LinearGradient
                    colors={["#FE5D9D", "#FE5D9D99"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      height: "100%",
                      width: `${profileCompleteness}%`,
                      borderRadius: 2
                    }}
                  />
                </View>
                <Text style={{
                  fontSize: 11, fontWeight: "700", color: "#FE5D9D"
                }}>
                  {profileCompleteness}%
                </Text>
              </View>
              <Text style={{
                fontSize: 10, color: Colors.mutedForeground, marginTop: 3
              }}>
                Profil complété
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats grid 3 colonnes */}
      <View style={{ marginBottom: 16 }}>
        <Card elevated>
          <View style={{ flexDirection: "row" }}>
            {([
              {
                renderIcon: () => <Ionicons name="people-outline" size={16} color={Colors.primary} />,
                value: user?.clients_count != null ? String(user.clients_count) : "—",
                label: `Client${(user?.clients_count ?? 0) > 1 ? "es" : "e"}`,
              },
              {
                renderIcon: () => <Ionicons name="star-outline" size={16} color={Colors.primary} />,
                value: user?.avg_rating != null ? Number(user.avg_rating).toFixed(1) : "—",
                label: "Note moy.",
              },
              {
                renderIcon: () => <Ionicons name="trending-up-outline" size={16} color={Colors.primary} />,
                value: blyssAge ? blyssAge.value : "—",
                label: blyssAge ? `${blyssAge.unit} Blyss` : "Sur Blyss",
              },
            ] as const).map((stat, i, arr) => (
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
                  {stat.renderIcon()}
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
      </View>

      {/* Abonnement card */}
      <View style={{ marginBottom: 20 }}>
        <Pressable
          onPress={() =>
            router.push(subscription ? "/(pro)/(profile)/subscription-settings" : "/(pro)/(profile)/subscription")
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
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: "#ECFDF5", borderRadius: 999,
                      paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
                    }}>
                      <Ionicons name="checkmark-circle-outline" size={12} color="#059669" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#059669" }}>Actif</Text>
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
      </View>

      {/* Profil public */}
      <View style={{ marginBottom: 20 }}>
        <Pressable
          onPress={() => router.push("/(pro)/(profile)/public-profile")}
          style={{
            backgroundColor: Colors.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: Colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: `${Colors.primary}15`,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="eye-outline" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>
                Profil public
              </Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
                Vu par tes clientes
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{
                width: 30, height: 30, borderRadius: 8,
                backgroundColor: Colors.muted,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="create-outline" size={15} color={Colors.mutedForeground} />
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "nowrap", gap: 6, overflow: "hidden" }}>
            {user?.city ? (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                alignSelf: "flex-start", backgroundColor: Colors.muted,
                borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6,
              }}>
                <Ionicons name="location-outline" size={12} color={Colors.mutedForeground} />
                <Text numberOfLines={1} style={{ fontSize: 11, color: Colors.mutedForeground }}>
                  {user.city}
                </Text>
              </View>
            ) : null}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              alignSelf: "flex-start",
              backgroundColor: user?.instagram_account ? `${Colors.primary}15` : Colors.muted,
              borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6,
            }}>
              <Ionicons name="logo-instagram" size={12} color={user?.instagram_account ? Colors.primary : Colors.mutedForeground} />
              <Text numberOfLines={1} style={{ fontSize: 11, color: user?.instagram_account ? Colors.primary : Colors.mutedForeground }}>
                {user?.instagram_account || "Non renseigné"}
              </Text>
            </View>
            {profileCompleteness < 100 ? (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                alignSelf: "flex-start", backgroundColor: "#FE5D9D15",
                borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6,
              }}>
                <Ionicons name="trending-up-outline" size={11} color="#FE5D9D" />
                <Text numberOfLines={1} style={{ fontSize: 11, color: "#FE5D9D", fontWeight: "600" }}>
                  Compléter
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>

      {/* Menu */}
      <View style={{ marginBottom: 16 }}>
        <Card>
          {menuItems.map((item, idx) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: idx < menuItems.length - 1 ? 1 : 0,
                borderBottomColor: "#F0F0F0",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: `${Colors.primary}15`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={item.icon} size={22} color={Colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: Colors.foreground }}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      </View>

      {/* Logout */}
      <View style={{ marginBottom: 16 }}>
        <Pressable
          onPress={handleLogout}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 16,
            borderRadius: 16,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#EF444430",
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#FEF2F2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </View>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: "#EF4444" }}>
            Se déconnecter
          </Text>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={{ alignItems: "center", paddingBottom: 8 }}>
        <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Blyss Pro v1.0.0</Text>
      </View>
    </ScrollView>
  );
}
