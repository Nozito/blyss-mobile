import React, { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useActionSheet } from "@/components/ui/ActionSheet";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { usersApi } from "@/lib/api";
import { Shadows } from "@/constants/shadows";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { resolveMediaUrl } from "@/lib/media";

// Groupe compte
const ACCOUNT_ITEMS = [
  { icon: "settings-outline" as const, label: "Paramètres", route: "/(client)/(profile)/settings" },
  // #34 — reprendre / revoir l'onboarding nails
  { icon: "sparkles-outline" as const, label: "Découverte nails", route: "/client-onboarding?from=settings" },
] as const;

// Groupe support
const SUPPORT_ITEMS = [
  { icon: "help-circle-outline" as const, label: "Aide", route: "/(client)/(profile)/help" },
  { icon: "shield-outline" as const, label: "RGPD", route: "/(client)/(profile)/rgpd" },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user, logout, refreshProfile, patchUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const showActionSheet = useActionSheet();

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
    const hasPhoto = !!user?.profile_photo;
    const options = hasPhoto
      ? ["Annuler", "Galerie", "Caméra", "Supprimer la photo"]
      : ["Annuler", "Galerie", "Caméra"];
    showActionSheet(
      { title: "Photo de profil", options, cancelButtonIndex: 0, destructiveButtonIndex: hasPhoto ? 3 : undefined },
      (idx) => {
        if (idx === 1) void pickFromGallery();
        else if (idx === 2) void pickFromCamera();
        else if (idx === 3 && hasPhoto) void deletePhoto();
      }
    );
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
  const photoUrl = resolveMediaUrl(user?.profile_photo) ?? null;

  const profileCompleteness = (() => {
    let score = 60;
    if (user?.profile_photo) score += 20;
    if ((user as Record<string, unknown> | null)?.phone_number) score += 20;
    return score;
  })();

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
            Mon profil
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>
            Gère ton compte Blyss
          </Text>
        </View>

        {/* Profile card */}
        <View
          style={{
            backgroundColor: colors.white,
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
          <AnimatedPressable onPress={handlePickAvatar}
            accessibilityLabel="Modifier la photo de profil"
            style={{ position: "relative", width: 72, height: 72 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 20,
              backgroundColor: withAlpha(colors.primary, 0.13),
              alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: 72, height: 72 }} contentFit="cover" />
              ) : (
                <Text style={{ fontSize: 22, fontWeight: "700", color: colors.primary }}>
                  {`${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`}
                </Text>
              )}
              {(uploading || deleting) && (
                <View style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: colors.overlayDark,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <ActivityIndicator color={colors.onColor} size="small" />
                </View>
              )}
            </View>
            {/* Badge caméra réduit, fond blanc */}
            <View style={{
              position: "absolute", bottom: -2, right: -2,
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.white,
              alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: colors.border,
              shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
            }}>
              <Ionicons name="camera" size={12} color={colors.mutedForeground} />
            </View>
          </AnimatedPressable>

          {/* Nom + sous-titre + barre */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 2 }}>
              {displayName || "Profil"}
            </Text>
            {user?.email && (
              <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 10 }}>
                {user.email}
              </Text>
            )}
            {/* Barre de progression fine */}
            <View style={{ height: 4, backgroundColor: colors.muted, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
              <View
                style={{ height: "100%", width: `${profileCompleteness}%`, borderRadius: 2, backgroundColor: colors.primary }}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {`Profil complété à ${profileCompleteness}%`}
            </Text>
          </View>
        </View>

        {uploadError && (
          <View style={{ marginBottom: 12 }}>
            <ErrorMessage message={uploadError} />
          </View>
        )}

        {/* Menu — groupe compte */}
        <View style={{ marginBottom: 16, backgroundColor: colors.white, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
          {ACCOUNT_ITEMS.map((item, i) => (
            <View key={item.route}>
              <AnimatedPressable
                onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 18,
                  paddingHorizontal: 20,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: withAlpha(colors.primary, 0.07),
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, marginLeft: 14, fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </AnimatedPressable>
              {i < ACCOUNT_ITEMS.length - 1 && (
                <View style={{ height: 1, marginLeft: 74, backgroundColor: colors.border }} />
              )}
            </View>
          ))}
        </View>

        {/* Menu — groupe support */}
        <View style={{ marginBottom: 16, backgroundColor: colors.white, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
          {SUPPORT_ITEMS.map((item, i) => (
            <View key={item.route}>
              <AnimatedPressable
                onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 18,
                  paddingHorizontal: 20,
                }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: withAlpha(colors.primary, 0.07),
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <Text style={{ flex: 1, marginLeft: 14, fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </AnimatedPressable>
              {i < SUPPORT_ITEMS.length - 1 && (
                <View style={{ height: 1, marginLeft: 74, backgroundColor: colors.border }} />
              )}
            </View>
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
              <Ionicons name="shield-checkmark" size={14} color={colors.admin} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.admin, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Vue administrateur
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AnimatedPressable
                onPress={() => router.push("/(admin)/dashboard" as any)}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, backgroundColor: colors.admin, borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Ionicons name="grid" size={15} color={colors.onColor} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onColor }}>Admin</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => router.push("/(pro)/dashboard" as any)}
                style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingVertical: 10,
                }}
              >
                <Ionicons name="briefcase-outline" size={15} color="rgba(255,255,255,0.7)" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>Vue Pro</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Menu — zone danger */}
        <View style={{ marginBottom: 16, backgroundColor: colors.white, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: withAlpha(colors.destructive, 0.13) }}>
          <AnimatedPressable
            onPress={handleLogout}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 18,
              paddingHorizontal: 20,
            }}
          >
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: withAlpha(colors.destructive, 0.07),
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
            </View>
            <Text style={{ flex: 1, marginLeft: 14, fontSize: 15, fontWeight: "700", color: colors.destructive }}>
              Se déconnecter
            </Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
