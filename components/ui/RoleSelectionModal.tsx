import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Modal, StyleSheet,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

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
  color: string;
  bg: string;
  border: string;
  gradient?: [string, string, string];
}> = [
  {
    key: "client", label: "Espace Client", subtitle: "Réservations & favoris",
    icon: "heart-outline", color: Colors.primary, bg: Colors.primaryLight, border: `${Colors.primary}35`,
  },
  {
    key: "pro", label: "Espace Pro", subtitle: "Gestion clients & RDV",
    icon: "briefcase-outline", color: Colors.pro, bg: `${Colors.pro}10`, border: `${Colors.pro}35`,
  },
  {
    key: "admin", label: "Administration", subtitle: "Gestion plateforme complète",
    icon: "shield-checkmark-outline", color: Colors.admin, bg: `${Colors.admin}0D`, border: `${Colors.admin}40`,
    gradient: ["#EA6000", "#F97316", "#FBAB6A"],
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
  const translateY = useRef(new Animated.Value(28)).current;
  const scale      = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.delay(index * 90),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
          Animated.spring(scale,      { toValue: 1, damping: 18, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(28);
      scale.setValue(0.95);
    }
  }, [visible]);

  if (role.gradient) {
    return (
      <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onPress();
          }}
          style={({ pressed }) => [{ borderRadius: 20, overflow: "hidden", opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
        >
          <LinearGradient
            colors={role.gradient!}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 18 }}
          >
            <View style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.08)" }} />
            <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Ionicons name={role.icon} size={24} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.white, marginBottom: 2 }}>{role.label}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{role.subtitle}</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)" }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.white, letterSpacing: 0.8 }}>ACCÈS TOTAL</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
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
        <View style={[styles.iconWrap, { backgroundColor: `${role.color}1A` }]}>
          <Ionicons name={role.icon} size={22} color={role.color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardLabel}>{role.label}</Text>
          <Text style={styles.cardSub}>{role.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
      </Pressable>
    </Animated.View>
  );
}

export default function RoleSelectionModal({ visible, userName, userInitials, onSelectRole, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const sheetOpacity    = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(sheetOpacity,    { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
      ]).start();
    } else {
      sheetOpacity.setValue(0);
      sheetTranslateY.setValue(50);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom + 20, 28) },
          { opacity: sheetOpacity, transform: [{ translateY: sheetTranslateY }] },
        ]}>
          {/* Close button */}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={Colors.mutedForeground} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            {/* Avatar with gradient */}
            <LinearGradient
              colors={["#EA6000", "#F97316", "#FBAB6A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{userInitials}</Text>
            </LinearGradient>
            <Text style={styles.greeting}>Bonjour, {userName} 👋</Text>
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
  overlay: { flex: 1, backgroundColor: Colors.overlay, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  sheet: { width: "100%", maxWidth: 420, backgroundColor: Colors.card, borderRadius: 32, padding: 24, shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.14, shadowRadius: 48, elevation: 24 },
  closeBtn: { position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center", zIndex: 10 },
  header: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  avatarText: { fontSize: 26, fontWeight: "900", color: Colors.white },
  greeting: { fontSize: 22, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.4, marginBottom: 4 },
  subHeading: { fontSize: 14, color: Colors.mutedForeground, fontWeight: "500" },
  list: { gap: 10, marginBottom: 20 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1.5 },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardContent: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 2 },
  cardSub: { fontSize: 12, color: Colors.mutedForeground, fontWeight: "500" },
  footer: { fontSize: 11, color: Colors.mutedForeground, textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
});
