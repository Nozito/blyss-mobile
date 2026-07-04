import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Modal, Animated, Platform, StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

// Mêmes tokens que dashboard.tsx
const CARD   = "rgba(255,255,255,0.045)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT1  = Colors.white;
const TEXT2  = "rgba(255,255,255,0.50)";
const TEXT3  = "rgba(255,255,255,0.28)";

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
  const translateY = useRef(new Animated.Value(20)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.delay(60 + index * 65),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 220, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [visible]);

  const isAdmin = role.key === "admin";

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Pressable
        onPressIn={() =>
          Animated.spring(pressScale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
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
          borderRadius: 20,
          backgroundColor: CARD,
          borderWidth: 1,
          borderColor: isAdmin ? `${Colors.admin}30` : BORDER,
          shadowColor: role.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isAdmin ? 0.18 : 0.10,
          shadowRadius: 12,
          elevation: 4,
          transform: [{ scale: pressScale }],
        }}>
          {/* Icon container — pattern identique au dashboard */}
          <LinearGradient
            colors={[`${role.color}28`, `${role.color}0E`]}
            style={{
              width: 48, height: 48, borderRadius: 15,
              alignItems: "center", justifyContent: "center",
            }}
          >
            {Platform.OS === "ios" ? (
              <SymbolView name={role.symbol} size={22} tintColor={role.color} />
            ) : (
              <Ionicons name={role.icon} size={22} color={role.color} />
            )}
          </LinearGradient>

          {/* Texte */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT1, marginBottom: 3 }}>
              {role.label}
            </Text>
            <Text style={{ fontSize: 12, color: TEXT2, fontWeight: "500" }}>
              {role.sub}
            </Text>
          </View>

          {/* Chevron */}
          {Platform.OS === "ios" ? (
            <SymbolView name="chevron.right" size={12} tintColor={TEXT3} />
          ) : (
            <Ionicons name="chevron-forward" size={14} color={TEXT3} />
          )}
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
  const avatarScale     = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(sheetTranslateY, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.delay(80),
        Animated.parallel([
          Animated.timing(headerOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(avatarScale,   { toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      overlayOpacity.setValue(0);
      sheetTranslateY.setValue(560);
      headerOpacity.setValue(0);
      avatarScale.setValue(0.75);
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
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)", opacity: overlayOpacity }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Bottom sheet */}
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: "#0D0D18",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        borderTopWidth: 1, borderTopColor: BORDER,
        paddingBottom: Math.max(insets.bottom + 16, 28),
        transform: [{ translateY: sheetTranslateY }],
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.55,
        shadowRadius: 24,
        elevation: 30,
        overflow: "hidden",
      }}>
        {/* Ligne accent orange en haut du sheet */}
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 1, backgroundColor: `${Colors.admin}40`,
        }} />

        {/* Handle */}
        <View style={{
          width: 36, height: 4, borderRadius: 2,
          backgroundColor: "rgba(255,255,255,0.13)",
          alignSelf: "center", marginTop: 12, marginBottom: 6,
        }} />

        {/* Bouton fermer */}
        <AnimatedIconButton
          onPress={onClose}
          hitSlop={12}
          style={{
            position: "absolute", top: 14, right: 18, zIndex: 10,
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.07)",
            borderWidth: 1, borderColor: BORDER,
            alignItems: "center", justifyContent: "center",
          }}
        >
          {Platform.OS === "ios" ? (
            <SymbolView name="xmark" size={11} tintColor={TEXT2} />
          ) : (
            <Ionicons name="close" size={15} color={TEXT2} />
          )}
        </AnimatedIconButton>

        {/* Header */}
        <Animated.View style={{
          alignItems: "center",
          paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24,
          opacity: headerOpacity,
        }}>
          {/* Avatar */}
          <Animated.View style={{ transform: [{ scale: avatarScale }], marginBottom: 16 }}>
            <LinearGradient
              colors={["#EA6000", Colors.admin, "#FBAB6A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72, height: 72, borderRadius: 24,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.white }}>
                {userInitials || "A"}
              </Text>
            </LinearGradient>
          </Animated.View>

          <Text style={{
            fontSize: 22, fontWeight: "900", color: TEXT1,
            letterSpacing: -0.3, marginBottom: 4,
          }}>
            Bonjour, {userName || "Admin"} 👋
          </Text>
          <Text style={{ fontSize: 13, color: TEXT2, fontWeight: "500" }}>
            Choisis ton interface
          </Text>
        </Animated.View>

        {/* Séparateur */}
        <View style={{ height: 1, backgroundColor: BORDER, marginHorizontal: 20, marginBottom: 16 }} />

        {/* Cartes */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
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
