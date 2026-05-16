import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, usersApi } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Shadows } from "@/constants/shadows";

function SectionHeader({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 2 }}>
      <Ionicons name={icon} size={15} color="#FE5D9D" />
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#09090B" }}>{label}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [birthDate, setBirthDate] = useState<Date | undefined>(
    user?.birth_date ? new Date(user.birth_date) : undefined
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep form in sync with user data
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      if (user.birth_date) setBirthDate(new Date(user.birth_date));
    }
  }, [user]);

  const validatePassword = (pwd: string) =>
    pwd.length >= 8 && /[A-Z]/.test(pwd) && /\d/.test(pwd);

  const handleSave = async () => {
    setError(null);
    const cleanFirst = firstName.trim().slice(0, 100);
    const cleanLast = lastName.trim().slice(0, 100);

    if (!cleanFirst || !cleanLast) {
      setError("Le prénom et le nom sont requis.");
      return;
    }

    const changingPassword = !!(currentPassword || newPassword || newPasswordConfirm);
    if (changingPassword) {
      if (!currentPassword) { setError("Renseigne ton ancien mot de passe pour le modifier."); return; }
      if (!validatePassword(newPassword)) { setError("Ton nouveau mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre."); return; }
      if (newPassword !== newPasswordConfirm) { setError("Les deux nouveaux mots de passe ne correspondent pas."); return; }
      if (newPassword === currentPassword) { setError("Le nouveau mot de passe doit être différent de l'ancien."); return; }
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: cleanFirst,
        last_name: cleanLast,
        birth_date: birthDate ? birthDate.toISOString().split("T")[0] : undefined,
      };
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
          Alert.alert("Modifications enregistrées");
        }
      } else {
        setError(res.error ?? (res as { message?: string }).message ?? "Erreur lors de la sauvegarde");
      }
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    // TODO: authApi.exportData() — endpoint not yet available in mobile API
    Alert.alert("Fonctionnalité à venir", "L'export de données sera disponible prochainement.");
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFEAF1" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EBE6E0", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color="#09090B" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#09090B" }}>Paramètres</Text>
            <Text style={{ fontSize: 12, color: "#6D6D78" }}>Gère ton compte et ta sécurité</Text>
          </View>
        </View>

        {/* Infos personnelles */}
        <View style={{ marginBottom: 20 }}>
          <SectionHeader icon="person-outline" label="Infos personnelles" />
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, gap: 16, ...Shadows.card }}>
            <Input
              label="Nom"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Ton nom"
              leftIcon="person-outline"
              autoComplete="family-name"
            />
            <Input
              label="Prénom"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Ton prénom"
              leftIcon="person-outline"
              autoComplete="given-name"
            />
            <DatePicker
              label="Date de naissance"
              value={birthDate}
              onChange={setBirthDate}
              maximumDate={new Date()}
              placeholder="Sélectionner une date"
            />
          </View>
        </View>

        {/* Sécurité */}
        <View style={{ marginBottom: 20 }}>
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
              <Text style={{ fontSize: 11, color: "#6D6D78", lineHeight: 16 }}>
                Ton mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.
              </Text>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                <Text style={{ fontSize: 12, color: "#FE5D9D", fontWeight: "500" }}>
                  Mot de passe oublié ?
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Error banner */}
        {error && (
          <View style={{ backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ fontSize: 13, color: "#DC2626", fontWeight: "500" }}>{error}</Text>
          </View>
        )}

        {/* Save CTA */}
        <Pressable onPress={handleSave} disabled={isSaving} style={{ marginBottom: 24, opacity: isSaving ? 0.7 : 1 }}>
          <LinearGradient
            colors={["#FE5D9D", "rgba(254,93,157,0.9)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: "#FE5D9D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                Enregistrer les modifications
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        {/* Données & confidentialité */}
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", ...Shadows.card, marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: "#6D6D78", textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            Données & confidentialité
          </Text>

          <Pressable
            onPress={() => router.push("/(client)/rgpd")}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#EBE6E0" }}
          >
            <Ionicons name="shield-outline" size={16} color="#FE5D9D" />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: "#09090B" }}>Mes droits RGPD</Text>
            <Ionicons name="chevron-forward" size={16} color="#6D6D78" />
          </Pressable>

          <Pressable
            onPress={handleExportData}
            disabled={isExporting}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#EBE6E0", opacity: isExporting ? 0.5 : 1 }}
          >
            <Ionicons name="download-outline" size={16} color="#FE5D9D" />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: "#09090B" }}>
              {isExporting ? "Export en cours..." : "Exporter mes données"}
            </Text>
          </Pressable>

          {!showDeleteConfirm ? (
            <Pressable
              onPress={() => setShowDeleteConfirm(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#EBE6E0" }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: "#EF4444" }}>
                Supprimer mon compte
              </Text>
            </Pressable>
          ) : (
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#EBE6E0", backgroundColor: "#FEF2F2", gap: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#DC2626" }}>
                Supprimer le compte — action irréversible
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: "#F8F5F1", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#09090B" }}>Annuler</Text>
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
    </SafeAreaView>
  );
}
