import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Modal, Animated, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ADMIN } from "@/constants/adminTheme";

// DA "Choc" — reprend le langage du web admin / onboarding : sheet crème,
// aplats de couleur pleins, index numérotés, titres 900 capitales, ruban rayé.
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
  { key: "client", label: "Espace Client",  sub: "Réservations & favoris",     bg: ROSE,  fg: INK,   icon: "sparkles-outline" },
  { key: "pro",    label: "Espace Pro",     sub: "Clientes & rendez-vous",     bg: INK,   fg: CREAM, icon: "briefcase-outline" },
  { key: "admin",  label: "Administration", sub: "Pilotage de la plateforme",  bg: PRUNE, fg: CREAM, icon: "shield-checkmark-outline" },
];

function RoleRow({ role, index, onPress }: { role: RoleDef; index: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingVertical: 20,
        paddingHorizontal: 22,
        backgroundColor: role.bg,
        opacity: pressed ? 0.86 : 1,
      })}
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
  );
}

export default function RoleSelectionModal({ visible, userName, onSelectRole, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(420)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity,  { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, damping: 26, stiffness: 300, useNativeDriver: true }),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(420);
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,8,16,0.74)", opacity: overlayOpacity }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />

        <Animated.View
          style={{
            position: "absolute",
            left: 0, right: 0, bottom: 0,
            backgroundColor: CREAM,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            transform: [{ translateY: sheetTranslateY }],
          }}
        >
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
          <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", color: INK, opacity: 0.5 }}>
                Connecté · {userName || "Admin"}
              </Text>
              <Text style={{ fontSize: 30, fontWeight: "900", letterSpacing: -1.2, textTransform: "uppercase", color: INK, marginTop: 8, lineHeight: 32 }}>
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

          {/* Rôles */}
          {ROLES.map((role, i) => (
            <React.Fragment key={role.key}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(246,233,238,0.14)" }} />}
              <RoleRow role={role} index={i} onPress={() => onSelectRole(role.key)} />
            </React.Fragment>
          ))}

          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", color: INK, opacity: 0.4, textAlign: "center", marginTop: 18 }}>
            Aussi depuis l'onglet Plus
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}
