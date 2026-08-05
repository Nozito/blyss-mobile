import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal as RNModal,
  View,
  Text,
  Pressable,
  type ModalProps as RNModalProps,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StyleSheet,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface ModalProps extends Omit<RNModalProps, "children"> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  bottomSheet?: boolean;
  noPadding?: boolean;
  maxHeight?: number | string;
}

export function Modal({
  visible,
  onClose,
  title,
  children,
  bottomSheet = false,
  noPadding = false,
  maxHeight,
  ...props
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();

      if (bottomSheet) {
        Animated.spring(translateY, {
          toValue: 0,
          damping: 26,
          stiffness: 280,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(scale, {
          toValue: 1,
          damping: 22,
          stiffness: 300,
          useNativeDriver: true,
        }).start();
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      if (bottomSheet) {
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 280,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 180,
          useNativeDriver: true,
        }).start();
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [visible]);

  return (
    <RNModal
      {...props}
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Overlay fixe — ne bouge JAMAIS */}
        <Animated.View
          style={[{ opacity: overlayOpacity }, { position: "absolute", inset: 0 }]}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Contenu animé */}
        {bottomSheet ? (
          <Animated.View
            style={[
              { transform: [{ translateY }] },
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: colors.card,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: insets.bottom + 16,
              },
              maxHeight != null ? ({ maxHeight } as object) : undefined,
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={(e) => e.stopPropagation()}>
              {!noPadding && (
                <>
                  {/* Handle */}
                  <View className="items-center pt-3 pb-2">
                    <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                  </View>

                  {title && (
                    <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border }}>
                      <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>{title}</Text>
                      <AnimatedIconButton onPress={onClose} className="p-1" accessibilityLabel="Fermer">
                        <Ionicons name="close" size={22} color={colors.mutedForeground} />
                      </AnimatedIconButton>
                    </View>
                  )}

                  <View className="p-5">{children}</View>
                </>
              )}
              {noPadding && <>{children}</>}
            </Pressable>
          </Animated.View>
        ) : (
          <View className="flex-1 justify-center px-4">
            <Animated.View
              style={[
                { transform: [{ scale }], opacity },
                {
                  backgroundColor: colors.card,
                  borderRadius: 24,
                  overflow: "hidden",
                  maxWidth: 500,
                  alignSelf: "center",
                  width: "100%",
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                {title && (
                  <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderBottomColor: colors.border }}>
                    <Text className="text-lg font-semibold" style={{ color: colors.foreground }}>{title}</Text>
                    <AnimatedIconButton onPress={onClose} className="p-1" accessibilityLabel="Fermer">
                      <Ionicons name="close" size={22} color={colors.mutedForeground} />
                    </AnimatedIconButton>
                  </View>
                )}
                <View className="p-5">{children}</View>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </KeyboardAvoidingView>
    </RNModal>
  );
}
