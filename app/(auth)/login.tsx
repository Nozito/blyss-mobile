import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as AppleAuthentication from "expo-apple-authentication";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import { storage } from "@/lib/storage";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withAlpha } from "@/constants/colors";
import { FloatingNotice } from "@/components/ui/FloatingNotice";
import RoleSelectionModal, { type AdminRole } from "@/components/ui/RoleSelectionModal";
import { emailSchema, getZodError } from "@/lib/validation";
import { safeBack } from "@/lib/navigation";
import { useAppTransition } from "@/contexts/TransitionContext";
import { CREAM, PRUNE, PillButton, PosterField } from "@/components/onboarding/kit";

function parseLoginError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials") || r.includes("incorrect"))
    return "Email ou mot de passe incorrect";
  if (r.includes("email not confirmed")) return "Email non confirmé — vérifie ta boîte mail";
  if (r.includes("too many") || r.includes("rate limit")) return "Trop de tentatives — réessaie plus tard";
  if (r.includes("network") || r === "server_error") return "Pas de connexion — vérifie ton internet";
  return raw;
}

export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const { login, refreshProfile } = useAuth();
  const { showTransition, hideTransition } = useAppTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioType, setBioType] = useState<"face" | "fingerprint">("face");

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [loggedName, setLoggedName] = useState("");
  const [loggedRole, setLoggedRole] = useState<"pro" | "client">("client");

  useEffect(() => {
    const check = async () => {
      if (Platform.OS === "ios") {
        setAppleAvailable(await AppleAuthentication.isAvailableAsync().catch(() => false));
      }
      const token = await storage.getAccessToken();
      if (!token) return;
      if (!(await storage.getBiometricEnabled())) return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const isEnrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (hasHardware && isEnrolled) {
        setBioAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [] as number[]);
        const FACE_ID = LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION as number;
        setBioType(types.includes(FACE_ID) ? "face" : "fingerprint");
      }
    };
    void check();
  }, []);

  const handleEmailChange = useCallback((v: string) => {
    setEmail(v);
    setNotice(null);
    setEmailError(v.length > 0 ? (getZodError(emailSchema, v) ?? undefined) : undefined);
  }, []);

  const navigateAfterLogin = useCallback(
    (user: { role: string; is_admin: boolean; first_name?: string }) => {
      if (user.is_admin) {
        setLoggedName(user.first_name ?? "");
        setLoggedRole(user.role === "pro" ? "pro" : "client");
        setShowRoleModal(true);
        return;
      }
      showTransition();
      router.replace(user.role === "pro" ? "/(pro)/dashboard" : "/(client)");
      hideTransition();
    },
    [router, showTransition, hideTransition]
  );

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password) return;
    const emailErr = getZodError(emailSchema, email.trim());
    if (emailErr) {
      setEmailError(emailErr);
      setNotice(emailErr);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSubmitting(true);
    setNotice(null);
    try {
      const res = await login({ email: email.trim().toLowerCase(), password });
      if (!res.success) {
        setNotice(parseLoginError(res.error ?? "Erreur de connexion"));
      } else if (res.data?.user) {
        navigateAfterLogin(res.data.user);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login, navigateAfterLogin]);

  const handleAppleLogin = useCallback(async () => {
    setIsAppleLoading(true);
    setNotice(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken || !credential.authorizationCode) {
        setNotice("Apple Sign In a échoué — réessaie");
        return;
      }
      const res = await authApi.loginWithApple({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email,
        fullName: credential.fullName,
      });
      if (!res.success) {
        setNotice(res.error ?? "Erreur Apple Sign In");
      } else if (res.data?.user) {
        await refreshProfile();
        navigateAfterLogin(res.data.user);
      }
    } catch (e: unknown) {
      if (e instanceof Error && "code" in e && (e as { code: string }).code === "ERR_REQUEST_CANCELED") return;
      setNotice("Apple Sign In a échoué — réessaie");
    } finally {
      setIsAppleLoading(false);
    }
  }, [navigateAfterLogin, refreshProfile]);

  const handleBiometric = useCallback(async () => {
    setIsBioLoading(true);
    setNotice(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Identifie-toi pour accéder à Blyss",
        cancelLabel: "Annuler",
        fallbackLabel: "Mot de passe",
        disableDeviceFallback: false,
      });
      if (!result.success) return;
      const profile = await authApi.getProfile();
      if (profile.success && profile.data) {
        await refreshProfile();
        navigateAfterLogin(profile.data);
      } else {
        setNotice("Session expirée — connecte-toi avec ton mot de passe");
      }
    } catch {
      /* biométrie indisponible — silencieux */
    } finally {
      setIsBioLoading(false);
    }
  }, [navigateAfterLogin, refreshProfile]);

  const handleRoleSelection = useCallback(
    (selectedRole: AdminRole) => {
      setShowRoleModal(false);
      const routes: Record<AdminRole, string> = {
        client: "/(client)",
        pro: "/(pro)/dashboard",
        admin: "/(admin)/dashboard",
      };
      showTransition();
      router.replace(routes[selectedRole] as Parameters<typeof router.replace>[0]);
      hideTransition();
    },
    [router, showTransition, hideTransition]
  );

  const disabled = isSubmitting || !email.trim() || !password || !!emailError;
  const busy = isSubmitting || isAppleLoading || isBioLoading;

  return (
    <View style={{ flex: 1, backgroundColor: PRUNE }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => safeBack(router)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
            <Text style={{ color: CREAM, fontSize: 22, opacity: 0.75 }}>←</Text>
          </Pressable>
          <Text style={{ color: CREAM, opacity: 0.55, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Connexion</Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={12}>
          <Reanimated.View entering={reduceMotion ? undefined : FadeIn.duration(220)} style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ color: CREAM, fontWeight: "900", fontSize: 40, lineHeight: 40, letterSpacing: -1.2, textTransform: "uppercase" }}>
                Bon retour
              </Text>
              <Text style={{ color: CREAM, opacity: 0.75, fontSize: 13, marginTop: 8, marginBottom: 24 }}>
                Connecte-toi pour continuer.
              </Text>

              <PosterField
                label="Email"
                ink={CREAM}
                accent={colors.primary}
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                placeholder="ton@email.com"
              />

              <View style={{ marginTop: 14 }}>
                <PosterField
                  label="Mot de passe"
                  ink={CREAM}
                  accent={colors.primary}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setNotice(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  placeholder="••••••••"
                  right={
                    <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={withAlpha(CREAM, 0.6)} />
                    </Pressable>
                  }
                />
              </View>

              <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: 10 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" }}>
                  Mot de passe oublié ?
                </Text>
              </Pressable>
            </ScrollView>

            <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8, gap: 8 }}>
              <PillButton label="Se connecter →" onPress={handleSubmit} bg={CREAM} fg={PRUNE} loading={isSubmitting} disabled={disabled} />

              {bioAvailable && (
                <Pressable onPress={handleBiometric} disabled={busy} style={{ alignItems: "center", paddingVertical: 6 }}>
                  <Text style={{ color: CREAM, opacity: 0.7, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
                    {bioType === "face" ? "Face ID" : "Touch ID"}
                  </Text>
                </Pressable>
              )}

              {appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={999}
                  style={{ height: 48 }}
                  onPress={handleAppleLogin}
                />
              )}

              <Pressable onPress={() => router.push("/(auth)/register")} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: CREAM, opacity: 0.7, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Pas encore de compte ? S'inscrire
                </Text>
              </Pressable>

              <Text style={{ color: withAlpha(CREAM, 0.45), fontSize: 10, textAlign: "center", lineHeight: 15 }}>
                En continuant tu acceptes nos{" "}
                <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}>
                  CGU
                </Text>{" "}
                et la{" "}
                <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}>
                  politique de confidentialité
                </Text>
              </Text>
            </View>
          </Reanimated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <FloatingNotice message={notice} onHide={() => setNotice(null)} />

      <RoleSelectionModal
        visible={showRoleModal}
        userName={loggedName}
        userInitials={loggedName.slice(0, 2).toUpperCase() || "?"}
        onSelectRole={handleRoleSelection}
        onClose={() => {
          setShowRoleModal(false);
          router.replace(loggedRole === "pro" ? "/(pro)/dashboard" : "/(client)");
        }}
      />
    </View>
  );
}
