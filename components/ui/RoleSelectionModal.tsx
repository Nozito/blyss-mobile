import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ADMIN } from "@/constants/adminTheme";

// DA "Choc" — sheet crème, aplats de couleur pleins, index numérotés,
// titres 900 capitales, ruban rayé. Reprend le langage de l'onboarding.
const CREAM = "#F6E9EE";
const INK   = "#1A0710";
const PRUNE = "#3D1F2C";
const ROSE  = ADMIN.accent;

export type AdminRole = "client" | "pro" | "admin";

interface Props {
  visible: boolean;
  userName: string;
  onSelectRole: (role: AdminRole) => void;
  onClose: () => void;
}

type RoleDef = {
  key: AdminRole;
  label: string;
  sub: string;
  bg: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ROLES: RoleDef[] = [
  { key: "client", label: "Espace Client",  sub: "Réservations & favoris",    bg: ROSE,  fg: INK,   icon: "sparkles-outline" },
  { key: "pro",    label: "Espace Pro",     sub: "Clientes & rendez-vous",    bg: INK,   fg: CREAM, icon: "briefcase-outline" },
  { key: "admin",  label: "Administration", sub: "Pilotage de la plateforme", bg: PRUNE, fg: CREAM, icon: "shield-checkmark-outline" },
];

export default function RoleSelectionModal({ visible, userName, onSelectRole, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(15,8,16,0.74)" }} onPress={onClose} accessibilityLabel="Fermer" />

        <View style={{ backgroundColor: CREAM, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          {/* Ruban rayé rose × prune */}
          <View style={{ flexDirection: "row", height: 6, overflow: "hidden" }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View
                key={i}
                style={{ flex: 1, backgroundColor: i % 2 === 0 ? ROSE : PRUNE, transform: [{ skewX: "-20deg" }, { scaleX: 1.4 }] }}
              />
            ))}
          </View>

          {/* En-tête */}
          <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: INK, opacity: 0.5 }}>
                Connecté · {userName || "Admin"}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: "900", letterSpacing: -1.1, textTransform: "uppercase", color: INK, marginTop: 8, lineHeight: 30 }}>
                Choisis ton espace
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Fermer"
              style={{ width: 34, height: 34, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={16} color={INK} />
            </Pressable>
          </View>

          {/* Rôles — aplats pleins, un par un */}
          {ROLES.map((role, index) => (
            <Pressable
              key={role.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onSelectRole(role.key);
              }}
              android_ripple={{ color: "rgba(0,0,0,0.12)" }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                paddingVertical: 20,
                paddingHorizontal: 22,
                backgroundColor: role.bg,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "900", letterSpacing: 0.5, color: role.fg, opacity: 0.55, width: 24 }}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", letterSpacing: -0.5, textTransform: "uppercase", color: role.fg }}>
                  {role.label}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: role.fg, opacity: 0.7, marginTop: 3 }}>
                  {role.sub}
                </Text>
              </View>
              <Ionicons name={role.icon} size={20} color={role.fg} style={{ opacity: 0.9 }} />
            </Pressable>
          ))}

          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", color: INK, opacity: 0.4, textAlign: "center", marginTop: 18 }}>
            Aussi depuis l'onglet Plus
          </Text>
        </View>
      </View>
    </Modal>
  );
}
