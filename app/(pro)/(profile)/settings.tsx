import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, usersApi, proApi } from "@/lib/api";
import { phoneSchema, bioSchema, getZodError } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Colors } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { usePro } from "@/hooks/usePro";
import type { User } from "@/lib/api";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

function SectionHeader({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 2 }}>
      <Ionicons name={icon} size={15} color={Colors.primary} />
      <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>{label}</Text>
    </View>
  );
}

export default function ProSettingsScreen() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPro } = usePro();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [contentOpacity]);
  const { data: subData } = useQuery({
    queryKey: ["pro-subscription"],
    queryFn: () => proApi.getSubscription(),
    enabled: isPro,
  });
  const renewalDate = subData?.data?.endDate
    ? new Date(subData.data.endDate).toLocaleDateString("fr-FR")
    : null;
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<Partial<User>>({
    defaultValues: {
      first_name:        user?.first_name ?? "",
      last_name:         user?.last_name ?? "",
      phone_number:      user?.phone_number ?? "",
      activity_name:     user?.activity_name ?? "",
      city:              user?.city ?? "",
      bio:               user?.bio ?? "",
      instagram_account: user?.instagram_account ?? "",
    },
  });

  const validatePassword = (pwd: string) =>
    pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd);

  const onSubmit = async (data: Partial<User>) => {
    setError(null);

    // Validate phone format if provided
    const phoneNum = (data.phone_number ?? "").replace(/\s/g, "");
    if (phoneNum) {
      const phoneErr = getZodError(phoneSchema, phoneNum);
      if (phoneErr) { setError(phoneErr); return; }
    }

    // Validate bio length if provided
    if (data.bio) {
      const bioErr = getZodError(bioSchema, data.bio);
      if (bioErr) { setError(bioErr); return; }
    }

    const changingPassword = !!(currentPassword || newPassword || newPasswordConfirm);
    if (changingPassword) {
      if (!currentPassword) { setError("Renseigne ton ancien mot de passe pour le modifier."); return; }
      if (!validatePassword(newPassword)) { setError("Ton nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre."); return; }
      if (newPassword !== newPasswordConfirm) { setError("Les deux nouveaux mots de passe ne correspondent pas."); return; }
      if (newPassword === currentPassword) { setError("Le nouveau mot de passe doit être différent de l'ancien."); return; }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...data };
      if (changingPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await usersApi.update(payload);
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await refreshProfile();
        setCurrentPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
        if (changingPassword) {
          setSuccess("Mot de passe mis à jour avec succès.");
        } else {
          safeBack(router);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError(res.error ?? "Impossible de mettre à jour");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      setError("L'export n'est pas disponible sur cet appareil.");
      return;
    }
    setIsExporting(true);
    try {
      const res = await authApi.exportData();
      if (!res.success || !res.data) {
        setError(res.error ?? "Erreur lors de l'export.");
        return;
      }
      const filename = `blyss-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, res.data, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: "application/json", UTI: "public.json" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setError("Impossible de générer l'export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setIsDeleting(true);
    try {
      const res = await authApi.deleteAccount();
      if (res.success) {
        await authApi.logout();
        router.replace("/(auth)/login");
      } else {
        setError("Impossible de supprimer le compte.");
      }
    } catch {
      setError("Une erreur est survenue.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  return (
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
        gap: 20,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <AnimatedIconButton
          onPress={() => safeBack(router)}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </AnimatedIconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground }}>Paramètres</Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Profil et sécurité</Text>
        </View>
      </View>

      {/* ── ABONNEMENT ── */}
      <View>
        <SectionHeader icon="sparkles-outline" label="Abonnement" />
        <View style={{ backgroundColor: Colors.white, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
          {isPro ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>Plan Pro actif</Text>
                    <View style={{ backgroundColor: Colors.successLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.success }}>✦ Pro actif</Text>
                    </View>
                  </View>
                  {renewalDate && (
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Renouvellement le {renewalDate}</Text>
                  )}
                </View>
              </View>
              <AnimatedPressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void Linking.openURL("https://apps.apple.com/account/subscriptions");
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border }}
              >
                <Ionicons name="settings-outline" size={16} color={Colors.primary} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: Colors.foreground }}>Gérer mon abonnement</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
              </AnimatedPressable>
            </>
          ) : (
            <AnimatedPressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(pro)/(profile)/subscription" as Parameters<typeof router.push>[0]);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.pro}18`, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="sparkles-outline" size={18} color={Colors.pro} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>Passer à Pro</Text>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Débloquer toutes les fonctionnalités</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* ── INFOS ACTIVITÉ ── */}
      <View>
        <SectionHeader icon="storefront-outline" label="Activité" />
        <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 16, ...Shadows.card }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="first_name"
                render={({ field: { onChange, value } }) => (
                  <Input label="Prénom" value={value ?? ""} onChangeText={onChange} autoCapitalize="words" leftIcon="person-outline" />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="last_name"
                render={({ field: { onChange, value } }) => (
                  <Input label="Nom" value={value ?? ""} onChangeText={onChange} autoCapitalize="words" leftIcon="person-outline" />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="activity_name"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Nom de l'activité"
                value={value ?? ""}
                onChangeText={onChange}
                leftIcon="storefront-outline"
              />
            )}
          />

          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, value } }) => (
              <Input label="Ville" value={value ?? ""} onChangeText={onChange} leftIcon="location-outline" />
            )}
          />

          <Controller
            control={control}
            name="phone_number"
            render={({ field: { onChange, value } }) => (
              <Input label="Téléphone" value={value ?? ""} onChangeText={onChange} keyboardType="phone-pad" leftIcon="call-outline" />
            )}
          />

          <Controller
            control={control}
            name="instagram_account"
            render={({ field: { onChange, value } }) => (
              <Input label="Instagram" value={value ?? ""} onChangeText={onChange} leftIcon="logo-instagram" placeholder="@moncompte" />
            )}
          />
        </View>
      </View>

      {/* ── SÉCURITÉ ── */}
      <View>
        <SectionHeader icon="lock-closed-outline" label="Sécurité" />
        <View style={{ backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 16, ...Shadows.card }}>
          <Input
            label="Ancien mot de passe"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Mot de passe actuel"
            leftIcon="lock-closed-outline"
            autoComplete="current-password"
            secure
          />
          <Input
            label="Nouveau mot de passe"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nouveau mot de passe"
            leftIcon="lock-open-outline"
            autoComplete="new-password"
            secure
          />
          <Input
            label="Confirme le nouveau mot de passe"
            value={newPasswordConfirm}
            onChangeText={setNewPasswordConfirm}
            placeholder="Répète le nouveau mot de passe"
            leftIcon="lock-open-outline"
            autoComplete="new-password"
            secure
          />
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, lineHeight: 16 }}>
              Au moins 8 caractères, une majuscule et un chiffre.
            </Text>
            <AnimatedPressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "500" }}>
                Mot de passe oublié ?
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </View>

      {error && <ErrorMessage message={error} />}
      {success && (
        <View style={{ backgroundColor: `${Colors.success}12`, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${Colors.success}30` }}>
          <Text style={{ fontSize: 13, color: Colors.success, fontWeight: "600" }}>{success}</Text>
        </View>
      )}

      {/* Save CTA */}
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          handleSubmit(onSubmit)();
        }}
        disabled={saving}
        style={{
          height: 56, borderRadius: 16, backgroundColor: Colors.primary,
          alignItems: "center", justifyContent: "center",
          shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 15 }}>Enregistrer les modifications</Text>
        )}
      </AnimatedPressable>

      {/* ── DONNÉES & CONFIDENTIALITÉ ── */}
      <View style={{ backgroundColor: Colors.white, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          Données & confidentialité
        </Text>

        <AnimatedPressable
          onPress={() => router.push("/(pro)/(profile)/rgpd")}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border }}
        >
          <Ionicons name="shield-outline" size={16} color={Colors.primary} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: Colors.foreground }}>Mes droits RGPD</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            handleExport();
          }}
          disabled={isExporting}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border, opacity: isExporting ? 0.5 : 1 }}
        >
          <Ionicons name="download-outline" size={16} color={Colors.primary} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: Colors.foreground }}>
            {isExporting ? "Export en cours…" : "Exporter mes données"}
          </Text>
        </AnimatedPressable>

        {!showDeleteConfirm ? (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowDeleteConfirm(true);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: Colors.destructive }}>Supprimer mon compte</Text>
          </AnimatedPressable>
        ) : (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.destructiveLight, gap: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.destructiveText }}>
              Suppression définitive du compte
            </Text>
            <Text style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 18 }}>
              Cette action est irréversible. Toutes tes données seront effacées.{"\n"}
              Tape <Text style={{ fontWeight: "800" }}>SUPPRIMER</Text> pour confirmer.
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="SUPPRIMER"
              placeholderTextColor="#FCA5A5"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                height: 44, borderRadius: 10, borderWidth: 1.5,
                borderColor: deleteConfirmText === "SUPPRIMER" ? Colors.destructive : "#FECACA",
                backgroundColor: Colors.white, paddingHorizontal: 14,
                fontSize: 14, fontWeight: "700", color: Colors.destructiveText,
                letterSpacing: 1,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <AnimatedPressable
                onPress={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.cream, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== "SUPPRIMER"}
                style={{
                  flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.destructive,
                  alignItems: "center", justifyContent: "center",
                  opacity: isDeleting || deleteConfirmText !== "SUPPRIMER" ? 0.4 : 1,
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.white }}>Supprimer</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
    </Animated.View>
  );
}
