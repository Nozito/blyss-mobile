import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { authApi } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { FloatingNotice } from "@/components/ui/FloatingNotice";
import { PillButton, PosterField } from "@/components/onboarding/kit";
import { safeBack } from "@/lib/navigation";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,128}$/;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const ink = colors.foreground;
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = useCallback(async () => {
    setNotice(null);
    if (!PASSWORD_REGEX.test(password)) {
      setNotice("8 car. min., 1 majuscule, 1 chiffre, 1 caractère spécial");
      return;
    }
    if (password !== confirm) {
      setNotice("Les mots de passe ne correspondent pas");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const res = await authApi.resetPassword({ token: token ?? "", password });
      if (!res.success) {
        setNotice(res.error ?? "Lien invalide ou expiré, demande un nouveau lien");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.replace("/(auth)/login"), 1400);
    } catch {
      setNotice("Lien invalide ou expiré, demande un nouveau lien");
    } finally {
      setIsLoading(false);
    }
  }, [password, confirm, token, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <Pressable onPress={() => safeBack(router)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
            <Text style={{ color: ink, fontSize: 22, opacity: 0.7 }}>←</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          {success ? (
            <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
              <Text style={{ color: ink, fontWeight: "900", fontSize: 32, lineHeight: 33, letterSpacing: -1, textTransform: "uppercase" }}>
                Mot de passe{"\n"}mis à jour
              </Text>
              <Text style={{ color: ink, opacity: 0.65, fontSize: 13, marginTop: 12 }}>Redirection vers la connexion…</Text>
            </View>
          ) : (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: ink, fontWeight: "900", fontSize: 30, lineHeight: 31, letterSpacing: -0.8, textTransform: "uppercase" }}>
                  Nouveau mot de passe
                </Text>
                <Text style={{ color: ink, opacity: 0.65, fontSize: 13, marginTop: 8, marginBottom: 22 }}>
                  8 caractères minimum, une majuscule, un chiffre, un caractère spécial.
                </Text>
                <PosterField
                  label="Nouveau mot de passe"
                  ink={ink}
                  accent={colors.primary}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setNotice(null);
                  }}
                  secureTextEntry={!showPwd}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  autoCapitalize="none"
                  placeholder="8 caractères minimum"
                  right={
                    <Pressable onPress={() => setShowPwd((s) => !s)} hitSlop={10}>
                      <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color={withAlpha(ink, 0.6)} />
                    </Pressable>
                  }
                />
                <View style={{ marginTop: 14 }}>
                  <PosterField
                    label="Confirmer"
                    ink={ink}
                    accent={colors.primary}
                    value={confirm}
                    onChangeText={(v) => {
                      setConfirm(v);
                      setNotice(null);
                    }}
                    secureTextEntry={!showPwd}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    autoCapitalize="none"
                    placeholder="Répète ton mot de passe"
                  />
                </View>
              </ScrollView>
              <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8 }}>
                <PillButton
                  label="Enregistrer →"
                  onPress={handleReset}
                  bg={password && confirm ? ink : withAlpha(ink, 0.25)}
                  fg={colors.background}
                  loading={isLoading}
                  disabled={!password || !confirm}
                />
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <FloatingNotice message={notice} onHide={() => setNotice(null)} />
    </View>
  );
}
