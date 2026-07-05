import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Animated,
  ActivityIndicator,
  Modal,
  Share,
  Linking,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Clipboard } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { proApi, usersApi, instagramApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { proProfileSchema } from "@/lib/validation";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const SCREEN_W = Dimensions.get("window").width;
const GALLERY_CELL = (SCREEN_W - 40 - 8) / 3;

type Service = { id: number; name: string; price: number; duration_minutes: number; active?: boolean };
type GalleryImage = { id: number; url: string; thumbnail: string; created_at: string };

const MAX_BIO = 300;
const MAX_GALLERY = 20;

export default function ProPublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, patchUser, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  const [bannerUploading, setBannerUploading] = useState(false);

  // Gallery state
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  // Share state
  const [copyToast, setCopyToast] = useState(false);

  // Instagram
  const [igImporting, setIgImporting] = useState<string | null>(null);
  const [igError, setIgError] = useState<string | null>(null);

  const { data: galleryData, refetch: refetchGallery } = useQuery({
    queryKey: ["pro-gallery"],
    queryFn: () => proApi.getGallery(),
  });
  const gallery: GalleryImage[] = (galleryData?.data as GalleryImage[] | undefined) ?? [];

  const { data: igStatusData } = useQuery({
    queryKey: ["ig-status"],
    queryFn: () => instagramApi.getStatus(),
  });
  const igConnected = igStatusData?.data?.connected ?? false;
  const igUsername = igStatusData?.data?.username;

  const { data: igFeedData } = useQuery({
    queryKey: ["ig-feed"],
    queryFn: () => instagramApi.getFeed(),
    enabled: igConnected,
  });
  const igPhotos = igFeedData?.data?.photos ?? [];

  const profileUrl = user?.id
    ? `https://blyssapp.fr/s/${user.id}`
    : "https://blyssapp.fr";

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
  const bannerUri = user?.banner_photo
    ? user.banner_photo.startsWith("http")
      ? user.banner_photo
      : `${API_URL}${user.banner_photo}`
    : undefined;

  const handlePickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setBannerUploading(true);
    const res = await usersApi.uploadBannerPhoto(result.assets[0].uri);
    setBannerUploading(false);
    if (!res.success) return;
    if (res.data?.banner_photo) patchUser({ banner_photo: res.data.banner_photo });
    void refreshProfile();
  };

  const handleAddGalleryPhoto = async () => {
    if (gallery.length >= MAX_GALLERY) { setGalleryError(`Maximum ${MAX_GALLERY} photos.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setGalleryUploading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await proApi.uploadGallery(result.assets[0].uri);
    setGalleryUploading(false);
    if (!res.success) { setGalleryError(res.error ?? "Impossible d'ajouter la photo."); return; }
    void refetchGallery();
  };

  const handleDeleteGalleryPhoto = async (img: GalleryImage) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGalleryImage(null);
    try { // BLYSS-NAV: was unhandled — errors silently swallowed
      await proApi.deleteGallery(img.id);
      void refetchGallery();
    } catch {
      setGalleryError("Impossible de supprimer la photo."); // BLYSS-NAV: surface delete error
    }
  };

  const handleCopyLink = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Clipboard.setString(profileUrl);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  const handleShareLink = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ url: profileUrl, message: `Réservez avec moi sur Blyss : ${profileUrl}` });
  };

  const handleImportIgPhoto = async (photoId: string) => {
    setIgImporting(photoId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await instagramApi.importPhoto(photoId);
    setIgImporting(null);
    if (!res.success) { setIgError("Impossible d'importer cette photo."); return; }
    void refetchGallery();
  };

  const handleDisconnectIg = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await instagramApi.disconnect();
    qc.invalidateQueries({ queryKey: ["ig-status"] });
    qc.invalidateQueries({ queryKey: ["ig-feed"] });
  };

  const handleConnectIg = () => {
    const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "";
    void Linking.openURL(`${apiBase}/api/auth/instagram?redirect=blyss://instagram-callback`);
  };

  const [activityName, setActivityName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [instagramError, setInstagramError] = useState<string | undefined>();
  const [isPublic, setIsPublic] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [initial, setInitial] = useState({
    activityName: "", city: "", bio: "", instagram: "", isPublic: true,
  });

  const { data: servicesData } = useQuery({
    queryKey: ["pro-services"],
    queryFn: () => proApi.getServices(),
  });
  const services = ((servicesData?.data as Service[] | undefined) ?? []).filter((s) => s.active !== false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["pro-public-profile"],
    queryFn: async () => {
      const res = await proApi.getProfile();
      return res?.data ?? null;
    },
  });

  // TanStack Query v5 removed useQuery's onSuccess — pre-fill the form on data arrival instead.
  useEffect(() => {
    if (!profileData) return;
    const vals = {
      activityName: profileData.activity_name || "",
      city: profileData.city || "",
      bio: profileData.bio || "",
      instagram: profileData.instagram_account || "",
      isPublic: profileData.profile_visibility !== "private",
    };
    setActivityName(vals.activityName);
    setCity(vals.city);
    setBio(vals.bio);
    setInstagram(vals.instagram);
    setIsPublic(vals.isPublic);
    setInitial(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData]);

  useEffect(() => {
    const changed =
      activityName !== initial.activityName ||
      city !== initial.city ||
      bio !== initial.bio ||
      instagram !== initial.instagram ||
      isPublic !== initial.isPublic;
    setHasChanges(changed);
  }, [activityName, city, bio, instagram, isPublic, initial]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setSaveError(null);

    const parsed = proProfileSchema.safeParse({ activityName, city, bio, instagram });
    if (!parsed.success) {
      setSaveError(parsed.error.errors[0]?.message ?? "Champ invalide.");
      return;
    }
    if (instagram && instagramError) { setSaveError(instagramError ?? "Handle Instagram invalide."); return; }

    setIsSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await proApi.updateProfile({
        activity_name: activityName,
        city,
        bio,
        instagram_account: instagram,
        profile_visibility: isPublic ? "public" : "private",
      });
      qc.invalidateQueries({ queryKey: ["pro-public-profile"] });
      setInitial({ activityName, city, bio, instagram, isPublic });
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setSaveError("Impossible de mettre à jour le profil.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isLoading || reduceMotion) return;
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [isLoading, reduceMotion, contentOpacity]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <AnimatedIconButton
              onPress={() => safeBack(router)}
              className="w-10 h-10 rounded-xl bg-muted items-center justify-center mr-3"
            >
              <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
            </AnimatedIconButton>
            <Text className="text-2xl font-bold text-foreground flex-1">Profil public</Text>
            <Pressable
              onPress={() => setShowPreview(true)}
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${Colors.primary}15` }}
            >
              <Ionicons name="eye-outline" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          <Text className="text-sm text-muted-foreground ml-1">
            Informations visibles par tes clientes
          </Text>
        </View>

        {/* Unsaved changes banner */}
        {hasChanges && (
          <View
            className="bg-card rounded-2xl p-4 mb-4 flex-row items-center gap-3 border"
            style={{ borderColor: `${Colors.primary}40`, backgroundColor: `${Colors.primary}08` }}
          >
            <Ionicons name="alert-circle-outline" size={18} color={Colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Modifications non enregistrées</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">N'oublie pas de sauvegarder tes changements</Text>
            </View>
          </View>
        )}

        {/* Info card */}
        <View
          className="bg-card rounded-2xl p-4 mb-6 flex-row items-start gap-4 border border-border"
          style={{ shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: Colors.primary }}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.white} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground mb-1">Optimise ton profil</Text>
            <Text className="text-sm text-muted-foreground leading-relaxed">
              Un profil complet et détaillé augmente tes chances d'être réservée de 3×.
            </Text>
          </View>
        </View>

        {/* Section: Bannière */}
        <View className="mb-6">
          <SectionTitle title="Photo de couverture" />
          <Pressable
            onPress={handlePickBanner}
            style={{
              height: 140,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: "#F3F4F6",
              borderWidth: 1.5,
              borderColor: Colors.border,
              borderStyle: "dashed",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {bannerUri ? (
              <Image
                source={{ uri: bannerUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ alignItems: "center", gap: 8 }}>
                <Ionicons name="image-outline" size={32} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
                  Ajouter une photo de couverture
                </Text>
              </View>
            )}
            {/* BLYSS-FIX: 2.4 — full overlay during upload */}
            {bannerUploading ? (
              <View style={{
                position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center", justifyContent: "center",
              }}>
                <ActivityIndicator size="large" color={Colors.white} />
              </View>
            ) : (
              <View style={{
                position: "absolute", bottom: 8, right: 8,
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="camera-outline" size={16} color={Colors.white} />
              </View>
            )}
          </Pressable>
        </View>

        {/* Section: Infos principales */}
        <View className="mb-6">
          <SectionTitle title="Informations principales" />
          <View className="bg-card rounded-2xl p-5 border border-border gap-4">
            <View style={{ gap: 4 }}>
              <Input
                label="Nom de l'activité *"
                value={activityName}
                onChangeText={setActivityName}
                placeholder="Ex : Nails by Emma"
                leftIcon="person-outline"
                maxLength={100}
                autoCapitalize="words"
                hint="Le nom sous lequel tes clientes te trouveront sur Blyss."
              />
            </View>
            <Input
              label="Ville / Zone *"
              value={city}
              onChangeText={setCity}
              placeholder="Ex : Paris 11e, Lyon centre"
              leftIcon="location-outline"
              maxLength={100}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Section: Bio */}
        <View className="mb-6">
          <SectionTitle title="À propos de toi" />
          <View className="bg-card rounded-2xl p-5 border border-border">
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#3F3F46", letterSpacing: 0.1 }}>Biographie</Text>
              <TextInput
                placeholder="Parle de ton parcours, tes spécialités, ce qui te passionne..."
                placeholderTextColor={Colors.inputPlaceholder}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, MAX_BIO))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={MAX_BIO}
                style={{
                  backgroundColor: Colors.cream,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: Colors.border,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14.5,
                  color: Colors.foreground,
                  minHeight: 100,
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11.5, color: "#A1A1AA" }}>Aide tes clientes à mieux te connaître</Text>
                <Text style={{ fontSize: 11.5, color: bio.length > MAX_BIO - 50 ? Colors.destructive : "#A1A1AA" }}>
                  {MAX_BIO - bio.length}/{MAX_BIO}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Réseaux sociaux */}
        <View className="mb-6">
          <SectionTitle title="Réseaux sociaux" />
          <View className="bg-card rounded-2xl p-5 border border-border">
            <Input
              label="Instagram (optionnel)"
              value={instagram}
              onChangeText={(raw) => {
                // Auto-prefix @ and enforce strict format
                let val = raw.trim();
                if (val && !val.startsWith("@")) val = `@${val}`;
                setInstagram(val);
                if (!val) { setInstagramError(undefined); return; }
                const handle = val.slice(1); // strip leading @
                if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle) || handle.includes("..")) {
                  setInstagramError("Format invalide. Ex : @toncompte (lettres, chiffres, _ ou .)");
                } else {
                  setInstagramError(undefined);
                }
              }}
              placeholder="@toncompte"
              leftIcon="logo-instagram"
              autoCapitalize="none"
              maxLength={31}
              error={instagramError}
              hint="Ton compte Instagram sera affiché sur ton profil Blyss."
            />
          </View>
        </View>

        {/* Section: Galerie de réalisations */}
        <View className="mb-6">
          <SectionTitle title="Galerie de réalisations" />
          {galleryError && (
            <View style={{ marginBottom: 8 }}><ErrorMessage message={galleryError} /></View>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {gallery.map((img) => (
              <Pressable
                key={img.id}
                onPress={() => setSelectedGalleryImage(img)}
                style={{ width: GALLERY_CELL, height: GALLERY_CELL, borderRadius: 10, overflow: "hidden", backgroundColor: Colors.muted }}
              >
                <Image source={{ uri: img.thumbnail || img.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </Pressable>
            ))}
            {gallery.length < MAX_GALLERY && (
              <Pressable
                onPress={handleAddGalleryPhoto}
                disabled={galleryUploading}
                style={{ width: GALLERY_CELL, height: GALLERY_CELL, borderRadius: 10, backgroundColor: Colors.muted, borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}
              >
                {galleryUploading
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Ionicons name="add" size={28} color={Colors.mutedForeground} />}
              </Pressable>
            )}
          </View>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 6, paddingHorizontal: 2 }}>
            {gallery.length}/{MAX_GALLERY} photos
          </Text>
        </View>

        {/* Section: Instagram */}
        <View className="mb-6">
          <SectionTitle title="Photos Instagram" />
          <View className="bg-card rounded-2xl border border-border overflow-hidden">
            {igConnected ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                  <Ionicons name="logo-instagram" size={20} color={Colors.primary} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: Colors.foreground }}>
                    {igUsername ? `@${igUsername}` : "Connecté"}
                  </Text>
                  <Pressable
                    onPress={handleDisconnectIg}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: Colors.destructive }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.destructive }}>Déconnecter</Text>
                  </Pressable>
                </View>
                {igError && <View style={{ padding: 12 }}><ErrorMessage message={igError} /></View>}
                {igPhotos.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {igPhotos.slice(0, 9).map((photo) => (
                      <Pressable
                        key={photo.id}
                        onPress={() => void handleImportIgPhoto(photo.id)}
                        disabled={igImporting === photo.id}
                        style={{ width: "33.333%", aspectRatio: 1, position: "relative" }}
                      >
                        <Image source={{ uri: photo.thumbnail || photo.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        {igImporting === photo.id && (
                          <View style={{ ...require("react-native").StyleSheet.absoluteFillObject, backgroundColor: Colors.overlayDark, alignItems: "center", justifyContent: "center" }}>
                            <ActivityIndicator size="small" color={Colors.white} />
                          </View>
                        )}
                        <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: Colors.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 8, fontWeight: "800", color: Colors.white }}>IG</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={{ padding: 20, alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Aucune photo disponible</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={{ padding: 20, alignItems: "center", gap: 12 }}>
                <Ionicons name="logo-instagram" size={36} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground, textAlign: "center" }}>
                  Importez vos réalisations directement depuis Instagram
                </Text>
                <Pressable
                  onPress={handleConnectIg}
                  style={{ height: 44, paddingHorizontal: 24, borderRadius: 14, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Connecter Instagram</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Section: Lien de partage */}
        <View className="mb-6">
          <SectionTitle title="Votre lien professionnel" />
          <View style={{ backgroundColor: Colors.primaryLight, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: `${Colors.primary}30` }}>
            {copyToast && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute", top: -10, left: 16,
                  backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12,
                  shadowColor: Colors.success, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.white }}>Lien copié !</Text>
              </View>
            )}
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 4 }}>Ton profil Blyss</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.primary, marginBottom: 14 }} numberOfLines={1}>{profileUrl}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <AnimatedPressable
                onPress={handleCopyLink}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: `${Colors.primary}30` }}
              >
                <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.primary }}>Copier</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleShareLink}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Ionicons name="share-outline" size={16} color={Colors.white} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.white }}>Partager</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        {/* Section: Visibilité */}
        <View className="mb-6">
          <SectionTitle title="Visibilité du profil" />
          <View className="bg-card rounded-2xl p-5 border border-border">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-row items-start gap-3 flex-1">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: isPublic ? `${Colors.primary}15` : Colors.muted }}
                >
                  <Ionicons
                    name={isPublic ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color={isPublic ? Colors.primary : Colors.mutedForeground}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    Profil {isPublic ? "public" : "privé"}
                  </Text>
                  <Text className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {isPublic
                      ? "Ton profil est visible par toutes les clientes sur Blyss."
                      : "Ton profil n'est visible que par toi."}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      </Animated.View>

      {/* Sticky save button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-2"
        style={{ paddingBottom: insets.bottom + 12, backgroundColor: "rgba(255,234,241,0.95)" }}
      >
        {saveError && <View style={{ marginBottom: 8 }}><ErrorMessage message={saveError} /></View>}
        {saveSuccess && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.successLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.successText }}>Profil public mis à jour !</Text>
          </View>
        )}
        <AnimatedPressable
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          className="h-14 rounded-2xl items-center justify-center flex-row gap-2"
          style={{
            backgroundColor: hasChanges ? Colors.primary : Colors.muted,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : hasChanges ? (
            <>
              <Ionicons name="save-outline" size={18} color={Colors.white} />
              <Text className="text-white font-bold text-base">Enregistrer le profil public</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={Colors.mutedForeground} />
              <Text className="font-semibold text-sm text-muted-foreground">Profil à jour</Text>
            </>
          )}
        </AnimatedPressable>
      </View>

      {/* Gallery image detail modal */}
      <Modal visible={selectedGalleryImage != null} transparent animationType="fade" onRequestClose={() => setSelectedGalleryImage(null)}>
        {selectedGalleryImage && (
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}>
            <Pressable style={{ position: "absolute", top: insets.top + 16, right: 16, zIndex: 10 }} onPress={() => setSelectedGalleryImage(null)}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color={Colors.white} />
              </View>
            </Pressable>
            <Image
              source={{ uri: selectedGalleryImage.url }}
              style={{ width: SCREEN_W - 40, height: SCREEN_W - 40, borderRadius: 16 }}
              resizeMode="cover"
            />
            <Pressable
              onPress={() => handleDeleteGalleryPhoto(selectedGalleryImage)}
              style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: Colors.destructive }}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.white} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Supprimer</Text>
            </Pressable>
          </View>
        )}
      </Modal>

      {/* Preview modal */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View
            className="flex-row items-center justify-between px-5 border-b border-border"
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Text className="font-bold text-foreground text-base">Aperçu profil public</Text>
            <Pressable
              onPress={() => setShowPreview(false)}
              className="w-8 h-8 rounded-full bg-muted items-center justify-center"
            >
              <Ionicons name="close" size={18} color={Colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Profile preview */}
            <View className="items-center mb-6">
              {bannerUri && (
                <Image
                  source={{ uri: bannerUri }}
                  style={{ width: "100%", height: 100, borderRadius: 12, marginBottom: 12 }}
                  resizeMode="cover"
                />
              )}
              <View
                className="w-20 h-20 rounded-2xl items-center justify-center mb-3"
                style={{ backgroundColor: `${Colors.primary}20` }}
              >
                <Text className="text-3xl font-bold" style={{ color: Colors.primary }}>
                  {(activityName || user?.first_name || "P")[0]}
                </Text>
              </View>
              <Text className="text-xl font-bold text-foreground text-center">
                {activityName || "Nom de l'activité"}
              </Text>
              {user?.pro_specialties?.[0] ? (
                <Text className="text-sm text-muted-foreground mt-1">
                  {user.pro_specialties[0]}
                </Text>
              ) : null}
              {city ? (
                <View className="flex-row items-center gap-1 mt-2">
                  <Ionicons name="location-outline" size={14} color={Colors.mutedForeground} />
                  <Text className="text-sm text-muted-foreground">{city}</Text>
                </View>
              ) : null}
              {instagram ? (
                <Text className="text-sm mt-1" style={{ color: Colors.primary }}>
                  {instagram.startsWith("@") ? instagram : `@${instagram}`}
                </Text>
              ) : null}
            </View>

            {bio ? (
              <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
                <Text className="text-base font-bold text-foreground mb-2">À propos</Text>
                <Text className="text-sm text-muted-foreground leading-relaxed">{bio}</Text>
              </View>
            ) : null}

            {/* Prestations */}
            {services.length > 0 && (
              <View className="bg-card rounded-2xl p-4 mb-4 border border-border">
                <Text className="text-base font-bold text-foreground mb-3">Prestations</Text>
                <View style={{ gap: 10 }}>
                  {services.slice(0, 5).map((s) => (
                    <View key={s.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>{s.name}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <Ionicons name="time-outline" size={11} color={Colors.mutedForeground} />
                          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{s.duration_minutes} min</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.primary }}>
                        {(typeof s.price === "number" ? s.price : parseFloat(String(s.price ?? "0"))).toFixed(2)} €
                      </Text>
                    </View>
                  ))}
                  {services.length > 5 && (
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>
                      +{services.length - 5} autres prestations
                    </Text>
                  )}
                </View>
              </View>
            )}

            {!isPublic && (
              <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-red-100 items-center justify-center">
                    <Ionicons name="eye-off-outline" size={18} color={Colors.destructiveText} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">Profil actuellement privé</Text>
                    <Text className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      Ton profil n'est pas visible par les clientes.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setShowPreview(false)}
              style={{
                height: 56, borderRadius: 20,
                backgroundColor: Colors.primary,
                alignItems: "center", justifyContent: "center",
                flexDirection: "row", gap: 8,
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={Colors.white} />
              <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 15 }}>Réserver</Text>
            </Pressable>
            <Pressable onPress={() => setShowPreview(false)} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Fermer l'aperçu</Text>
            </Pressable>
            <Text className="text-xs text-muted-foreground text-center mt-2">
              Aperçu uniquement — les vraies données s'affichent sur le profil public.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-3 px-1">
      <View className="flex-1 h-px bg-border" />
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</Text>
      <View className="flex-1 h-px bg-border" />
    </View>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-semibold text-muted-foreground mb-2">{label}</Text>
      {children}
    </View>
  );
}
