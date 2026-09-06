import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { NoticeCapsule } from "@/components/ui/NoticeCapsule";

/**
 * Notification flottante d'erreur d'action — même capsule Liquid Glass et même
 * position que la bannière "hors connexion". S'affiche quand `message` passe à
 * une valeur non nulle et se referme seule après `duration` ms.
 */
export function FloatingNotice({
  message,
  onHide,
  icon = "alert-circle-outline",
  duration = 4000,
}: {
  message: string | null;
  onHide: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number;
}) {
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shown = message != null;

  useEffect(() => {
    if (!shown) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onHide();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [shown, duration, onHide, translateY, opacity]);

  if (!shown) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        // décalée sous la bannière "hors connexion" si les deux sont visibles
        top: insets.top + 8 + (isConnected ? 0 : 46),
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 9999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <NoticeCapsule icon={icon} text={message ?? ""} />
    </Animated.View>
  );
}
