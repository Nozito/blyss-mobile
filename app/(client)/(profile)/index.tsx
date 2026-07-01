import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, ActionSheetIOS, Platform, ActivityIndicator, StyleSheet } from "react-native";
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
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Colors } from "@/constants/colors";

const MENU_ITEMS = [
  { icon: "settings-outline" as const, label: "Paramètres", route: "/(client)/(profile)/settings" },
  { icon: "card-outline" as const, label: "Méthodes de paiement", route: "/(client)/(profile)/payments" },
  { icon: "help-circle-outline" as const, label: "Aide", route: "/(client)/(profile)/help" },
  { icon: "shield-outline" as const, label: "RGPD", route: "/(client)/(profile)/rgpd" },
] as const;

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshProfile, patchUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
  };

  const pickFromCamera = async () => {
    if (!Device.isDevice) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
  };

  const handlePickAvatar = () => {
    if (Platform.OS === "ios") {
      const hasPhoto = !!user?.profile_photo;
      const options = hasPhoto
        ? ["Annuler", "Galerie", "Caméra", "Supprimer la photo"]
        : ["Annuler", "Galerie", "Caméra"];
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Photo de profil", options, cancelButtonIndex: 0, destructiveButtonIndex: hasPhoto ? 3 : undefined },
        (idx) => {
          if (idx === 1) void pickFromGallery();
          else if (idx === 2) void pickFromCamera();
          else if (idx === 3 && hasPhoto) void deletePhoto();
        }
      );
    } else {
      void pickFromGallery();
    }
  };

  const deletePhoto = async () => {
    setUploadError(null);
    setDeleting(true);
    const res = await usersApi.deleteProfilePhoto();
    setDeleting(false);
    if (!res.success) {
      setUploadError("Impossible de supprimer la photo.");
      return;
    }
    patchUser({ profile_photo: null });
    void refreshProfile();
  };

  const uploadPhoto = async (uri: string) => {
    setUploadError(null);
    setUploading(true);
    const res = await usersApi.uploadProfilePhoto(uri);
    setUploading(false);
    if (!res.success) {
      setUploadError(res.error ?? "Impossible de mettre à jour la photo.");
      return;
    }
    if (res.data?.photo) patchUser({ profile_photo: res.data.photo });
    void refreshProfile();
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

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
            Mon profil
          </Text>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginTop: 4 }}>
            Gère ton compte Blyss
          </Text>
        </View>

        {/* Profile card */}
        <View
          style={{
            backgroundColor: Colors.white,
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
                <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.primary }}>
                  {`${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`}
                </Text>
              )}
              {(uploading || deleting) && (
                <View style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: Colors.overlayDark,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <ActivityIndicator color={Colors.white} size="small" />
                </View>
              )}
            </View>
            {/* Badge caméra */}
            <View style={{
              position: "absolute", bottom: -4, right: -4,
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: Colors.primary,
              alignItems: "center", justifyContent: "center",
              shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
            }}>
              <Ionicons name="camera" size={12} color={Colors.white} />
            </View>
          </Pressable>

          {/* Nom + sous-titre + barre */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground, marginBottom: 2 }}>
              {displayName || "Profil"}
            </Text>
            {user?.email && (
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 10 }}>
                {user.email}
              </Text>
            )}
            {/* Completeness bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, height: 4, backgroundColor: "#F0F0F0", borderRadius: 2, overflow: "hidden" }}>
                <LinearGradient
                  colors={[Colors.primary, "#FE5D9D99"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: "100%", width: `${profileCompleteness}%`, borderRadius: 2 }}
                />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.primary }}>
                {profileCompleteness}%
              </Text>
            </View>
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 3 }}>
              Profil complété
            </Text>
          </View>
        </View>

        {uploadError && (
          <View style={{ marginBottom: 12 }}>
            <ErrorMessage message={uploadError} />
          </View>
        )}

        {/* Menu items */}
        <View
          style={{
            backgroundColor: Colors.white,
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
                <Ionicons name={item.icon} size={22} color={Colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: Colors.foreground }}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        {/* Admin switcher — admin only */}
        {user?.is_admin && (
          <View style={{
            backgroundColor: "#0A0A0F",
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: "rgba(249,115,22,0.30)",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.admin} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.admin, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Vue administrateur
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => router.push("/(admin)/dashboard" as any)}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, backgroundColor: Colors.admin, borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Ionicons name="grid" size={15} color={Colors.white} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.white }}>Admin</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/(pro)/dashboard" as any)}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Ionicons name="briefcase-outline" size={15} color="rgba(255,255,255,0.7)" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>Vue Pro</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={{
            backgroundColor: Colors.white,
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
              backgroundColor: Colors.destructiveLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
          </View>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: Colors.destructive }}>
            Se déconnecter
          </Text>
        </Pressable>

        <Text style={{ textAlign: "center", fontSize: 11, color: Colors.mutedForeground, marginTop: 24 }}>
          Blyss v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
