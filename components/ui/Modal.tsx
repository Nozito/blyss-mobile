import React, { useEffect } from "react";
import {
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
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

  // Overlay opacity
  const overlayOpacity = useSharedValue(0);
  // Sheet translateY (pour bottomSheet) ou scale (pour modal centré)
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Overlay fade in
      overlayOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) });

      if (bottomSheet) {
        // Sheet slide up
        translateY.value = withSpring(0, {
          damping: 26,
          stiffness: 280,
          mass: 0.8,
        });
      } else {
        // Modal centré : fade + scale
        scale.value = withSpring(1, { damping: 22, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });

      if (bottomSheet) {
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: 280,
          easing: Easing.in(Easing.ease),
        });
      } else {
        scale.value = withTiming(0.92, { duration: 180 });
        opacity.value = withTiming(0, { duration: 180 });
      }
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const modalCenteredStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* Overlay fixe — ne bouge JAMAIS */}
        <Animated.View
          style={[overlayStyle, { position: "absolute", inset: 0 }]}
        >
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Contenu animé */}
        {bottomSheet ? (
          <Animated.View
            style={[
              sheetStyle,
              {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "white",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: insets.bottom + 16,
              },
              maxHeight != null ? ({ maxHeight } as object) : undefined,
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              {!noPadding && (
                <>
                  {/* Handle */}
                  <View className="items-center pt-3 pb-2">
                    <View className="w-10 h-1 rounded-full bg-border" />
                  </View>

                  {title && (
                    <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
                      <Text className="text-lg font-semibold text-foreground">{title}</Text>
                      <AnimatedIconButton onPress={onClose} className="p-1">
                        <Ionicons name="close" size={22} color={Colors.mutedForeground} />
                      </AnimatedIconButton>
                    </View>
                  )}

                  <View className="p-5">{children}</View>
                </>
              )}
              {noPadding && children}
            </Pressable>
          </Animated.View>
        ) : (
          <View className="flex-1 justify-center px-4">
            <Animated.View
              style={[
                modalCenteredStyle,
                {
                  backgroundColor: "white",
                  borderRadius: 24,
                  overflow: "hidden",
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                {title && (
                  <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
                    <Text className="text-lg font-semibold text-foreground">{title}</Text>
                    <AnimatedIconButton onPress={onClose} className="p-1">
                      <Ionicons name="close" size={22} color={Colors.mutedForeground} />
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
