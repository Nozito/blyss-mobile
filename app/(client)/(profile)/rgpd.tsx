import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";

interface RGPDRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  variant?: "default" | "destructive";
}

function RGPDRow({ icon, label, description, onPress, variant = "default" }: RGPDRowProps) {
  const colors = useThemeColors();
  const isDestructive = variant === "destructive";
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1,
        backgroundColor: isDestructive ? withAlpha(colors.destructive, 0.1) : colors.card,
        borderColor: isDestructive ? withAlpha(colors.destructive, 0.3) : colors.border,
      }}
    >
      <View
        style={{
          width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
          backgroundColor: isDestructive ? withAlpha(colors.destructive, 0.18) : `${colors.primary}18`,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={isDestructive ? colors.destructiveText : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 13, fontWeight: "600", color: isDestructive ? colors.destructiveText : colors.foreground }}
        >
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 15, marginTop: 2 }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ClientRGPDScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user, logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [rgpdError, setRgpdError] = useState<string | null>(null);

  const settingsRoute = user?.role === "pro" ? "/(pro)/settings" : "/(client)/(profile)/settings";
  const notifRoute = user?.role === "pro" ? "/(pro)/notifications" : "/(client)/notifications";

  const handleExport = async () => {
    setRgpdError(null);
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      setRgpdError("L'export n'est pas disponible sur cet appareil.");
      return;
    }
    setIsExporting(true);
    try {
      const res = await authApi.exportData();
      if (!res.success || !res.data) {
        setRgpdError(res.error ?? "Erreur lors de l'export.");
        return;
      }
      const filename = `blyss-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, res.data, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: "application/json", UTI: "public.json" });
    } catch {
      setRgpdError("Impossible de générer l'export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    setRgpdError(null);
    setIsDeleting(true);
    try {
      const res = await authApi.deleteAccount();
      if (!res.success) throw new Error(res.error ?? "Erreur lors de la suppression");
      await logout();
      router.replace("/(auth)/login");
    } catch (err) {
      setRgpdError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sticky header */}
      <View
        style={{ backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            style={{ padding: 8, marginLeft: -8, borderRadius: 14, backgroundColor: colors.muted }}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View>
            <Text style={{ fontWeight: "600", color: colors.foreground, fontSize: 15 }}>Mes données personnelles</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Confidentialité & compte</Text>
          </View>
        </View>
        {rgpdError && !showDeleteModal && <View style={{ marginTop: 8 }}><ErrorMessage message={rgpdError} /></View>}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, marginBottom: 24, backgroundColor: `${colors.primary}0D`, borderWidth: 1, borderColor: `${colors.primary}26` }}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 16, flex: 1 }}>
            Chez Blyss, tes données t'appartiennent. Tu peux les consulter, les modifier ou les supprimer à tout moment.
          </Text>
        </View>

        {/* Section: Mes données */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 }}>
            Mes données
          </Text>
          <View style={{ gap: 8 }}>
            <RGPDRow
              icon="download-outline"
              label={isExporting ? "Export en cours…" : "Télécharger mes données"}
              description="Récupère une copie de tes informations au format JSON"
              onPress={isExporting ? () => {} : handleExport}
            />
            <RGPDRow
              icon="pencil-outline"
              label="Modifier mes informations"
              description="Nom, email, téléphone, photo de profil"
              onPress={() => router.push(settingsRoute as any)}
            />
            <RGPDRow
              icon="notifications-outline"
              label="Gérer les notifications"
              description="Choisis quelles notifications tu souhaites recevoir"
              onPress={() => router.push(notifRoute as any)}
            />
          </View>
        </View>

        {/* Section: Aide */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 }}>
            Une question ?
          </Text>
          <RGPDRow
            icon="mail-outline"
            label="Contacter l'équipe Blyss"
            description="privacy@blyssapp.fr — on répond sous 48h"
            onPress={() => Linking.openURL("mailto:privacy@blyssapp.fr")}
          />
        </View>

        {/* Section: Supprimer */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 }}>
            Supprimer mon compte
          </Text>
          <RGPDRow
            icon="trash-outline"
            label="Supprimer mon compte"
            description="Efface définitivement toutes tes données de Blyss"
            onPress={() => setShowDeleteModal(true)}
            variant="destructive"
          />
        </View>

        <Text style={{ textAlign: "center", fontSize: 11, color: colors.mutedForeground, lineHeight: 16 }}>
          Politique de confidentialité Blyss
        </Text>
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "flex-end", justifyContent: "flex-end", padding: 16 }}>
          <View
            style={{ width: "100%", backgroundColor: colors.card, borderRadius: 24, padding: 24, gap: 16 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(colors.destructive, 0.15), alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="warning-outline" size={20} color={colors.destructiveText} />
              </View>
              <Text style={{ fontWeight: "700", color: colors.foreground, fontSize: 15 }}>Supprimer mon compte</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
              Cette action est irréversible. Toutes tes données personnelles seront supprimées dans les 30 jours suivant la demande.
            </Text>
            {rgpdError && <ErrorMessage message={rgpdError} />}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                style={{ flex: 1, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting}
                style={{ flex: 1, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.destructiveText, opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.onColor} />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onColor }}>Supprimer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
