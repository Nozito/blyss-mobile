import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";
import { Shadows } from "@/constants/shadows";

const MENU_ITEMS = [
  { icon: "settings-outline" as const, label: "Paramètres", route: "/(client)/(profile)/settings" },
  { icon: "notifications-outline" as const, label: "Notifications", route: "/(client)/notifications" },
  { icon: "help-circle-outline" as const, label: "Aide", route: "/(client)/(profile)/help" },
  { icon: "shield-outline" as const, label: "RGPD", route: "/(client)/(profile)/rgpd" },
] as const;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handlePickAvatar = () => {
    Alert.alert("Photo de profil", "Choisir depuis…", [
      {
        text: "Galerie",
        onPress: async () => {
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
    await refreshProfile();
  };

  const displayName = user ? `${user.first_name} ${user.last_name}` : "";
  const photoUrl = user?.profile_photo
    ? user.profile_photo.startsWith("http")
      ? user.profile_photo
      : `${API_URL}${user.profile_photo}`
    : null;

  const profileCompleteness = (() => {
    let score = 60;
    if (user?.profile_photo) score += 20;
    if ((user as Record<string, unknown> | null)?.phone_number) score += 20;
    return score;
  })();

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Tu souhaites te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 }}>
            Mon profil
          </Text>
          <Text style={{ fontSize: 13, color: "#6D6D78", marginTop: 4 }}>
            Gère ton compte Blyss
          </Text>
        </View>

        {/* Profile card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            marginBottom: 16,
            ...Shadows.card,
          }}
        >
          {/* Avatar avec badge caméra */}
          <Pressable onPress={handlePickAvatar}
            style={{ position: "relative", width: 72, height: 72 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 20,
              backgroundColor: "#FE5D9D20",
              alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: 72, height: 72 }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#FE5D9D" }}>
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

          {/* Nom + sous-titre + barre */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#09090B", marginBottom: 2 }}>
              {displayName || "Profil"}
            </Text>
            {user?.email && (
              <Text style={{ fontSize: 13, color: "#6D6D78", marginBottom: 10 }}>
                {user.email}
              </Text>
            )}
            {/* Completeness bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: "#F0F0F0", borderRadius: 2, overflow: "hidden" }}>
                <LinearGradient
                  colors={["#FE5D9D", "#FE5D9D99"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: "100%", width: `${profileCompleteness}%`, borderRadius: 2 }}
                />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#FE5D9D" }}>
                {profileCompleteness}%
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: "#6D6D78", marginTop: 3 }}>
              Profil complété
            </Text>
          </View>
        </View>

        {/* Menu items */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            marginBottom: 16,
            ...Shadows.card,
          }}
        >
          {MENU_ITEMS.map((item, i) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: i < MENU_ITEMS.length - 1 ? 1 : 0,
                borderBottomColor: "#F0F0F0",
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "#FE5D9D15",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={item.icon} size={22} color="#FE5D9D" />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: "#09090B" }}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#6D6D78" />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
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

        <Text style={{ textAlign: "center", fontSize: 11, color: "#6D6D78", marginTop: 24 }}>
          Blyss v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
