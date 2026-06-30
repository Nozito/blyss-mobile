import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import {
  step1Schema,
  step2ClientSchema,
  step2ProSchema,
  emailSchema,
  passwordSchema,
  phoneSchema,
  phoneRequiredSchema,
  getZodError,
} from "@/lib/validation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "client" | "pro";

interface Step1Data {
  firstName: string;
  email: string;
  password: string;
}

interface Step2ClientData {
  phone: string;
  acceptedTerms: boolean;
}

interface Step2ProData {
  activityName: string;
  jobType: string;
  phone: string;
  acceptedTerms: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPES = [
  "Esthéticienne",
  "Coach",
  "Naturopathe",
  "Ostéopathe",
  "Autre",
];

const ERROR_CODES: Record<string, string> = {
  email_exists: "Cet email est déjà utilisé",
  weak_password: "Mot de passe trop faible (minuscule, majuscule, chiffre)",
  invalid_phone: "Numéro de téléphone invalide",
  invalid_email: "Format d'email invalide",
  missing_fields: "Champs obligatoires manquants",
  data_too_long: "Un champ dépasse la longueur maximale",
  server_error: "Erreur serveur — réessaie dans un instant",
};

// ─── Password strength ────────────────────────────────────────────────────────

function getStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: "" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const types = [hasUpper, hasLower, hasDigit].filter(Boolean).length;
  if (pw.length >= 8 && types === 3) return { score: 3, label: "Fort" };
  if (pw.length >= 8 && types >= 2) return { score: 2, label: "Moyen" };
  return { score: 1, label: "Faible" };
}

const STRENGTH_COLORS = ["transparent", Colors.destructive, Colors.warning, Colors.success];
const STRENGTH_TEXT_COLORS = ["transparent", Colors.destructive, Colors.warningText, Colors.successText];

function PasswordStrengthBar({ password }: { password: string }) {
  const { score, label } = getStrength(password);
  if (!password) return null;
  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= score ? STRENGTH_COLORS[score] : Colors.border,
            }}
          />
        ))}
      </View>
      {label ? (
        <Text style={{ fontSize: 11, color: STRENGTH_TEXT_COLORS[score], fontWeight: "600" }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

// ─── CGU Checkbox ─────────────────────────────────────────────────────────────

function TermsCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.termsRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={12} color={Colors.white} />}
      </View>
      <Text style={styles.termsText}>
        {"J'accepte les "}
        <Text
          style={styles.termsLink}
          onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}
        >
          Conditions générales
        </Text>
        {" et la "}
        <Text
          style={styles.termsLink}
          onPress={() => void WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}
        >
          Politique de confidentialité
        </Text>
      </Text>
    </Pressable>
  );
}

// ─── Job type picker ──────────────────────────────────────────────────────────

function JobTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>Type de métier</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {JOB_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => onChange(type)}
            style={[
              styles.jobChip,
              value === type && styles.jobChipActive,
            ]}
          >
            <Text style={[styles.jobChipText, value === type && styles.jobChipTextActive]}>
              {type}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Step 1 — common ─────────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  errors,
}: {
  data: Step1Data;
  onChange: (u: Partial<Step1Data>) => void;
  errors: Partial<Record<keyof Step1Data, string>>;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Crée ton compte</Text>
        <Text style={styles.subtitle}>Quelques informations pour commencer</Text>
      </View>

      <Input
        label="Prénom"
        value={data.firstName}
        onChangeText={(v) => onChange({ firstName: v })}
        autoCapitalize="words"
        autoComplete="given-name"
        leftIcon="person-outline"
        error={errors.firstName}
        maxLength={50}
      />

      <Input
        label="Email"
        value={data.email}
        onChangeText={(v) => onChange({ email: v.trim() })}
        keyboardType="email-address"
        autoComplete="email"
        autoCapitalize="none"
        leftIcon="mail-outline"
        error={errors.email}
        maxLength={254}
      />

      <View>
        <Input
          label="Mot de passe"
          value={data.password}
          onChangeText={(v) => onChange({ password: v })}
          secure
          autoComplete="new-password"
          leftIcon="lock-closed-outline"
          error={errors.password}
          hint="Au moins 8 caractères, 1 majuscule, 1 chiffre"
        />
        <PasswordStrengthBar password={data.password} />
      </View>
    </View>
  );
}

// ─── Step 2 — client ─────────────────────────────────────────────────────────

function Step2Client({
  data,
  onChange,
  errors,
}: {
  data: Step2ClientData;
  onChange: (u: Partial<Step2ClientData>) => void;
  errors: Partial<Record<keyof Step2ClientData, string>>;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Dernière étape</Text>
        <Text style={styles.subtitle}>Plus qu'un instant !</Text>
      </View>

      <Input
        label="Téléphone (optionnel)"
        value={data.phone}
        onChangeText={(v) => onChange({ phone: v })}
        keyboardType="phone-pad"
        autoComplete="tel"
        leftIcon="call-outline"
        placeholder="+33 6 12 34 56 78"
        error={errors.phone}
      />

      <TermsCheckbox
        checked={data.acceptedTerms}
        onToggle={() => onChange({ acceptedTerms: !data.acceptedTerms })}
      />
    </View>
  );
}

// ─── Step 2 — pro ────────────────────────────────────────────────────────────

function Step2Pro({
  data,
  onChange,
  errors,
}: {
  data: Step2ProData;
  onChange: (u: Partial<Step2ProData>) => void;
  errors: Partial<Record<keyof Step2ProData, string>>;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Ton activité</Text>
        <Text style={styles.subtitle}>Pour personnaliser ton profil pro</Text>
      </View>

      <Input
        label="Nom de l'établissement ou nom complet"
        value={data.activityName}
        onChangeText={(v) => onChange({ activityName: v })}
        leftIcon="storefront-outline"
        placeholder="Ex. : Studio Blyss"
        maxLength={100}
        error={errors.activityName}
      />

      <JobTypePicker value={data.jobType} onChange={(v) => onChange({ jobType: v })} />

      <Input
        label="Téléphone"
        value={data.phone}
        onChangeText={(v) => onChange({ phone: v })}
        keyboardType="phone-pad"
        autoComplete="tel"
        leftIcon="call-outline"
        placeholder="+33 6 12 34 56 78"
        error={errors.phone}
      />

      <TermsCheckbox
        checked={data.acceptedTerms}
        onToggle={() => onChange({ acceptedTerms: !data.acceptedTerms })}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router = useRouter();
  const { signup, isLoading } = useAuth();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role: Role = roleParam === "pro" ? "pro" : "client";

  const [step, setStep] = useState<1 | 2>(1);
  const [apiError, setApiError] = useState<string | null>(null);

  const [s1, setS1] = useState<Step1Data>({ firstName: "", email: "", password: "" });
  const [s2c, setS2c] = useState<Step2ClientData>({ phone: "", acceptedTerms: false });
  const [s2p, setS2p] = useState<Step2ProData>({ activityName: "", jobType: "", phone: "", acceptedTerms: false });

  const [s1Errors, setS1Errors] = useState<Partial<Record<keyof Step1Data, string>>>({});
  const [s2cErrors, setS2cErrors] = useState<Partial<Record<keyof Step2ClientData, string>>>({});
  const [s2pErrors, setS2pErrors] = useState<Partial<Record<keyof Step2ProData, string>>>({});

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

  // ── Real-time validation step 1 ───────────────────────────────────────────
  const updateS1 = useCallback((update: Partial<Step1Data>) => {
    setS1((prev) => {
      const next = { ...prev, ...update };
      const errs: typeof s1Errors = {};
      if ("firstName" in update && next.firstName.length > 0 && next.firstName.trim().length < 2)
        errs.firstName = "Minimum 2 caractères";
      if ("email" in update && next.email.length > 0) {
        const err = getZodError(emailSchema, next.email);
        if (err) errs.email = err;
      }
      if ("password" in update && next.password.length > 0) {
        const err = getZodError(passwordSchema, next.password);
        if (err) errs.password = err;
      }
      setS1Errors((prev) => ({ ...prev, ...errs, ...Object.fromEntries(Object.keys(update).filter(k => !(k in errs)).map(k => [k, undefined])) }));
      setApiError(null);
      return next;
    });
  }, []);

  const updateS2c = useCallback((update: Partial<Step2ClientData>) => {
    setS2c((prev) => {
      const next = { ...prev, ...update };
      const errs: typeof s2cErrors = {};
      if ("phone" in update && next.phone.length > 0) {
        const err = getZodError(phoneSchema, next.phone.replace(/\s/g, ""));
        if (err) errs.phone = err;
      }
      setS2cErrors((prev) => ({ ...prev, ...errs }));
      setApiError(null);
      return next;
    });
  }, []);

  const updateS2p = useCallback((update: Partial<Step2ProData>) => {
    setS2p((prev) => {
      const next = { ...prev, ...update };
      const errs: typeof s2pErrors = {};
      if ("phone" in update && next.phone.length > 0) {
        const err = getZodError(phoneRequiredSchema, next.phone.replace(/\s/g, ""));
        if (err) errs.phone = err;
      }
      setS2pErrors((prev) => ({ ...prev, ...errs }));
      setApiError(null);
      return next;
    });
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────
  const validateStep1 = useCallback((): boolean => {
    const result = step1Schema.safeParse(s1);
    if (!result.success) {
      const errs: typeof s1Errors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof Step1Data;
        if (!errs[field]) errs[field] = issue.message;
      }
      setS1Errors(errs);
      shake();
      return false;
    }
    setS1Errors({});
    return true;
  }, [s1, shake]);

  const isStep1Valid = useMemo(() => step1Schema.safeParse(s1).success, [s1]);

  const isStep2Valid = useMemo(() => {
    if (role === "client") return step2ClientSchema.safeParse({ ...s2c, phone: s2c.phone.replace(/\s/g, "") }).success;
    return step2ProSchema.safeParse({ ...s2p, phone: s2p.phone.replace(/\s/g, "") }).success;
  }, [role, s2c, s2p]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (step === 1) {
      if (!validateStep1()) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(2);
      return;
    }

    // Step 2 — submit
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setApiError(null);

    const phone = role === "client" ? s2c.phone.replace(/\s/g, "") : s2p.phone.replace(/\s/g, "");

    const res = await signup({
      first_name: s1.firstName.trim(),
      last_name: "",
      email: s1.email.trim().toLowerCase(),
      password: s1.password,
      phone_number: phone,
      birth_date: "",
      role,
      accepted_terms: true,
      activity_name: role === "pro" ? s2p.activityName.trim() || null : null,
      city: null,
      instagram_account: null,
    });

    if (!res.success) {
      const msg = res.error
        ? (ERROR_CODES[res.error] ?? res.message ?? "Erreur lors de la création")
        : (res.message ?? "Erreur lors de la création");
      setApiError(msg);
      shake();
    }
    // On success, AuthContext redirects via index.tsx
  }, [step, role, s1, s2c, s2p, signup, validateStep1, shake]);

  const handleBack = useCallback(() => {
    if (step === 2) { setStep(1); setApiError(null); }
    else router.back();
  }, [step, router]);

  const progress = step === 1 ? 0.5 : 1;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {/* Progress header */}
      <View style={styles.progressRow}>
        <AnimatedIconButton onPress={handleBack} disabled={isLoading} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.foreground} />
        </AnimatedIconButton>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepCount}>{step}/2</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <Step1 data={s1} onChange={updateS1} errors={s1Errors} />
          )}
          {step === 2 && role === "client" && (
            <Step2Client data={s2c} onChange={updateS2c} errors={s2cErrors} />
          )}
          {step === 2 && role === "pro" && (
            <Step2Pro data={s2p} onChange={updateS2p} errors={s2pErrors} />
          )}

          {apiError && (
            <Animated.View style={{ marginTop: 16, transform: [{ translateX: shakeAnim }] }}>
              <ErrorMessage message={apiError} />
            </Animated.View>
          )}
        </ScrollView>

        {/* Fixed CTA */}
        <View style={styles.ctaZone}>
          <Pressable
            onPress={handleNext}
            disabled={isLoading || (step === 1 ? !isStep1Valid : !isStep2Valid)}
            style={[
              styles.ctaBtn,
              (isLoading || (step === 1 ? !isStep1Valid : !isStep2Valid)) && styles.ctaBtnDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.ctaBtnText}>
                {step === 1 ? "Continuer" : "Créer mon compte"}
              </Text>
            )}
          </Pressable>

          <Text style={styles.loginHint}>
            Déjà un compte ?{" "}
            <Text style={styles.loginLink} onPress={() => router.push("/(auth)/login")}>
              Se connecter
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8, marginLeft: -8, borderRadius: 12 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: Colors.primary },
  stepCount: { fontSize: 13, fontWeight: "600", color: Colors.mutedForeground, width: 28, textAlign: "right" },

  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },

  titleBlock: { marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5, lineHeight: 36 },
  subtitle: { fontSize: 15, color: Colors.mutedForeground, marginTop: 6, lineHeight: 22 },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: Colors.foreground, marginBottom: 6 },

  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { fontSize: 13, color: Colors.mutedForeground, flex: 1, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: "600" },

  jobChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  jobChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  jobChipText: { fontSize: 13, fontWeight: "600", color: Colors.mutedForeground },
  jobChipTextActive: { color: Colors.white },

  ctaZone: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: Colors.background,
    gap: 12,
  },
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
  },
  ctaBtnDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: Colors.white },

  loginHint: { fontSize: 12, color: Colors.mutedForeground, textAlign: "center" },
  loginLink: { color: Colors.primary, fontWeight: "600" },
});
