import React, { useEffect, useRef } from "react";
import { Animated, Platform, Text } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";

/**
 * Notification flottante "hors connexion" — capsule sobre façon Liquid Glass
 * (matériau flou translucide), posée sous la safe area, non interactive.
 * Remplace l'ancien bandeau ambré pleine largeur.
 */
export function OfflineBanner() {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const { isConnected } = useNetworkStatus();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isConnected) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isConnected, translateY, opacity]);

  // Fallback lisible partout : la teinte translucide est peinte sous le flou,
  // donc la capsule reste correcte même si Android ne rend pas le blur.
  const surface = isDark ? "rgba(28,28,30,0.72)" : "rgba(255,255,255,0.72)";
  const hairline = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)";

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 9999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <BlurView
        intensity={Platform.OS === "ios" ? 40 : 20}
        tint={isDark ? "dark" : "light"}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          maxWidth: "90%",
          paddingVertical: 9,
          paddingHorizontal: 16,
          borderRadius: 999,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: hairline,
          backgroundColor: surface,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.4 : 0.12,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <Ionicons name="wifi-outline" size={15} color={colors.foreground} />
        <Text
          accessibilityRole="alert"
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}
        >
          Pas de connexion internet
        </Text>
      </BlurView>
    </Animated.View>
  );
}
