import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Modal, Animated, Platform, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { Colors, withAlpha } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

// Sheet neutre, sombre — cohérent avec le thème admin, mais pas "branded"
// puisque ce modal sert aussi les comptes client/pro.
const SHEET   = "#17151A";
const CARD    = "#1F1C22";
const CARD_HOVER = "#26222A";
const BORDER  = "rgba(245,241,238,0.08)";
const TEXT1   = "#F5F1EE";
const TEXT2   = "rgba(245,241,238,0.58)";
const TEXT3   = "rgba(245,241,238,0.34)";
const ACCENT  = Colors.primary;

export type AdminRole = "client" | "pro" | "admin";

interface Props {
  visible: boolean;
  userName: string;
  userInitials: string;
  onSelectRole: (role: AdminRole) => void;
  onClose: () => void;
}

const ROLES = [
  {
    key:    "client"             as AdminRole,
    label:  "Espace Client",
    sub:    "Réservations & favoris",
    symbol: "heart.fill"         as const,
    icon:   "heart"              as const,
    color:  Colors.primary,
  },
  {
    key:    "pro"                as AdminRole,
    label:  "Espace Pro",
    sub:    "Gestion clients & rendez-vous",
    symbol: "briefcase.fill"     as const,
    icon:   "briefcase"          as const,
    color:  Colors.pro,
  },
  {
    key:    "admin"              as AdminRole,
    label:  "Administration",
    sub:    "Accès complet à la plateforme",
    symbol: "shield.fill"        as const,
    icon:   "shield-checkmark"   as const,
    color:  Colors.admin,
  },
] as const;

// ─── RoleRow ──────────────────────────────────────────────────────────────────

function RoleRow({
  role, index, visible, onPress,
}: {
  role: typeof ROLES[number];
  index: number;
  visible: boolean;
  onPress: () => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.delay(50 + index * 55),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(14);
    }
  }, [visible]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPressIn={() =>
          Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
        }
        onPressOut={() =>
          Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 5 }).start()
        }
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
      >
        <Animated.View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 16,
          backgroundColor: CARD,
          transform: [{ scale: pressScale }],
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 13,
            backgroundColor: withAlpha(role.color, 0.16),
            alignItems: "center", justifyContent: "center",
          }}>
            {Platform.OS === "ios" ? (
              <SymbolView name={role.symbol} size={20} tintColor={role.color} />
            ) : (
              <Ionicons name={role.icon} size={20} color={role.color} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: TEXT1, marginBottom: 2 }}>
              {role.label}
            </Text>
            <Text style={{ fontSize: 12, color: TEXT2 }}>
              {role.sub}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={15} color={TEXT3} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function RoleSelectionModal({
  visible, userName, userInitials, onSelectRole, onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(560)).current;
  const headerOpacity   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, damping: 24, stiffness: 280, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(60),
        Animated.timing(headerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(560);
      headerOpacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", opacity: overlayOpacity }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Bottom sheet */}
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: SHEET,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: Math.max(insets.bottom + 16, 28),
        transform: [{ translateY: sheetTranslateY }],
        overflow: "hidden",
      }}>
        {/* Handle */}
        <View style={{
          width: 36, height: 4, borderRadius: 2,
          backgroundColor: "rgba(245,241,238,0.16)",
          alignSelf: "center", marginTop: 12, marginBottom: 6,
        }} />

        {/* Bouton fermer */}
        <AnimatedIconButton
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Fermer"
          style={{
            position: "absolute", top: 14, right: 18, zIndex: 10,
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: CARD_HOVER,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={16} color={TEXT2} />
        </AnimatedIconButton>

        {/* Header */}
        <Animated.View style={{
          alignItems: "center",
          paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24,
          opacity: headerOpacity,
        }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20,
            backgroundColor: withAlpha(ACCENT, 0.18),
            alignItems: "center", justifyContent: "center",
            marginBottom: 14,
          }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: ACCENT }}>
              {userInitials || "A"}
            </Text>
          </View>

          <Text style={{
            fontSize: 19, fontWeight: "700", color: TEXT1,
            letterSpacing: -0.3, marginBottom: 4,
          }}>
            Bonjour, {userName || "Admin"}
          </Text>
          <Text style={{ fontSize: 13, color: TEXT2 }}>
            Choisis ton interface
          </Text>
        </Animated.View>

        {/* Séparateur */}
        <View style={{ height: 1, backgroundColor: BORDER, marginHorizontal: 20, marginBottom: 16 }} />

        {/* Cartes */}
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {ROLES.map((role, i) => (
            <RoleRow
              key={role.key}
              role={role}
              index={i}
              visible={visible}
              onPress={() => onSelectRole(role.key)}
            />
          ))}
        </View>

        {/* Footer */}
        <Text style={{
          fontSize: 11, color: TEXT3,
          textAlign: "center", marginTop: 18,
          paddingHorizontal: 32, lineHeight: 16,
        }}>
          Accessible à tout moment depuis l'onglet Plus
        </Text>
      </Animated.View>
    </Modal>
  );
}
