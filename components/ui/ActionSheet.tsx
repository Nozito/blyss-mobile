import React, { createContext, useCallback, useContext, useState } from "react";
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/useThemeColors";
import { ADMIN } from "@/constants/adminTheme";

interface ActionSheetOptions {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex: number;
  destructiveButtonIndex?: number | number[];
  /** iOS only — forces the native sheet's appearance regardless of system setting. Use "dark" from screens with a fixed dark theme (e.g. admin). Android's custom sheet below doesn't read this yet. */
  userInterfaceStyle?: "light" | "dark";
}

function isDestructive(index: number, destructiveButtonIndex?: number | number[]) {
  return Array.isArray(destructiveButtonIndex)
    ? destructiveButtonIndex.includes(index)
    : destructiveButtonIndex === index;
}

type ShowActionSheet = (options: ActionSheetOptions, callback: (index: number) => void) => void;

const ActionSheetContext = createContext<ShowActionSheet | null>(null);

// Cross-platform action sheet: native ActionSheetIOS on iOS, Modal list on Android.
export function useActionSheet(): ShowActionSheet {
  const androidShow = useContext(ActionSheetContext);

  return useCallback(
    (options, callback) => {
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(options, callback);
      } else {
        androidShow?.(options, callback);
      }
    },
    [androidShow]
  );
}

interface PendingSheet extends ActionSheetOptions {
  callback: (index: number) => void;
}

export function ActionSheetProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [pending, setPending] = useState<PendingSheet | null>(null);

  const show = useCallback<ShowActionSheet>((options, callback) => {
    setPending({ ...options, callback });
  }, []);

  const handleSelect = (index: number) => {
    const cb = pending?.callback;
    setPending(null);
    cb?.(index);
  };

  const dark = pending?.userInterfaceStyle === "dark";
  const theme = dark
    ? { sheetBg: ADMIN.surface, border: ADMIN.border, title: ADMIN.text, message: ADMIN.textSub, option: ADMIN.text, destructive: ADMIN.danger }
    : { sheetBg: colors.card,  border: colors.border, title: colors.foreground, message: colors.mutedForeground, option: colors.foreground, destructive: colors.destructive };

  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      <Modal
        visible={pending != null}
        transparent
        animationType="slide"
        onRequestClose={() => handleSelect(pending?.cancelButtonIndex ?? 0)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlayDark }]}
          onPress={() => handleSelect(pending?.cancelButtonIndex ?? 0)}
        >
          <View style={[styles.sheet, { backgroundColor: theme.sheetBg, paddingBottom: insets.bottom + 8 }]}>
            {pending?.title && <Text style={[styles.title, { color: theme.title }]}>{pending.title}</Text>}
            {pending?.message && <Text style={[styles.message, { color: theme.message }]}>{pending.message}</Text>}
            {pending?.options.map((label, index) =>
              index === pending.cancelButtonIndex ? null : (
                <Pressable
                  key={index}
                  style={[styles.option, { borderTopColor: theme.border }]}
                  onPress={() => handleSelect(index)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text
                    style={[
                      styles.optionText,
                      { color: theme.option },
                      isDestructive(index, pending.destructiveButtonIndex) && { color: theme.destructive },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            )}
            <Pressable
              style={[styles.option, styles.cancel, { borderTopColor: theme.border }]}
              onPress={() => handleSelect(pending?.cancelButtonIndex ?? 0)}
              accessibilityRole="button"
              accessibilityLabel="Annuler"
            >
              <Text style={[styles.optionText, { color: theme.option, fontWeight: "700" }]}>
                {pending?.options[pending.cancelButtonIndex] ?? "Annuler"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ActionSheetContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    paddingTop: 8,
  },
  message: {
    textAlign: "center",
    fontSize: 12,
    paddingBottom: 8,
  },
  option: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
  },
  cancel: {
    marginTop: 8,
  },
});
