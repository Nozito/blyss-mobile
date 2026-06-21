import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Fonts } from "@/constants/fonts";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import RoleSelectionModal, { type AdminRole } from "@/components/ui/RoleSelectionModal";

// ─── Traduction minimale des erreurs Supabase (EN → FR) ──────────────────────

function parseError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credentials"))
    return "Email ou mot de passe incorrect";
  if (r.includes("email not confirmed"))
    return "Email non confirmé";
  if (r.includes("too many") || r.includes("rate limit"))
    return "Trop de tentatives, réessaie plus tard";
  if (r === "server_error" || r.includes("network"))
    return "Pas de connexion internet";
  return raw;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  email: z
    .string()
    .min(1, "Email requis")
    .email("Format d'email invalide")
    .max(254, "Email trop long"),
  password: z
    .string()
    .min(1, "Mot de passe requis")
    .min(6, "Minimum 6 caractères")
    .max(128, "Maximum 128 caractères"),
});
type FormData = z.infer<typeof schema>;

// ─── ScaleOnFocus ─────────────────────────────────────────────────────────────

function ScaleOnFocus({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.02 : 1,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [focused, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!submitError) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 35, useNativeDriver: true }),
    ]).start();
  }, [submitError, shakeAnim]);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [loggedUserName, setLoggedUserName] = useState("");
  const [loggedUserRole, setLoggedUserRole] = useState<"pro" | "client">("client");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    const res = await login({ email: data.email.trim().toLowerCase(), password: data.password });
    if (!res.success) {
      setSubmitError(parseError(res.error ?? "Erreur de connexion"));
      return;
    }
    const user = res.data?.user;

    if (user?.is_admin) {
      setLoggedUserName(user.first_name ?? "");
      setLoggedUserRole(user.role === "pro" ? "pro" : "client");
      setShowRoleModal(true);
      return;
    }

    if (user?.role === "client") {
      router.replace("/(client)");
    } else {
      router.replace("/(pro)/dashboard");
    }
  };

  const handleRoleSelection = (selectedRole: AdminRole) => {
    setShowRoleModal(false);
    const routes: Record<AdminRole, string> = {
      client: "/(client)",
      pro:    "/(pro)/dashboard",
      admin:  "/(admin)/dashboard",
    };
    router.replace(routes[selectedRole] as Parameters<typeof router.replace>[0]);
  };

  const handleCloseModal = () => {
    setShowRoleModal(false);
    router.replace(loggedUserRole === "pro" ? "/(pro)/dashboard" : "/(client)");
  };

  return (
    <SafeAreaView style={styles.root}>
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
          {/* ── Retour ──────────────────────────────────────────────────────── */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FF5EA0" />
          </Pressable>

          {/* ── Titre ───────────────────────────────────────────────────────── */}
          <View style={styles.titleBlock}>
            <Text style={styles.titleLine1}>Bon retour,</Text>
            <Text style={styles.titleLine2}>on t'attendait</Text>
            <Text style={styles.subtitle}>
              Connecte-toi pour continuer sur Blyss
            </Text>
          </View>

          {/* ── Formulaire ──────────────────────────────────────────────────── */}
          <View style={styles.form}>
            {/* Email */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <ScaleOnFocus focused={focusedField === "email"}>
                  <Input
                    label="Email"
                    value={value}
                    onChangeText={(v) => { onChange(v); setSubmitError(null); }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="ton@email.com"
                    keyboardType="email-address"
                    autoComplete="email"
                    leftIcon="mail-outline"
                    error={errors.email?.message}
                  />
                </ScaleOnFocus>
              )}
            />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <ScaleOnFocus focused={focusedField === "password"}>
                  <View>
                    <View style={styles.passwordHeader}>
                      <Text style={styles.fieldLabel}>
                        Mot de passe
                        {errors.password && (
                          <Text style={styles.fieldError}> · {errors.password.message}</Text>
                        )}
                      </Text>
                      <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                        <Text style={styles.forgotLink}>Oublié ?</Text>
                      </Pressable>
                    </View>
                    <Input
                      value={value}
                      onChangeText={(v) => { onChange(v); setSubmitError(null); }}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      leftIcon="lock-closed-outline"
                      secure
                    />
                  </View>
                </ScaleOnFocus>
              )}
            />

            {/* Bannière erreur */}
            {submitError && (
              <Animated.View
                style={[styles.errorBanner, { transform: [{ translateX: shakeAnim }] }]}
              >
                <Text style={styles.errorText}>{submitError}</Text>
              </Animated.View>
            )}
          </View>

          {/* ── CTA ─────────────────────────────────────────────────────────── */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            style={[styles.ctaBtn, isSubmitting && { opacity: 0.6 }]}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.ctaText}>Se connecter</Text>
            }
          </Pressable>

          {/* ── Séparateur ──────────────────────────────────────────────────── */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>Pas encore de compte ?</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* ── Inscription ─────────────────────────────────────────────────── */}
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Créer un compte</Text>
          </Pressable>

          {/* ── Légal ───────────────────────────────────────────────────────── */}
          <Text style={styles.legal}>
            {"En continuant, tu acceptes nos "}
            <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}>CGU</Text>
            {" et la "}
            <Text style={styles.legalLink} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}>Politique de confidentialité</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <RoleSelectionModal
        visible={showRoleModal}
        userName={loggedUserName}
        userInitials={loggedUserName.slice(0, 2).toUpperCase() || "?"}
        onSelectRole={handleRoleSelection}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFEAF1",
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // Retour
  backBtn: {
    paddingTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 0,
  },

  // Titre
  titleBlock: {
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 32,
  },
  titleLine1: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1A0010",
    letterSpacing: -1,
    lineHeight: 42,
  },
  titleLine2: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FF5EA0",
    letterSpacing: -1,
    lineHeight: 44,
    fontFamily: Fonts.serifItalic,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(0,0,0,0.45)",
    fontWeight: "500",
    marginTop: 10,
    lineHeight: 22,
  },

  // Formulaire
  form: {
    paddingHorizontal: 24,
    gap: 12,
  },
  passwordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A0010",
    letterSpacing: 0.1,
  },
  fieldError: {
    fontSize: 12,
    fontWeight: "400",
    color: "#EF4444",
  },
  forgotLink: {
    fontSize: 12,
    color: "#FF5EA0",
    fontWeight: "600",
  },

  // Bannière erreur
  errorBanner: {
    backgroundColor: "rgba(240,58,58,0.07)",
    borderRadius: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#F03A3A",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  errorText: {
    fontSize: 13,
    color: "#F03A3A",
    fontWeight: "500",
    lineHeight: 18,
  },

  // CTA
  ctaBtn: {
    marginTop: 28,
    marginHorizontal: 24,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#FF5EA0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF5EA0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  // Séparateur
  separator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 28,
    paddingHorizontal: 24,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  separatorText: {
    fontSize: 12,
    color: "rgba(0,0,0,0.35)",
    fontWeight: "500",
  },

  // Bouton secondaire
  secondaryBtn: {
    marginHorizontal: 24,
    height: 60,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,94,160,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#FF5EA0",
    fontWeight: "700",
    fontSize: 15,
  },

  // Légal
  legal: {
    fontSize: 11,
    color: "rgba(0,0,0,0.25)",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 32,
  },
  legalLink: {
    color: "#FF5EA0",
  },
});
