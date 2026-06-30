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
import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

interface RGPDRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  variant?: "default" | "destructive";
}

function RGPDRow({ icon, label, description, onPress, variant = "default" }: RGPDRowProps) {
  const isDestructive = variant === "destructive";
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 p-4 rounded-2xl border"
      style={{
        backgroundColor: isDestructive ? "#FFF0F0" : Colors.card,
        borderColor: isDestructive ? "#FECACA" : Colors.border,
      }}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center"
        style={{ backgroundColor: isDestructive ? "#FEE2E2" : `${Colors.primary}18` }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={isDestructive ? Colors.destructiveText : Colors.primary}
        />
      </View>
      <View className="flex-1">
        <Text
          className="text-sm font-semibold"
          style={{ color: isDestructive ? "#B91C1C" : Colors.foreground }}
        >
          {label}
        </Text>
        <Text className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
    </Pressable>
  );
}

export default function ClientRGPDScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    <View className="flex-1 bg-background">
      {/* Sticky header */}
      <View
        className="bg-background border-b border-border"
        style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 20 }}
      >
        <View className="flex-row items-center gap-3">
          <AnimatedIconButton
            onPress={() => router.back()}
            className="p-2 -ml-2 rounded-xl"
            style={{ backgroundColor: Colors.muted }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <View>
            <Text className="font-semibold text-foreground text-base">Mes données personnelles</Text>
            <Text className="text-xs text-muted-foreground">Confidentialité & compte</Text>
          </View>
        </View>
        {rgpdError && !showDeleteModal && <View style={{ marginTop: 8 }}><ErrorMessage message={rgpdError} /></View>}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <View
          className="flex-row items-center gap-3 p-4 rounded-2xl mb-6"
          style={{ backgroundColor: `${Colors.primary}0D`, borderWidth: 1, borderColor: `${Colors.primary}26` }}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
          <Text className="text-xs text-muted-foreground leading-relaxed flex-1">
            Chez Blyss, tes données t'appartiennent. Tu peux les consulter, les modifier ou les supprimer à tout moment.
          </Text>
        </View>

        {/* Section: Mes données */}
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Mes données
          </Text>
          <View className="gap-2">
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
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
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
        <View className="mb-6">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
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

        <Text className="text-center text-xs text-muted-foreground/60 leading-relaxed">
          Politique de confidentialité Blyss
        </Text>
      </ScrollView>

      {/* Delete confirmation modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View className="flex-1 bg-black/40 items-end justify-end p-4">
          <View
            className="w-full bg-card rounded-3xl p-6"
            style={{ gap: 16 }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-red-100 items-center justify-center">
                <Ionicons name="warning-outline" size={20} color={Colors.destructiveText} />
              </View>
              <Text className="font-bold text-foreground text-base">Supprimer mon compte</Text>
            </View>
            <Text className="text-sm text-muted-foreground leading-relaxed">
              Cette action est irréversible. Toutes tes données personnelles seront supprimées dans les 30 jours suivant la demande.
            </Text>
            {rgpdError && <ErrorMessage message={rgpdError} />}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                className="flex-1 h-11 rounded-xl border border-border items-center justify-center"
              >
                <Text className="text-sm font-semibold text-foreground">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting}
                className="flex-1 h-11 rounded-xl items-center justify-center"
                style={{ backgroundColor: Colors.destructiveText, opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text className="text-sm font-bold text-white">Supprimer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
