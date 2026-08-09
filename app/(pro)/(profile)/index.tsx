import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet, Animated, Modal as RNModal, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import * as ImagePicker from "expo-image-picker";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useRevenueCat } from "@/contexts/RevenueCatContext";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/Card";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { proApi, usersApi, type User } from "@/lib/api";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { resolveMediaUrl } from "@/lib/media";

function calculateProfileCompleteness(user: User | null | undefined): number {
  if (!user) return 0;
  let score = 0;
  if (user.profile_photo) score += 10;
  if ((user.activity_name?.trim()?.length ?? 0) >= 2) score += 15;
  if ((user.city?.trim()?.length ?? 0) >= 2) score += 15;
  if ((user.bio?.trim()?.length ?? 0) >= 20) score += 15;
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
  const colors = useThemeColors();
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [contentOpacity]);

  useEffect(() => {
    if (!uploadSuccess) return;
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setUploadSuccess(false));
  }, [uploadSuccess]);

  const handlePickAvatar = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAvatarSheet(true);
  };

  const pickFromGallery = async () => {
    setShowAvatarSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
  };

  const pickFromCamera = async () => {
    setShowAvatarSheet(false);
    if (!Device.isDevice) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    const res = await usersApi.uploadProfilePhoto(uri);
    setUploading(false);
    if (!res.success) return;
    if (res.data?.photo) patchUser({ profile_photo: res.data.photo });
    void refreshProfile();
    setUploadSuccess(true);
  };

  const photoUri = resolveMediaUrl(user?.profile_photo);

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

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLogoutConfirm(true);
  };

  // Groupe compte et activité
  const accountItems: Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; route: string }> = [
    { icon: "person-outline", label: "Modifier mon profil", route: "/(pro)/(profile)/settings" },
    { icon: "briefcase-outline", label: "Mes prestations", route: "/(pro)/(profile)/services" },
    { icon: "trending-up-outline", label: "Finance", route: "/(pro)/(profile)/finance" },
    { icon: "card-outline", label: "Encaissements", route: "/(pro)/(profile)/payments" },
    // iOS only (Live Activities) — the screen itself also guards, but there's
    // no reason to surface an entry point Android users can't act on.
    ...(Platform.OS === "ios"
      ? [{ icon: "lock-closed-outline" as const, label: "Rendez-vous en direct", route: "/(pro)/(profile)/live-activity-settings" }]
      : []),
  ];

  // Groupe aide et données
  const supportItems: Array<{ icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; route: string }> = [
    { icon: "help-circle-outline", label: "Aide & support", route: "/(pro)/(profile)/help" },
    { icon: "shield-outline", label: "Mes données personnelles", route: "/(pro)/(profile)/rgpd" },
  ];

  return (
    <View style={{ flex: 1 }}>
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: colors.foreground, letterSpacing: -0.5 }}>
          Mon profil pro
        </Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
          Gère ton compte et ton activité
        </Text>
      </View>

      {/* Profile Card avec complétude */}
      <View style={{ marginBottom: 16 }}>
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>

            {/* Avatar avec badge caméra */}
            <Pressable onPress={handlePickAvatar}
              accessibilityRole="button"
              accessibilityLabel="Modifier la photo de profil"
              style={{ position: "relative", width: 72, height: 72 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 20,
                backgroundColor: withAlpha(colors.primary, 0.13),
                alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }}
                    style={{ width: 72, height: 72 }} />
                ) : (
                  <Text style={{
                    fontSize: 22, fontWeight: "700", color: colors.primary
                  }}>
                    {`${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`}
                  </Text>
                )}
                {uploading && (
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
            </Pressable>

            {/* Texte + barre */}
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 18, fontWeight: "700",
                color: colors.foreground, marginBottom: 2
              }}>
                {`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
                  || "Profil Pro"}
              </Text>
              <Text style={{
                fontSize: 14, color: colors.mutedForeground, marginBottom: 10
              }}>
                {user?.activity_name?.trim() || "Non renseignée"}
              </Text>
              {/* Barre de progression fine */}
              <View style={{
                height: 4, backgroundColor: colors.muted,
                borderRadius: 2, overflow: "hidden", marginBottom: 6,
              }}>
                <View
                  style={{
                    height: "100%",
                    width: `${profileCompleteness}%`,
                    borderRadius: 2,
                    backgroundColor: colors.primary,
                  }}
                />
              </View>
              <Text style={{
                fontSize: 12, color: colors.mutedForeground
              }}>
                {`Profil complété à ${profileCompleteness}%`}
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
                renderIcon: () => <Ionicons name="people-outline" size={16} color={colors.primary} />,
                value: user?.clients_count != null ? String(user.clients_count) : "—",
                label: `Client${(user?.clients_count ?? 0) > 1 ? "es" : "e"}`,
              },
              {
                renderIcon: () => <Ionicons name="star-outline" size={16} color={colors.primary} />,
                value: user?.avg_rating != null ? Number(user.avg_rating).toFixed(1) : "—",
                label: "Note moy.",
              },
              {
                renderIcon: () => <Ionicons name="trending-up-outline" size={16} color={colors.primary} />,
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
                  borderRightColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: `${colors.primary}18`,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                  }}
                >
                  {stat.renderIcon()}
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.foreground, letterSpacing: -0.5 }}>
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      {/* Abonnement card */}
      <View style={{ marginBottom: 20 }}>
        <AnimatedPressable
          onPress={() => router.push("/pro-subscription")}
          style={{ borderRadius: 16, overflow: "hidden" }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: `${colors.primary}33`,
              shadowColor: colors.primary,
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
                backgroundColor: `${colors.primary}06`,
              }}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: withAlpha(colors.primary, 0.07),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="card-outline" size={18} color={colors.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>
                    Mon abonnement
                  </Text>
                  {subscription?.status === "active" && (
                    <View style={{
                      flexDirection: "row", alignItems: "center", gap: 4,
                      backgroundColor: colors.successLight, borderRadius: 999,
                      paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
                    }}>
                      <Ionicons name="checkmark-circle-outline" size={12} color={colors.successTextDark} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.successTextDark }}>Actif</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, fontWeight: "500" }}>
                  {currentPlanLabel}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </View>
          </View>
        </AnimatedPressable>
      </View>

      {/* Profil public */}
      <View style={{ marginBottom: 20 }}>
        <AnimatedPressable
          onPress={() => router.push("/(pro)/(profile)/public-profile")}
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: withAlpha(colors.primary, 0.07),
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                Profil public
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                Vu par tes clientes
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{
                width: 30, height: 30, borderRadius: 8,
                backgroundColor: colors.muted,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="create-outline" size={15} color={colors.mutedForeground} />
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "nowrap", gap: 6, overflow: "hidden" }}>
            {user?.city ? (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                alignSelf: "flex-start", backgroundColor: colors.muted,
                borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6,
              }}>
                <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                <Text numberOfLines={1} style={{ fontSize: 11, color: colors.mutedForeground }}>
                  {user.city}
                </Text>
              </View>
            ) : null}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              alignSelf: "flex-start",
              backgroundColor: user?.instagram_account ? `${colors.primary}15` : colors.muted,
              borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6,
            }}>
              <Ionicons name="logo-instagram" size={12} color={user?.instagram_account ? colors.primary : colors.mutedForeground} />
              <Text numberOfLines={1} style={{ fontSize: 11, color: user?.instagram_account ? colors.primary : colors.mutedForeground }}>
                {user?.instagram_account || "Non renseigné"}
              </Text>
            </View>
            {profileCompleteness < 100 ? (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                alignSelf: "flex-start", backgroundColor: withAlpha(colors.primary, 0.08),
                borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6,
              }}>
                <Ionicons name="trending-up-outline" size={11} color={colors.primary} />
                <Text numberOfLines={1} style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>
                  Compléter
                </Text>
              </View>
            ) : null}
          </View>
        </AnimatedPressable>
      </View>

      {/* Menu — groupe compte et activité */}
      <View style={{ marginBottom: 16, backgroundColor: colors.card, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
        {accountItems.map((item, idx) => (
          <View key={item.label}>
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
            {idx < accountItems.length - 1 && (
              <View style={{ height: 1, marginLeft: 74, backgroundColor: colors.border }} />
            )}
          </View>
        ))}
      </View>

      {/* Menu — groupe aide et données */}
      <View style={{ marginBottom: 16, backgroundColor: colors.card, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
        {supportItems.map((item, idx) => (
          <View key={item.label}>
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
            {idx < supportItems.length - 1 && (
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
            <Pressable
              onPress={() => router.push("/(admin)/dashboard" as any)}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 6, backgroundColor: colors.admin, borderRadius: 10, paddingVertical: 10,
              }}
            >
              <Ionicons name="grid" size={15} color={colors.onColor} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onColor }}>Admin</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(client)" as any)}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingVertical: 10,
              }}
            >
              <Ionicons name="person-outline" size={15} color="rgba(255,255,255,0.7)" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>Vue Client</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/pro-subscription-success" as any,
                params: { plan: "signature", preview: "1" },
              })
            }
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10,
              paddingVertical: 10, marginTop: 8,
            }}
          >
            <Ionicons name="play-outline" size={15} color="rgba(255,255,255,0.7)" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>
              Aperçu onboarding (confirmation → fin)
            </Text>
          </Pressable>
        </View>
      )}

      {/* Menu — zone danger */}
      <View style={{ marginBottom: 16, backgroundColor: colors.card, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: withAlpha(colors.destructive, 0.13) }}>
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
    </Animated.View>

    {/* Toast upload succès */}
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", bottom: insets.bottom + 110,
        alignSelf: "center", opacity: toastOpacity,
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: colors.success, borderRadius: 999,
        paddingHorizontal: 18, paddingVertical: 10,
        shadowColor: colors.success, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
      }}
    >
      <Ionicons name="checkmark-circle" size={18} color={colors.onColor} />
      <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>
        Photo mise à jour
      </Text>
    </Animated.View>

    {/* Avatar action sheet */}
    <RNModal visible={showAvatarSheet} transparent animationType="slide" onRequestClose={() => setShowAvatarSheet(false)}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlayDark }} onPress={() => setShowAvatarSheet(false)} accessibilityRole="button" accessibilityLabel="Fermer" />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 12 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.mutedForeground, textAlign: "center", marginBottom: 8 }}>Photo de profil</Text>
        {[
          { label: "Prendre une photo", icon: "camera-outline" as const, onPress: pickFromCamera },
          { label: "Choisir depuis la galerie", icon: "image-outline" as const, onPress: pickFromGallery },
        ].map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 24, paddingVertical: 16 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>{item.label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setShowAvatarSheet(false)}
          style={{ marginHorizontal: 20, marginTop: 8, height: 44, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Annuler</Text>
        </Pressable>
      </View>
    </RNModal>

    {/* Logout confirmation sheet */}
    <RNModal visible={showLogoutConfirm} transparent animationType="slide" onRequestClose={() => setShowLogoutConfirm(false)}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlayDark }} onPress={() => setShowLogoutConfirm(false)} accessibilityRole="button" accessibilityLabel="Fermer" />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
        <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground, marginBottom: 6 }}>Déconnexion</Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 24 }}>Es-tu sûr(e) de vouloir te déconnecter ?</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setShowLogoutConfirm(false)}
            style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Non</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              setShowLogoutConfirm(false);
              void logout().then(() => router.replace("/(auth)/login"));
            }}
            style={{ flex: 1, height: 48, borderRadius: 14, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.onColor }}>Se déconnecter</Text>
          </Pressable>
        </View>
      </View>
    </RNModal>
    </View>
  );
}
