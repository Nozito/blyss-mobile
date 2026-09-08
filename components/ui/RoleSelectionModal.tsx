import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Modal, Animated, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ADMIN } from "@/constants/adminTheme";

// DA "Choc" — reprend le langage du web admin / onboarding : aplats de
// couleur pleins, index numérotés, titres 900 capitales, ruban rayé.
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

const ROLES = [
  { key: "client" as AdminRole, label: "Espace Client", sub: "Réservations & favoris",       bg: ROSE,  fg: INK,   dim: false },
  { key: "pro"    as AdminRole, label: "Espace Pro",    sub: "Clientes & rendez-vous",        bg: INK,   fg: CREAM, dim: true },
  { key: "admin"  as AdminRole, label: "Administration", sub: "Pilotage de la plateforme",    bg: PRUNE, fg: CREAM, dim: true },
] as const;

function RoleRow({
  role, index, visible, onPress,
}: {
  role: typeof ROLES[number];
  index: number;
  visible: boolean;
  onPress: () => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.delay(60 + index * 55),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      opacity.setValue(0);
      translateX.setValue(-16);
    }
  }, [visible, index, opacity, translateX]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 18,
          paddingHorizontal: 20,
          backgroundColor: role.bg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{
          fontSize: 22, fontWeight: "900", letterSpacing: -1, width: 30,
          color: role.fg, opacity: role.dim ? 0.45 : 1,
        }}>
          {String(index + 1).padStart(2, "0")}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "900", letterSpacing: -0.5, textTransform: "uppercase", color: role.fg }}>
            {role.label}
          </Text>
          <Text style={{ ...ADMIN.type.label, color: role.fg, opacity: role.dim ? 0.55 : 0.75, marginTop: 3 }}>
            {role.sub}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={role.fg} />
      </Pressable>
    </Animated.View>
  );
}

export default function RoleSelectionModal({
  visible, userName, onSelectRole, onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(560)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, damping: 26, stiffness: 300, useNativeDriver: true }),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(560);
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15,8,16,0.74)", opacity: overlayOpacity }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: CREAM,
        paddingBottom: Math.max(insets.bottom + 12, 24),
        transform: [{ translateY: sheetTranslateY }],
        overflow: "hidden",
      }}>
        {/* Ruban rayé rose × prune */}
        <View style={{ flexDirection: "row", height: 6 }}>
          {Array.from({ length: 26 }).map((_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? ROSE : PRUNE, transform: [{ skewX: "-24deg" }] }} />
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...ADMIN.type.label, color: INK, opacity: 0.55 }}>
              Connectée · {userName || "Admin"}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "900", letterSpacing: -1.4, textTransform: "uppercase", color: INK, marginTop: 8, lineHeight: 30 }}>
              Choisis{"\n"}ton espace
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

        <View style={{ marginTop: 6 }}>
          {ROLES.map((role, i) => (
            <RoleRow key={role.key} role={role} index={i} visible={visible} onPress={() => onSelectRole(role.key)} />
          ))}
        </View>

        <Text style={{ ...ADMIN.type.label, color: INK, opacity: 0.42, textAlign: "center", marginTop: 20, paddingHorizontal: 32 }}>
          Aussi depuis l'onglet Plus
        </Text>
      </Animated.View>
    </Modal>
  );
}
