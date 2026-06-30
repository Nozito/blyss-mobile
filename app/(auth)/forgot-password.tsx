import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { authApi } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail]         = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent]           = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);

  const handleEmailChange = useCallback((v: string) => {
    setEmail(v);
    setApiError(null);
    if (v.length > 0 && !EMAIL_REGEX.test(v)) {
      setEmailError("Format d'email invalide");
    } else {
      setEmailError(undefined);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!email.trim()) return;
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError("Format d'email invalide");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSending(true);
    setApiError(null);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      // Always show success to avoid email enumeration
      setSent(true);
    } catch {
      setApiError("Impossible d'envoyer l'email — vérifie ta connexion");
    } finally {
      setIsSending(false);
    }
  }, [email]);

  const isDisabled = isSending || !email.trim() || !!emailError;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.mutedForeground} />
            <Text style={styles.backText}>Retour</Text>
          </AnimatedIconButton>

          {sent ? (
            /* ── Success state ───────────────────────────────────────── */
            <View style={styles.centeredBlock}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-outline" size={36} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Email envoyé ✉️</Text>
              <Text style={styles.subtitle}>
                Si cette adresse est associée à un compte, tu recevras un lien dans quelques minutes.
              </Text>
              <Text style={styles.spamHint}>Pense à vérifier tes spams.</Text>

              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                style={styles.ctaBtn}
              >
                <Text style={styles.ctaBtnText}>Retour à la connexion</Text>
              </Pressable>
            </View>
          ) : (
            /* ── Form state ──────────────────────────────────────────── */
            <>
              <View style={styles.centeredBlock}>
                <View style={styles.iconCircle}>
                  <Ionicons name="lock-open-outline" size={36} color={Colors.primary} />
                </View>
                <Text style={styles.title}>Mot de passe oublié</Text>
                <Text style={styles.subtitle}>
                  Saisis ton email et on t'envoie un lien de réinitialisation.
                </Text>
              </View>

              <View style={styles.form}>
                {apiError && <ErrorMessage message={apiError} />}

                <Input
                  label="Adresse email"
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="ton@email.fr"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCapitalize="none"
                  leftIcon="mail-outline"
                  error={emailError}
                />

                <Pressable
                  onPress={handleSubmit}
                  disabled={isDisabled}
                  style={[styles.ctaBtn, isDisabled && styles.ctaBtnDisabled]}
                >
                  {isSending ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <View style={styles.ctaBtnInner}>
                      <Ionicons name="send-outline" size={18} color={Colors.white} />
                      <Text style={styles.ctaBtnText}>Envoyer le lien</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                style={styles.loginLink}
              >
                <Text style={styles.loginLinkText}>Retour à la connexion</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },

  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 32 },
  backText: { fontSize: 14, color: Colors.mutedForeground, fontWeight: "500" },

  centeredBlock: { alignItems: "center", marginBottom: 32, gap: 12 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.foreground,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },
  spamHint: {
    fontSize: 12,
    color: Colors.mutedForeground,
    textAlign: "center",
    opacity: 0.7,
  },

  form: { gap: 16 },

  ctaBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  ctaBtnDisabled: { backgroundColor: Colors.disabled, shadowOpacity: 0, elevation: 0 },
  ctaBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: Colors.white },

  loginLink: { alignItems: "center", marginTop: 20 },
  loginLinkText: { fontSize: 14, fontWeight: "600", color: Colors.primary },
});
