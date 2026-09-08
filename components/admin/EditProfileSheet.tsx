import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Édition du compte admin courant : prénom, nom, email. */
export function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    firstName.trim() !== (user?.first_name ?? "") ||
    lastName.trim() !== (user?.last_name ?? "") ||
    email.trim().toLowerCase() !== (user?.email ?? "").toLowerCase();

  const save = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("Prénom et nom requis.");
    if (!EMAIL_RE.test(email.trim())) return setError("Email invalide.");
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const res = await updateUser({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
    });
    setSaving(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } else {
      setError(res.error ?? "Enregistrement impossible.");
    }
  };

  const Field = ({ label, value, onChangeText, keyboardType, autoCapitalize }: {
    label: string; value: string; onChangeText: (t: string) => void;
    keyboardType?: "email-address" | "default"; autoCapitalize?: "words" | "none";
  }) => (
    <View style={{ marginBottom: ADMIN.space.md }}>
      <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholderTextColor={ADMIN.textMuted}
        style={{
          height: 46, borderWidth: 1, borderColor: ADMIN.border,
          paddingHorizontal: 12, color: ADMIN.text, fontSize: 15,
        }}
      />
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: ADMIN.overlay }} onPress={onClose} />
        <View style={{
          backgroundColor: ADMIN.surface,
          borderTopLeftRadius: ADMIN.sheetRadius, borderTopRightRadius: ADMIN.sheetRadius,
          paddingHorizontal: ADMIN.space.xl, paddingBottom: ADMIN.space.xxl, paddingTop: ADMIN.space.md,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: ADMIN.sheetHandle, alignSelf: "center", marginBottom: ADMIN.space.xl }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: ADMIN.space.xl }}>
            <Text style={{ ...ADMIN.type.title, color: ADMIN.text }}>Mon compte</Text>
            <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 4, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={ADMIN.textSub} />
            </AnimatedIconButton>
          </View>

          <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
            <View style={{ flex: 1 }}><Field label="Prénom" value={firstName} onChangeText={setFirstName} autoCapitalize="words" /></View>
            <View style={{ flex: 1 }}><Field label="Nom" value={lastName} onChangeText={setLastName} autoCapitalize="words" /></View>
          </View>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          {error && <View style={{ marginBottom: ADMIN.space.md }}><ErrorMessage message={error} /></View>}

          <AnimatedPressable
            onPress={save}
            disabled={saving || !dirty}
            style={{
              height: 50, backgroundColor: ADMIN.accent, alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 8, opacity: saving || !dirty ? 0.5 : 1,
            }}
          >
            {saving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.white }}>Enregistrer</Text>}
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
