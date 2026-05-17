import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, usersApi } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Colors } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import type { User } from "@/lib/api";

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
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        await refreshProfile();
        setCurrentPassword("");
        setNewPassword("");
        setNewPasswordConfirm("");
        if (changingPassword) {
          Alert.alert("Mot de passe modifié", "Ton mot de passe a été mis à jour.");
        } else {
          Alert.alert("Succès", "Profil mis à jour");
          router.back();
        }
      } else {
        setError(res.error ?? "Impossible de mettre à jour");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Export non disponible", "L'export n'est pas disponible sur cet appareil.");
      return;
    }
    setIsExporting(true);
    try {
      const res = await authApi.exportData();
      if (!res.success || !res.data) {
        Alert.alert("Erreur", res.error ?? "Erreur lors de l'export.");
        return;
      }
      const filename = `blyss-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, res.data, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: "application/json", UTI: "public.json" });
    } catch {
      Alert.alert("Erreur", "Impossible de générer l'export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const res = await authApi.deleteAccount();
      if (res.success) {
        Alert.alert("Compte supprimé");
        await authApi.logout();
        router.replace("/(auth)/login");
      } else {
        Alert.alert("Erreur", "Impossible de supprimer le compte");
      }
    } catch {
      Alert.alert("Erreur", "Une erreur est survenue");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
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
          onPress={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </AnimatedIconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground }}>Paramètres</Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Profil et sécurité</Text>
        </View>
      </View>

      {/* ── INFOS ACTIVITÉ ── */}
      <View>
        <SectionHeader icon="storefront-outline" label="Activité" />
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, gap: 16, ...Shadows.card }}>
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
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, gap: 16, ...Shadows.card }}>
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
            <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: "500" }}>
                Mot de passe oublié ?
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={{ backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FECACA" }}>
          <Text style={{ fontSize: 13, color: "#DC2626", fontWeight: "500" }}>{error}</Text>
        </View>
      )}

      {/* Save CTA */}
      <Pressable onPress={handleSubmit(onSubmit)} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
        <LinearGradient
          colors={[Colors.primary, `${Colors.primary}E6`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Enregistrer les modifications</Text>
          )}
        </LinearGradient>
      </Pressable>

      {/* ── DONNÉES & CONFIDENTIALITÉ ── */}
      <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
        <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          Données & confidentialité
        </Text>

        <Pressable
          onPress={() => router.push("/(pro)/(profile)/rgpd")}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border }}
        >
          <Ionicons name="shield-outline" size={16} color={Colors.primary} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: Colors.foreground }}>Mes droits RGPD</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={handleExport}
          disabled={isExporting}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border, opacity: isExporting ? 0.5 : 1 }}
        >
          <Ionicons name="download-outline" size={16} color={Colors.primary} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: Colors.foreground }}>
            {isExporting ? "Export en cours…" : "Exporter mes données"}
          </Text>
        </Pressable>

        {!showDeleteConfirm ? (
          <Pressable
            onPress={() => setShowDeleteConfirm(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border }}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: "#EF4444" }}>Supprimer mon compte</Text>
          </Pressable>
        ) : (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: "#FEF2F2", gap: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#DC2626" }}>
              Supprimer le compte — action irréversible
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Confirmer</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
