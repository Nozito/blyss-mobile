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
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Clipboard } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { proApi, usersApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { proProfileSchema } from "@/lib/validation";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { resolveMediaUrl } from "@/lib/media";

const SCREEN_W = Dimensions.get("window").width;
const GALLERY_CELL = (SCREEN_W - 40 - 8) / 3;

type Service = { id: number; name: string; price: number; duration_minutes: number; active?: boolean };
type GalleryImage = { id: number; url: string; thumbnail: string; created_at: string };

const MAX_BIO = 300;
const MAX_GALLERY = 10;

export default function ProPublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
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

  const { data: galleryData, refetch: refetchGallery } = useQuery({
    queryKey: ["pro-gallery"],
    queryFn: () => proApi.getGallery(),
  });
  const gallery: GalleryImage[] = (galleryData?.data as GalleryImage[] | undefined) ?? [];

  const profileUrl = user?.id
    ? `https://blyssapp.fr/s/${user.id}`
    : "https://blyssapp.fr";

  const bannerUri = resolveMediaUrl(user?.banner_photo);

  const handlePickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
      mediaTypes: ["images"],
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

  const [activityName, setActivityName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [instagramError, setInstagramError] = useState<string | undefined>();
  const [isPublic, setIsPublic] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const MAX_CONDITIONS = 8;
  const [conditions, setConditions] = useState<{ text: string; accepted: boolean }[]>([]);
  const [newConditionText, setNewConditionText] = useState("");

  const [initial, setInitial] = useState({
    activityName: "", city: "", bio: "", instagram: "", isPublic: true,
    conditions: [] as { text: string; accepted: boolean }[],
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
      conditions: profileData.acceptance_conditions ?? [],
    };
    setActivityName(vals.activityName);
    setCity(vals.city);
    setBio(vals.bio);
    setInstagram(vals.instagram);
    setIsPublic(vals.isPublic);
    setConditions(vals.conditions);
    setInitial(vals);
  }, [profileData]);

  useEffect(() => {
    const changed =
      activityName !== initial.activityName ||
      city !== initial.city ||
      bio !== initial.bio ||
      instagram !== initial.instagram ||
      isPublic !== initial.isPublic ||
      JSON.stringify(conditions) !== JSON.stringify(initial.conditions);
    setHasChanges(changed);
  }, [activityName, city, bio, instagram, isPublic, conditions, initial]);

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
        acceptance_conditions: conditions,
      });
      qc.invalidateQueries({ queryKey: ["pro-public-profile"] });
      setInitial({ activityName, city, bio, instagram, isPublic, conditions });
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
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <AnimatedIconButton
              onPress={() => safeBack(router)}
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.muted }}
              accessibilityLabel="Retour"
            >
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </AnimatedIconButton>
            <Text className="text-2xl font-bold flex-1" style={{ color: colors.foreground }}>Profil public</Text>
            <Pressable
              onPress={() => setShowPreview(true)}
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${colors.primary}15` }}
              accessibilityRole="button"
              accessibilityLabel="Aperçu du profil"
            >
              <Ionicons name="eye-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Text className="text-sm ml-1" style={{ color: colors.mutedForeground }}>
            Informations visibles par tes clientes
          </Text>
        </View>

        {/* Unsaved changes banner */}
        {hasChanges && (
          <View
            className="rounded-2xl p-4 mb-4 flex-row items-center gap-3 border"
            style={{ borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}08` }}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>Modifications non enregistrées</Text>
              <Text className="text-xs mt-0.5" style={{ color: colors.mutedForeground }}>N'oublie pas de sauvegarder tes changements</Text>
            </View>
          </View>
        )}

        {/* Info card */}
        <View
          className="rounded-2xl p-4 mb-6 flex-row items-start gap-4 border"
          style={{ backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.black, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: colors.primary }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.onColor} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold mb-1" style={{ color: colors.foreground }}>Optimise ton profil</Text>
            <Text className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
              Un profil complet et détaillé augmente tes chances d'être réservée de 3×.
            </Text>
          </View>
        </View>

        {/* Section: Bannière */}
        <View className="mb-6">
          <SectionTitle title="Photo de couverture" />
          <Pressable
            onPress={handlePickBanner}
            accessibilityRole="button"
            accessibilityLabel="Modifier la photo de couverture"
            style={{
              height: 140,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: colors.muted,
              borderWidth: 1.5,
              borderColor: colors.border,
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
                <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
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
                <ActivityIndicator size="large" color={colors.onColor} />
              </View>
            ) : (
              <View style={{
                position: "absolute", bottom: 8, right: 8,
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: "rgba(0,0,0,0.45)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="camera-outline" size={16} color={colors.onColor} />
              </View>
            )}
          </Pressable>
        </View>

        {/* Section: Infos principales */}
        <View className="mb-6">
          <SectionTitle title="Informations principales" />
          <View className="rounded-2xl p-5 border gap-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
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
          <View className="rounded-2xl p-5 border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, letterSpacing: 0.1 }}>Biographie</Text>
              <TextInput
                placeholder="Parle de ton parcours, tes spécialités, ce qui te passionne..."
                placeholderTextColor={colors.inputPlaceholder}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, MAX_BIO))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={MAX_BIO}
                style={{
                  backgroundColor: colors.cream,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14.5,
                  color: colors.foreground,
                  minHeight: 100,
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 11.5, color: colors.mutedForeground }}>Aide tes clientes à mieux te connaître</Text>
                <Text style={{ fontSize: 11.5, color: bio.length > MAX_BIO - 50 ? colors.destructive : colors.mutedForeground }}>
                  {MAX_BIO - bio.length}/{MAX_BIO}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Réseaux sociaux */}
        <View className="mb-6">
          <SectionTitle title="Réseaux sociaux" />
          <View className="rounded-2xl p-5 border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
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
                accessibilityRole="button"
                accessibilityLabel="Voir la photo de réalisation"
                style={{ width: GALLERY_CELL, height: GALLERY_CELL, borderRadius: 10, overflow: "hidden", backgroundColor: colors.muted }}
              >
                <Image source={{ uri: img.thumbnail || img.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </Pressable>
            ))}
            {gallery.length < MAX_GALLERY && (
              <Pressable
                onPress={handleAddGalleryPhoto}
                disabled={galleryUploading}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une photo à la galerie"
                style={{ width: GALLERY_CELL, height: GALLERY_CELL, borderRadius: 10, backgroundColor: colors.muted, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}
              >
                {galleryUploading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name="add" size={28} color={colors.mutedForeground} />}
              </Pressable>
            )}
          </View>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6, paddingHorizontal: 2 }}>
            {gallery.length}/{MAX_GALLERY} photos
          </Text>
        </View>

        {/* Section: Lien de partage */}
        <View className="mb-6">
          <SectionTitle title="Votre lien professionnel" />
          <View style={{ backgroundColor: colors.primaryLight, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: `${colors.primary}30` }}>
            {copyToast && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute", top: -10, left: 16,
                  backgroundColor: colors.success, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12,
                  shadowColor: colors.success, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onColor }}>Lien copié !</Text>
              </View>
            )}
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4 }}>Ton profil Blyss</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary, marginBottom: 14 }} numberOfLines={1}>{profileUrl}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <AnimatedPressable
                onPress={handleCopyLink}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: `${colors.primary}30` }}
              >
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Copier</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleShareLink}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Ionicons name="share-outline" size={16} color={colors.onColor} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onColor }}>Partager</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        {/* Section: Conditions de réservation */}
        <View className="mb-6">
          <SectionTitle title="Conditions de réservation" />
          <View className="rounded-2xl p-5 border" style={{ gap: 14, backgroundColor: colors.card, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
              Tes propres règles (acompte, accompagnant, accès...), affichées aux clientes avant qu'elles réservent.
            </Text>

            {conditions.length === 0 ? (
              <Text style={{ fontSize: 13, color: colors.mutedForeground, fontStyle: "italic" }}>
                Aucune condition ajoutée pour l'instant.
              </Text>
            ) : (
              <View style={{ gap: 10 }}>
                {conditions.map((cond, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 10,
                      backgroundColor: colors.cream, borderRadius: 12, padding: 10,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        setConditions((prev) =>
                          prev.map((c, i) => (i === index ? { ...c, accepted: !c.accepted } : c))
                        );
                      }}
                      accessibilityLabel={cond.accepted ? "Marquer comme non autorisé" : "Marquer comme autorisé"}
                      style={{
                        width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                        backgroundColor: cond.accepted ? colors.successLight : colors.destructiveLight,
                      }}
                    >
                      <Ionicons
                        name={cond.accepted ? "checkmark" : "close"}
                        size={16}
                        color={cond.accepted ? colors.success : colors.destructive}
                      />
                    </Pressable>
                    <TextInput
                      value={cond.text}
                      onChangeText={(text) => {
                        setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, text } : c)));
                      }}
                      style={{ flex: 1, fontSize: 13, color: colors.foreground, paddingVertical: 4 }}
                      multiline
                    />
                    <Pressable
                      onPress={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
                      accessibilityLabel="Supprimer cette condition"
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {conditions.length < MAX_CONDITIONS ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Ex : Retard de 15 min = annulation"
                    value={newConditionText}
                    onChangeText={setNewConditionText}
                    leftIcon="add-circle-outline"
                  />
                </View>
                <AnimatedPressable
                  onPress={() => {
                    const text = newConditionText.trim();
                    if (!text) return;
                    setConditions((prev) => [...prev, { text, accepted: true }]);
                    setNewConditionText("");
                  }}
                  disabled={!newConditionText.trim()}
                  style={{
                    height: 48, paddingHorizontal: 16, borderRadius: 12,
                    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
                    opacity: newConditionText.trim() ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                Maximum {MAX_CONDITIONS} conditions atteint.
              </Text>
            )}
          </View>
        </View>

        {/* Section: Visibilité */}
        <View className="mb-6">
          <SectionTitle title="Visibilité du profil" />
          <View className="rounded-2xl p-5 border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-row items-start gap-3 flex-1">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: isPublic ? `${colors.primary}15` : colors.muted }}
                >
                  <Ionicons
                    name={isPublic ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color={isPublic ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
                    Profil {isPublic ? "public" : "privé"}
                  </Text>
                  <Text className="text-xs leading-relaxed mt-0.5" style={{ color: colors.mutedForeground }}>
                    {isPublic
                      ? "Ton profil est visible par toutes les clientes sur Blyss."
                      : "Ton profil n'est visible que par toi."}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.onColor}
              />
            </View>
          </View>
        </View>

        {saveError && <View style={{ marginBottom: 12 }}><ErrorMessage message={saveError} /></View>}
        {saveSuccess && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.successLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 }}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.successText }}>Profil public mis à jour !</Text>
          </View>
        )}
        <AnimatedPressable
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          className="h-14 rounded-2xl items-center justify-center flex-row gap-2"
          style={{
            backgroundColor: hasChanges ? colors.primary : colors.muted,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.onColor} />
          ) : hasChanges ? (
            <>
              <Ionicons name="save-outline" size={18} color={colors.onColor} />
              <Text className="text-white font-bold text-base">Enregistrer le profil public</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={colors.mutedForeground} />
              <Text className="font-semibold text-sm" style={{ color: colors.mutedForeground }}>Profil à jour</Text>
            </>
          )}
        </AnimatedPressable>
      </ScrollView>
      </Animated.View>

      {/* Gallery image detail modal */}
      <Modal visible={selectedGalleryImage != null} transparent animationType="fade" onRequestClose={() => setSelectedGalleryImage(null)}>
        {selectedGalleryImage && (
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}>
            <Pressable
              style={{ position: "absolute", top: insets.top + 16, right: 16, zIndex: 10 }}
              onPress={() => setSelectedGalleryImage(null)}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color={colors.onColor} />
              </View>
            </Pressable>
            <Image
              source={{ uri: selectedGalleryImage.url }}
              style={{ width: SCREEN_W - 40, height: SCREEN_W - 40, borderRadius: 16 }}
              resizeMode="cover"
            />
            <Pressable
              onPress={() => handleDeleteGalleryPhoto(selectedGalleryImage)}
              style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.destructive }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.onColor} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Supprimer</Text>
            </Pressable>
          </View>
        )}
      </Modal>

      {/* Preview modal */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
          <View
            className="flex-row items-center justify-between px-5 border-b"
            style={{ paddingTop: insets.top + 12, paddingBottom: 12, borderBottomColor: colors.border }}
          >
            <Text className="font-bold text-base" style={{ color: colors.foreground }}>Aperçu profil public</Text>
            <Pressable
              onPress={() => setShowPreview(false)}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.muted }}
              accessibilityRole="button"
              accessibilityLabel="Fermer l'aperçu"
            >
              <Ionicons name="close" size={18} color={colors.foreground} />
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
                style={{ backgroundColor: `${colors.primary}20` }}
              >
                <Text className="text-3xl font-bold" style={{ color: colors.primary }}>
                  {(activityName || user?.first_name || "P")[0]}
                </Text>
              </View>
              <Text className="text-xl font-bold text-center" style={{ color: colors.foreground }}>
                {activityName || "Nom de l'activité"}
              </Text>
              {user?.pro_specialties?.[0] ? (
                <Text className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                  {user.pro_specialties[0]}
                </Text>
              ) : null}
              {city ? (
                <View className="flex-row items-center gap-1 mt-2">
                  <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                  <Text className="text-sm" style={{ color: colors.mutedForeground }}>{city}</Text>
                </View>
              ) : null}
              {instagram ? (
                <Text className="text-sm mt-1" style={{ color: colors.primary }}>
                  {instagram.startsWith("@") ? instagram : `@${instagram}`}
                </Text>
              ) : null}
            </View>

            {bio ? (
              <View className="rounded-2xl p-4 mb-4 border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <Text className="text-base font-bold mb-2" style={{ color: colors.foreground }}>À propos</Text>
                <Text className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>{bio}</Text>
              </View>
            ) : null}

            {/* Réalisations */}
            {gallery.length > 0 && (
              <View className="mb-4">
                <Text className="text-base font-bold mb-3" style={{ color: colors.foreground }}>Réalisations</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {gallery.map((img) => (
                    <Image
                      key={img.id}
                      source={{ uri: img.thumbnail }}
                      style={{ width: 90, height: 90, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Prestations */}
            {services.length > 0 && (
              <View className="rounded-2xl p-4 mb-4 border" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                <Text className="text-base font-bold mb-3" style={{ color: colors.foreground }}>Prestations</Text>
                <View style={{ gap: 10 }}>
                  {services.slice(0, 5).map((s) => (
                    <View key={s.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{s.name}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{s.duration_minutes} min</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>
                        {(typeof s.price === "number" ? s.price : parseFloat(String(s.price ?? "0"))).toFixed(2)} €
                      </Text>
                    </View>
                  ))}
                  {services.length > 5 && (
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center" }}>
                      +{services.length - 5} autres prestations
                    </Text>
                  )}
                </View>
              </View>
            )}

            {!isPublic && (
              <View className="rounded-2xl p-4 mb-4 border" style={{ backgroundColor: colors.destructiveLight, borderColor: withAlpha(colors.destructive, 0.3) }}>
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: withAlpha(colors.destructive, 0.15) }}>
                    <Ionicons name="eye-off-outline" size={18} color={colors.destructiveText} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>Profil actuellement privé</Text>
                    <Text className="text-xs leading-relaxed mt-0.5" style={{ color: colors.mutedForeground }}>
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
                backgroundColor: colors.primary,
                alignItems: "center", justifyContent: "center",
                flexDirection: "row", gap: 8,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.onColor} />
              <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 15 }}>Réserver</Text>
            </Pressable>
            <Pressable onPress={() => setShowPreview(false)} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Fermer l'aperçu</Text>
            </Pressable>
            <Text className="text-xs text-center mt-2" style={{ color: colors.mutedForeground }}>
              Aperçu uniquement — les vraies données s'affichent sur le profil public.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <View className="flex-row items-center gap-2 mb-3 px-1">
      <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
      <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.mutedForeground }}>{title}</Text>
      <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
    </View>
  );
}
