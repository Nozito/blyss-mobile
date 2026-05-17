import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { proApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

type Service = { id: number; name: string; price: number; duration_minutes: number; active?: boolean };

const MAX_BIO = 500;

export default function ProPublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activityName, setActivityName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
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

  const { isLoading } = useQuery({
    queryKey: ["pro-public-profile"],
    queryFn: async () => {
      const res = await proApi.getProfile?.();
      return res?.data ?? null;
    },
    onSuccess: (data: any) => {
      if (!data) return;
      const vals = {
        activityName: data.activity_name || "",
        city: data.city || "",
        bio: data.bio || "",
        instagram: data.instagram_account || "",
        isPublic: data.profile_visibility !== "private",
      };
      setActivityName(vals.activityName);
      setCity(vals.city);
      setBio(vals.bio);
      setInstagram(vals.instagram);
      setIsPublic(vals.isPublic);
      setInitial(vals);
    },
  } as any);

  useEffect(() => {
    const changed =
      activityName !== initial.activityName ||
      city !== initial.city ||
      bio !== initial.bio ||
      instagram !== initial.instagram ||
      isPublic !== initial.isPublic;
    setHasChanges(changed);
  }, [activityName, city, bio, instagram, isPublic, initial]);

  const handleSave = async () => {
    if (!activityName.trim()) { Alert.alert("Erreur", "Le nom de l'activité est requis."); return; }
    if (!city.trim()) { Alert.alert("Erreur", "La ville est requise."); return; }
    if (instagram && !instagram.startsWith("@")) { Alert.alert("Erreur", "Le compte Instagram doit commencer par @."); return; }

    setIsSaving(true);
    try {
      await proApi.updateProfile?.({
        activity_name: activityName,
        city,
        bio,
        instagram_account: instagram,
        profile_visibility: isPublic ? "public" : "private",
      });
      qc.invalidateQueries({ queryKey: ["pro-public-profile"] });
      setInitial({ activityName, city, bio, instagram, isPublic });
      setHasChanges(false);
      Alert.alert("Succès", "Profil public mis à jour !");
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour le profil.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <AnimatedIconButton
              onPress={() => router.back()}
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
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
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
                placeholderTextColor="#C0BAB5"
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, MAX_BIO))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={MAX_BIO}
                style={{
                  backgroundColor: "#F8F5F2",
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: "#E4E0DC",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 14.5,
                  color: "#09090B",
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
              onChangeText={setInstagram}
              placeholder="@toncompte"
              leftIcon="logo-instagram"
              autoCapitalize="none"
              maxLength={50}
              hint="Ton compte Instagram sera affiché sur ton profil Blyss."
            />
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

      {/* Sticky save button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 12, backgroundColor: "rgba(255,234,241,0.95)" }}
      >
        <Pressable
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
        </Pressable>
      </View>

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
              <Text className="text-sm text-muted-foreground mt-1">Prothésiste ongulaire</Text>
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
                    <Ionicons name="eye-off-outline" size={18} color="#DC2626" />
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
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Réserver</Text>
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
