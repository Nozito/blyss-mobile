import React from "react";
import {
  Modal as RNModal,
  View,
  Text,
  Pressable,
  type ModalProps as RNModalProps,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

interface ModalProps extends Omit<RNModalProps, "children"> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  bottomSheet?: boolean;
}

export function Modal({ visible, onClose, title, children, bottomSheet = false, ...props }: ModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <RNModal
      {...props}
      visible={visible}
      transparent
      animationType={bottomSheet ? "slide" : "fade"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={onClose}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className={[
              "bg-card",
              bottomSheet ? "rounded-t-3xl" : "mx-4 rounded-3xl",
            ].join(" ")}
            style={{ paddingBottom: bottomSheet ? insets.bottom + 16 : 0 }}
          >
            {/* Handle for bottom sheets */}
            {bottomSheet && (
              <View className="items-center pt-3 pb-2">
                <View className="w-10 h-1 rounded-full bg-border" />
              </View>
            )}

            {/* Header */}
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
        </Pressable>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
