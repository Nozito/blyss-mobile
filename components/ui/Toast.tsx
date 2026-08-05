import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/useThemeColors";

type ToastType = "success" | "error";

interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const DURATION_MS = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.spring(translateY, { toValue: -100, useNativeDriver: true, speed: 20 }).start(() => {
      setToast(null);
    });
  }, [translateY]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      setToast({ message, type });
      translateY.setValue(-100);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16 }).start();
      hideTimeout.current = setTimeout(hide, DURATION_MS);
    },
    [hide, translateY]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            {
              top: insets.top + 8,
              transform: [{ translateY }],
              backgroundColor: toast.type === "success" ? colors.success : colors.destructive,
            },
          ]}
        >
          <Ionicons
            name={toast.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.message} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: colors.black,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
      zIndex: 1000,
    },
    message: {
      flex: 1,
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
