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
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
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
    <AnimatedPressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: colors.white, borderRadius: 16, padding: 14,
        ...Shadows.card,
      }}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: isDestructive ? withAlpha(colors.destructive, 0.12) : `${colors.primary}18`,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name={icon} size={17} color={isDestructive ? colors.destructive : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: isDestructive ? colors.destructive : colors.foreground }}>
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 15, marginTop: 2 }}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </AnimatedPressable>
  );
}

export default function ProRGPDScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await authApi.deleteAccount();
      await logout();
      router.replace("/(auth)/login");
    } catch {
      setDeleteError("Une erreur est survenue lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Mes données personnelles</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Confidentialité & compte</Text>
          </View>
        </View>

        {/* Intro */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          backgroundColor: `${colors.primary}0D`, borderWidth: 1, borderColor: `${colors.primary}26`,
          borderRadius: 16, padding: 14, marginBottom: 20,
        }}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          <Text style={{ fontSize: 11, color: colors.mutedForeground, lineHeight: 16, flex: 1 }}>
            Chez Blyss, tes données t'appartiennent. Tu peux les consulter, les modifier ou les supprimer à tout moment.
          </Text>
        </View>

        {/* Section: Mes données */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingHorizontal: 2 }}>
            Mes données
          </Text>
          <View style={{ gap: 8 }}>
            <RGPDRow
              icon="download-outline"
              label="Télécharger mes données"
              description="Récupère une copie de tes informations au format JSON"
              onPress={() => router.push("/(pro)/(profile)/settings")}
            />
            <RGPDRow
              icon="pencil-outline"
              label="Modifier mes informations"
              description="Nom, email, téléphone, photo de profil"
              onPress={() => router.push("/(pro)/(profile)/settings")}
            />
            <RGPDRow
              icon="notifications-outline"
              label="Gérer les notifications"
              description="Choisis quelles notifications tu souhaites recevoir"
              onPress={() => router.push("/(pro)/notifications")}
            />
          </View>
        </View>

        {/* Section: Aide */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingHorizontal: 2 }}>
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
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, paddingHorizontal: 2 }}>
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
          <View style={{ width: "100%", backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(colors.destructive, 0.12), alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="warning-outline" size={20} color={colors.destructive} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>Supprimer mon compte</Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
              Cette action est irréversible. Toutes tes données personnelles seront supprimées dans les 30 jours.
            </Text>
            {deleteError && <ErrorMessage message={deleteError} />}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                style={{ flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting}
                style={{ flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.destructive, opacity: isDeleting ? 0.7 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.onColor} />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: "800", color: colors.onColor }}>Supprimer</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
