import React, { createContext, useCallback, useContext, useState } from "react";
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

interface ActionSheetOptions {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex: number;
  destructiveButtonIndex?: number | number[];
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
  const [pending, setPending] = useState<PendingSheet | null>(null);

  const show = useCallback<ShowActionSheet>((options, callback) => {
    setPending({ ...options, callback });
  }, []);

  const handleSelect = (index: number) => {
    const cb = pending?.callback;
    setPending(null);
    cb?.(index);
  };

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
          style={styles.backdrop}
          onPress={() => handleSelect(pending?.cancelButtonIndex ?? 0)}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {pending?.title && <Text style={styles.title}>{pending.title}</Text>}
            {pending?.message && <Text style={styles.message}>{pending.message}</Text>}
            {pending?.options.map((label, index) =>
              index === pending.cancelButtonIndex ? null : (
                <Pressable
                  key={index}
                  style={styles.option}
                  onPress={() => handleSelect(index)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isDestructive(index, pending.destructiveButtonIndex) && { color: Colors.destructive },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            )}
            <Pressable
              style={[styles.option, styles.cancel]}
              onPress={() => handleSelect(pending?.cancelButtonIndex ?? 0)}
              accessibilityRole="button"
              accessibilityLabel="Annuler"
            >
              <Text style={[styles.optionText, { fontWeight: "700" }]}>
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
    backgroundColor: Colors.overlayDark,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: Colors.foreground,
    paddingTop: 8,
  },
  message: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.mutedForeground,
    paddingBottom: 8,
  },
  option: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: Colors.foreground,
  },
  cancel: {
    marginTop: 8,
  },
});
