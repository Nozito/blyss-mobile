import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Modal, StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export type AdminRole = "client" | "pro" | "admin";

interface Props {
  visible: boolean;
  userName: string;
  userInitials: string;
  onSelectRole: (role: AdminRole) => void;
  onClose: () => void;
}

const ROLES: Array<{
  key: AdminRole;
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  bg: string;
  border: string;
  iconColor: string;
  badge?: string;
}> = [
  {
    key: "client", label: "Espace Client", subtitle: "Réservations & favoris",
    icon: "heart-outline", bg: "rgba(254,93,157,0.07)", border: "rgba(254,93,157,0.22)", iconColor: "#FE5D9D",
  },
  {
    key: "pro", label: "Espace Pro", subtitle: "Gestion clients & RDV",
    icon: "briefcase-outline", bg: "rgba(139,92,246,0.07)", border: "rgba(139,92,246,0.22)", iconColor: "#8B5CF6",
  },
  {
    key: "admin", label: "Administration", subtitle: "Gestion plateforme complète",
    icon: "shield-checkmark-outline", bg: "#0B0E14", border: "rgba(249,115,22,0.4)", iconColor: "#F97316", badge: "ACCÈS TOTAL",
  },
];

function AnimatedCard({
  role, index, onPress, visible,
}: {
  role: typeof ROLES[number];
  index: number;
  onPress: () => void;
  visible: boolean;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.delay(index * 80),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(22);
    }
  }, [visible]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: role.bg, borderColor: role.border },
          pressed && { opacity: 0.8, transform: [{ scale: 0.983 }] },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${role.iconColor}1A` }]}>
          <Ionicons name={role.icon} size={22} color={role.iconColor} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardLabel, role.key === "admin" && { color: "#F8FAFC" }]}>{role.label}</Text>
          <Text style={[styles.cardSub,   role.key === "admin" && { color: "rgba(248,250,252,0.48)" }]}>{role.subtitle}</Text>
        </View>
        {role.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{role.badge}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function RoleSelectionModal({ visible, userName, userInitials, onSelectRole, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const sheetOpacity    = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(sheetOpacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
      ]).start();
    } else {
      sheetOpacity.setValue(0);
      sheetTranslateY.setValue(40);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 20, 28) }, { opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }] }]}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </Pressable>

          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <Text style={styles.greeting}>Bonjour, {userName}</Text>
            <Text style={styles.subHeading}>Choisir ton interface</Text>
          </View>

          <View style={styles.list}>
            {ROLES.map((role, i) => (
              <AnimatedCard key={role.key} role={role} index={i} visible={visible} onPress={() => onSelectRole(role.key)} />
            ))}
          </View>

          <Text style={styles.footer}>Tu peux changer d'interface depuis les paramètres</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  sheet: { width: "100%", maxWidth: 400, backgroundColor: "#FFFFFF", borderRadius: 32, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.28, shadowRadius: 48, elevation: 24 },
  closeBtn: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", zIndex: 10 },
  header: { alignItems: "center", marginBottom: 22 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(249,115,22,0.12)", borderWidth: 2, borderColor: "rgba(249,115,22,0.25)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#F97316" },
  greeting: { fontSize: 22, fontWeight: "800", color: "#09090B", letterSpacing: -0.4, marginBottom: 3 },
  subHeading: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  list: { gap: 10, marginBottom: 18 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 15, borderRadius: 18, borderWidth: 1.5 },
  iconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardContent: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: "700", color: "#09090B", marginBottom: 2 },
  cardSub: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(249,115,22,0.16)", borderWidth: 1, borderColor: "rgba(249,115,22,0.32)" },
  badgeText: { fontSize: 8, fontWeight: "800", color: "#F97316", letterSpacing: 0.8, textTransform: "uppercase" },
  footer: { fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
});
