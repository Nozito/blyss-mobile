import React, { useState, useCallback } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { authApi } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { FloatingNotice } from "@/components/ui/FloatingNotice";
import { PillButton, PosterField } from "@/components/onboarding/kit";
import { safeBack } from "@/lib/navigation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const ink = colors.foreground;

  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(async () => {
    const v = email.trim();
    if (!v) return;
    if (!EMAIL_REGEX.test(v)) {
      setNotice("Format d'email invalide");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSending(true);
    setNotice(null);
    try {
      await authApi.forgotPassword(v.toLowerCase());
      setSent(true); // succès systématique (anti-énumération)
    } catch {
      setNotice("Envoi impossible — vérifie ta connexion");
    } finally {
      setIsSending(false);
    }
  }, [email]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <Pressable onPress={() => safeBack(router)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
            <Text style={{ color: ink, fontSize: 22, opacity: 0.7 }}>←</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          {sent ? (
            <>
              <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                <Text style={{ color: ink, fontWeight: "900", fontSize: 34, lineHeight: 34, letterSpacing: -1, textTransform: "uppercase" }}>
                  Email envoyé
                </Text>
                <Text style={{ color: ink, opacity: 0.7, fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 320 }}>
                  Si cette adresse a un compte, tu reçois un lien dans quelques minutes. Pense à vérifier tes spams.
                </Text>
              </View>
              <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8 }}>
                <PillButton label="Retour à la connexion →" onPress={() => router.replace("/(auth)/login")} bg={ink} fg={colors.background} />
              </View>
            </>
          ) : (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: ink, fontWeight: "900", fontSize: 30, lineHeight: 31, letterSpacing: -0.8, textTransform: "uppercase" }}>
                  Mot de passe oublié
                </Text>
                <Text style={{ color: ink, opacity: 0.65, fontSize: 13, marginTop: 8, marginBottom: 22 }}>
                  Saisis ton email, on t'envoie un lien de réinitialisation.
                </Text>
                <PosterField
                  label="Email"
                  ink={ink}
                  accent={colors.primary}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setNotice(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="username"
                  placeholder="ton@email.com"
                />
              </ScrollView>
              <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8, gap: 8 }}>
                <PillButton
                  label="Envoyer le lien →"
                  onPress={handleSubmit}
                  bg={email.trim() ? ink : withAlpha(ink, 0.25)}
                  fg={colors.background}
                  loading={isSending}
                  disabled={!email.trim()}
                />
                <Pressable onPress={() => router.replace("/(auth)/login")} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={{ color: ink, opacity: 0.6, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>
                    Retour à la connexion
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <FloatingNotice message={notice} onHide={() => setNotice(null)} />
    </View>
  );
}
