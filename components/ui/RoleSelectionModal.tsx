import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export type AdminRole = "client" | "pro" | "admin";

interface Props {
  visible: boolean;
  userName: string;
  onSelectRole: (role: AdminRole) => void;
  onClose: () => void;
}

const ROLES: Array<{
  key: AdminRole;
  label: string;
  subtitle: string;
  detail: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  colors: [string, string, string];
  badge?: string;
}> = [
  {
    key: "client",
    label: "Espace Client",
    subtitle: "Réservations & favoris",
    detail: "Vue utilisateur finale",
    icon: "heart-outline",
    colors: ["#F43F8E", "#EC4899", "#A855F7"],
  },
  {
    key: "pro",
    label: "Espace Professionnel",
    subtitle: "Gestion clients & rendez-vous",
    detail: "Dashboard optimisé",
    icon: "briefcase-outline",
    colors: ["#FE5D9D", "#FE5D9D", "#8B5CF6"],
  },
  {
    key: "admin",
    label: "Administration Blyss",
    subtitle: "Gestion plateforme complète",
    detail: "Accès privilégié",
    icon: "shield-outline",
    colors: ["#F97316", "#EA580C", "#EF4444"],
    badge: "Admin",
  },
];

export default function RoleSelectionModal({ visible, userName, onSelectRole, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Card */}
        <View
          style={[
            styles.card,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
        >
          {/* Close button */}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color="#6D6D78" />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles-outline" size={28} color="#FE5D9D" />
            </View>
            <Text style={styles.title}>Bienvenue {userName} !</Text>
            <Text style={styles.subtitle}>Choisis ton espace de travail</Text>
          </View>

          {/* Role options */}
          <View style={styles.options}>
            {ROLES.map((role) => (
              <Pressable
                key={role.key}
                onPress={() => onSelectRole(role.key)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <LinearGradient
                  colors={role.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.optionGradient}
                >
                  {/* Admin badge */}
                  {role.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{role.badge}</Text>
                    </View>
                  )}

                  {/* Icon */}
                  <View style={styles.optionIcon}>
                    <Ionicons name={role.icon} size={26} color="#fff" />
                  </View>

                  {/* Labels */}
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{role.label}</Text>
                    <View style={styles.optionMeta}>
                      <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.optionSubtitle}>{role.subtitle}</Text>
                    </View>
                    <View style={styles.optionMeta}>
                      <Ionicons name="sparkles-outline" size={11} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.optionDetail}>{role.detail}</Text>
                    </View>
                  </View>

                  {/* Arrow */}
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          {/* Footer hint */}
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Tu pourras basculer entre les interfaces à tout moment depuis tes paramètres
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8F5F1",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(254,93,157,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(254,93,157,0.2)",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#09090B",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6D6D78",
    fontWeight: "500",
  },
  options: {
    gap: 10,
  },
  option: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  optionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    flexShrink: 0,
  },
  optionContent: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  optionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  optionSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  optionDetail: {
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "500",
  },
  hint: {
    marginTop: 20,
    backgroundColor: "#F8F5F1",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EBE6E0",
  },
  hintText: {
    fontSize: 11,
    color: "#6D6D78",
    textAlign: "center",
    lineHeight: 16,
    fontWeight: "500",
  },
});
