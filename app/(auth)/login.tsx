import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
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
import { Input } from "@/components/ui/Input";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import RoleSelectionModal, { type AdminRole } from "@/components/ui/RoleSelectionModal";
import { emailSchema, getZodError } from "@/lib/validation";

function parseLoginError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials") || r.includes("incorrect"))
    return "Email ou mot de passe incorrect";
  if (r.includes("email not confirmed"))
    return "Email non confirmé — vérifie ta boîte mail";
  if (r.includes("too many") || r.includes("rate limit"))
    return "Trop de tentatives — réessaie dans quelques minutes";
  if (r.includes("network") || r === "server_error")
    return "Pas de connexion — vérifie ton internet";
  return raw;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isBioLoading, setIsBioLoading]     = useState(false);

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [bioAvailable,   setBioAvailable]   = useState(false);
  const [bioType, setBioType] = useState<"face" | "fingerprint">("face");

  const [showRoleModal, setShowRoleModal]   = useState(false);
  const [loggedName, setLoggedName]         = useState("");
  const [loggedRole, setLoggedRole]         = useState<"pro" | "client">("client");

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 35, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Check capabilities ───────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      // Apple Sign In — iOS only
      if (Platform.OS === "ios") {
        const available = await AppleAuthentication.isAvailableAsync().catch(() => false);
        setAppleAvailable(available);
      }

      // Biometrics — only if user has a stored token
      const token = await storage.getAccessToken();
      if (!token) return;

      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      if (hasHardware && isEnrolled) {
        setBioAvailable(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [] as number[]);
        const FACE_ID = LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION as number;
        setBioType(types.includes(FACE_ID) ? "face" : "fingerprint");
      }
    };
    void check();
  }, []);

  // ── Real-time email validation ────────────────────────────────────────────
  const handleEmailChange = useCallback((v: string) => {
    setEmail(v);
    setSubmitError(null);
    if (v.length > 0) {
      const err = getZodError(emailSchema, v);
      setEmailError(err ?? undefined);
    } else {
      setEmailError(undefined);
    }
  }, []);

  // ── Navigate after login ──────────────────────────────────────────────────
  const navigateAfterLogin = useCallback(
    (user: { role: string; is_admin: boolean; first_name?: string }) => {
      if (user.is_admin) {
        setLoggedName(user.first_name ?? "");
        setLoggedRole(user.role === "pro" ? "pro" : "client");
        setShowRoleModal(true);
        return;
      }
      if (user.role === "pro") {
        router.replace("/(pro)/dashboard");
      } else {
        router.replace("/(client)");
      }
    },
    [router]
  );

  // ── Email/password login ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password) return;
    const emailErr = getZodError(emailSchema, email.trim());
    if (emailErr) {
      setEmailError(emailErr);
      shake();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await login({ email: email.trim().toLowerCase(), password });
      if (!res.success) {
        setSubmitError(parseLoginError(res.error ?? "Erreur de connexion"));
        shake();
      } else if (res.data?.user) {
        navigateAfterLogin(res.data.user);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, login, navigateAfterLogin, shake]);

  // ── Apple Sign In ─────────────────────────────────────────────────────────
  const handleAppleLogin = useCallback(async () => {
    setIsAppleLoading(true);
    setSubmitError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken || !credential.authorizationCode) {
        setSubmitError("Apple Sign In a échoué — réessaie");
        return;
      }

      const res = await authApi.loginWithApple({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email,
        fullName: credential.fullName,
      });

      if (!res.success) {
        setSubmitError(res.error ?? "Erreur Apple Sign In");
        shake();
      } else if (res.data?.user) {
        navigateAfterLogin(res.data.user);
      }
    } catch (e: unknown) {
      if (e instanceof Error && "code" in e && (e as { code: string }).code === "ERR_REQUEST_CANCELED") {
        // user cancelled — silently ignore
        return;
      }
      setSubmitError("Apple Sign In a échoué — réessaie");
    } finally {
      setIsAppleLoading(false);
    }
  }, [navigateAfterLogin, shake]);

  // ── Biometric login ───────────────────────────────────────────────────────
  const handleBiometric = useCallback(async () => {
    setIsBioLoading(true);
    setSubmitError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Identifie-toi pour accéder à Blyss",
        cancelLabel: "Annuler",
        fallbackLabel: "Mot de passe",
        disableDeviceFallback: false,
      });

      if (!result.success) {
        // user cancelled or failed — no anxious message
        return;
      }

      // Token already stored — call getProfile to restore session
      const profile = await authApi.getProfile();
      if (profile.success && profile.data) {
        navigateAfterLogin(profile.data);
      } else {
        setSubmitError("Session expirée — connecte-toi avec ton mot de passe");
      }
    } catch {
      // biometrics unavailable — silent fallback, no message
    } finally {
      setIsBioLoading(false);
    }
  }, [navigateAfterLogin]);

  // ── Role modal (admin) ────────────────────────────────────────────────────
  const handleRoleSelection = useCallback((selectedRole: AdminRole) => {
    setShowRoleModal(false);
    const routes: Record<AdminRole, string> = {
      client: "/(client)",
      pro: "/(pro)/dashboard",
      admin: "/(admin)/dashboard",
    };
    router.replace(routes[selectedRole] as Parameters<typeof router.replace>[0]);
  }, [router]);

  const isSubmitDisabled = isSubmitting || !email.trim() || !password || !!emailError;

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
          {/* Back */}
          <AnimatedIconButton onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.foreground} />
          </AnimatedIconButton>

          {/* Logo */}
          <View style={styles.logoBlock}>
            <Image
              source={require("@/assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Bon retour 👋</Text>
            <Text style={styles.subtitle}>Connecte-toi pour continuer sur Blyss</Text>
          </View>

          {/* Error banner */}
          {submitError && (
            <Animated.View style={{ transform: [{ translateX: shakeAnim }], marginBottom: 16 }}>
              <ErrorMessage message={submitError} />
            </Animated.View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={handleEmailChange}
              placeholder="ton@email.com"
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              leftIcon="mail-outline"
              error={emailError}
            />

            <View>
              <View style={styles.passwordHeader}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8}>
                  <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
                </Pressable>
              </View>
              <Input
                value={password}
                onChangeText={(v) => { setPassword(v); setSubmitError(null); }}
                placeholder="••••••••"
                autoComplete="current-password"
                leftIcon="lock-closed-outline"
                secure
              />
            </View>
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            style={[styles.ctaBtn, isSubmitDisabled && styles.ctaBtnDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.ctaBtnText}>Se connecter</Text>
            )}
          </Pressable>

          {/* Biometric */}
          {bioAvailable && (
            <Pressable
              onPress={handleBiometric}
              disabled={isBioLoading}
              style={styles.bioBtn}
            >
              {isBioLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name={bioType === "face" ? "scan-outline" : "finger-print-outline"}
                    size={20}
                    color={Colors.primary}
                  />
                  <Text style={styles.bioBtnText}>
                    {bioType === "face" ? "Se connecter avec Face ID" : "Se connecter avec Touch ID"}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Separator */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Apple Sign In */}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={16}
              style={styles.appleBtn}
              onPress={handleAppleLogin}
            />
          )}

          {isAppleLoading && (
            <View style={styles.appleLoading}>
              <ActivityIndicator size="small" color={Colors.mutedForeground} />
            </View>
          )}

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Pas encore de compte ? </Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.registerLink}>S'inscrire</Text>
            </Pressable>
          </View>

          {/* Legal */}
          <Text style={styles.legal}>
            {"En continuant, tu acceptes nos "}
            <Text style={styles.legalLink} onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}>
              CGU
            </Text>
            {" et la "}
            <Text style={styles.legalLink} onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}>
              Politique de confidentialité
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },

  backBtn: { paddingTop: 8, paddingBottom: 0, marginLeft: -8 },

  logoBlock: { alignItems: "center", marginTop: 16, marginBottom: 8 },
  logo: { width: 90, height: 90 },

  titleBlock: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.mutedForeground, marginTop: 6, lineHeight: 20 },

  form: { gap: 12, marginBottom: 24 },

  passwordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.foreground },
  forgotLink: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  ctaBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 12,
  },
  ctaBtnDisabled: { backgroundColor: Colors.disabled, shadowOpacity: 0, elevation: 0 },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: Colors.white },

  bioBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginBottom: 4,
  },
  bioBtnText: { fontSize: 14, fontWeight: "600", color: Colors.primary },

  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorText: { fontSize: 12, color: Colors.mutedForeground, fontWeight: "500" },

  appleBtn: { height: 52, borderRadius: 16, marginBottom: 8 },
  appleLoading: { alignItems: "center", paddingVertical: 8 },

  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  registerText: { fontSize: 13, color: Colors.mutedForeground },
  registerLink: { fontSize: 13, fontWeight: "700", color: Colors.primary },

  legal: {
    fontSize: 11,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  legalLink: { color: Colors.primary, fontWeight: "600" },
});
