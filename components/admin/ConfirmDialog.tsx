import React from "react";
import { View, Text, Modal, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { ADMIN } from "@/constants/adminTheme";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** Plain text or pre-composed <Text> tree (e.g. to bold a name/amount). */
  message: React.ReactNode;
  /** Defaults to "Confirmer". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling + heavy haptic. Set false for non-destructive confirmations. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Generic confirmation modal for irreversible admin actions.
 * Extracted from the refund dialog in payments.tsx — reuse this instead of
 * mutating directly on ban / delete / mass-push / etc.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = true,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const accent = danger ? ADMIN.danger : ADMIN.accent;
  const accentBg = danger ? ADMIN.dangerBg : ADMIN.accentBg;
  const accentBorder = danger ? ADMIN.dangerBorder : ADMIN.accentBorder;

  const handleConfirm = () => {
    if (danger) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: ADMIN.overlay, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={loading ? undefined : onClose} />
        <View
          accessibilityRole="alert"
          style={{ backgroundColor: ADMIN.surface, borderRadius: 20, padding: 24, width: "100%", borderWidth: 1, borderColor: ADMIN.border }}
        >
          <Text style={{ fontSize: 18, fontWeight: "900", color: ADMIN.text, marginBottom: 10 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: ADMIN.textSub, lineHeight: 20, marginBottom: 24 }}>{message}</Text>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <AnimatedPressable
              onPress={onClose}
              disabled={loading}
              accessibilityLabel={cancelLabel}
              style={{ flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: ADMIN.border, alignItems: "center", justifyContent: "center", opacity: loading ? 0.5 : 1 }}
            >
              <Text style={{ color: ADMIN.textSub, fontWeight: "700" }}>{cancelLabel}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleConfirm}
              disabled={loading}
              accessibilityLabel={confirmLabel}
              style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: accentBg, borderWidth: 1, borderColor: accentBorder, alignItems: "center", justifyContent: "center" }}
            >
              {loading
                ? <ActivityIndicator size="small" color={accent} />
                : <Text style={{ color: accent, fontWeight: "800" }}>{confirmLabel}</Text>}
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Small helper to keep call sites terse: `const [target, confirm] = useConfirm<AdminUser>();` */
export function useConfirm<T>() {
  const [target, setTarget] = React.useState<T | null>(null);
  return {
    target,
    open: (t: T) => setTarget(t),
    close: () => setTarget(null),
  };
}
