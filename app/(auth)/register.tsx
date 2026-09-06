import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
} from "react-native";
import Reanimated, { FadeIn } from "react-native-reanimated";
import RNDateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTransition } from "@/contexts/TransitionContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { FloatingNotice } from "@/components/ui/FloatingNotice";
import {
  CREAM,
  INK,
  PillButton,
  Ribbon,
  StepHeader,
  fieldColors,
  useRibbon,
  type FieldTone,
} from "@/components/onboarding/kit";

// ── Constantes (miroir du web) ────────────────────────────────────────────
const VALIDATION = {
  PHONE_REGEX: /^[0-9]{10}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,128}$/,
  NAME_MAX: 50,
  TEXT_MAX: 100,
  EMAIL_MAX: 254,
  MIN_AGE: 16,
} as const;

const ERROR_CODES: Record<string, string> = {
  email_exists: "Cet email est déjà utilisé",
  weak_password: "Mot de passe trop faible : 8 caractères, une majuscule, un chiffre, un caractère spécial",
  age_restriction: "Tu dois avoir au moins 16 ans",
  invalid_phone: "Numéro de téléphone invalide",
  invalid_email: "Email invalide",
  missing_fields: "Il manque des informations",
  data_too_long: "Un champ est trop long",
};

type Role = "client" | "pro";

interface FormData {
  role: Role;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: Date | undefined;
  activityName: string;
  city: string;
  instagramAccount: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

function formatPhone(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 10)
    .replace(/(\d{2})(?=\d)/g, "$1 ");
}

function getAge(birthDate: Date | undefined): number {
  if (!birthDate) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Champ texte « poster » : filet inférieur sur fond de couleur ───────────
function PosterField({
  label,
  ink,
  accent,
  right,
  ...input
}: {
  label: string;
  ink: string;
  accent: string;
  right?: React.ReactNode;
} & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 4 }}>
      <Text
        style={{
          color: ink,
          opacity: 0.72,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderBottomWidth: 1.5,
          borderBottomColor: focused ? accent : withAlpha(ink, 0.25),
        }}
      >
        <TextInput
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          placeholderTextColor={withAlpha(ink, 0.4)}
          style={{ flex: 1, paddingVertical: 10, fontSize: 16, color: ink }}
        />
        {right}
      </View>
    </View>
  );
}

// ── Écran de succès ───────────────────────────────────────────────────────
function RegisterSuccess({ onPress }: { onPress: () => void }) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
        <Text style={{ color: INK, fontWeight: "900", fontSize: 42, lineHeight: 42, letterSpacing: -1.2, textTransform: "uppercase" }}>
          Ton compte{"\n"}est prêt
        </Text>
        <Text style={{ color: INK, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 18, maxWidth: 320 }}>
          On te présente maintenant les prothésistes ongulaires près de chez toi.
        </Text>
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8 }}>
        <PillButton label="Continuer →" onPress={onPress} bg={INK} fg={CREAM} />
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { signup, isLoading } = useAuth();
  const { showTransition, hideTransition } = useAppTransition();
  const { width } = useWindowDimensions();
  const ribbon = useRibbon();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const initialRole: Role = roleParam === "pro" ? "pro" : "client";

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    role: initialRole,
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    birthDate: undefined,
    activityName: "",
    city: "",
    instagramAccount: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const totalSteps = formData.role === "pro" ? 9 : 6;

  const update = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setNotice(null);
  }, []);

  const tone: FieldTone = useMemo(() => {
    if (step === 99) return "rose";
    if (step === 1) return "rose";
    if (step === 5) return "prune";
    const lastStep = formData.role === "pro" ? 9 : 6;
    if (step === lastStep) return "rose";
    return "cream";
  }, [step, formData.role]);
  const field = fieldColors(tone, colors);
  const ink = field.ink;

  const isLastStep = step === (formData.role === "pro" ? 9 : 6);
  const isProOptionalStep = formData.role === "pro" && [6, 7, 8].includes(step);
  const optionalValue =
    step === 6 ? formData.activityName : step === 7 ? formData.city : step === 8 ? formData.instagramAccount : "";

  const isStepValid = (): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return formData.firstName.trim().length > 0 && formData.lastName.trim().length > 0;
      case 3:
        return VALIDATION.PHONE_REGEX.test(formData.phone.replace(/\s/g, ""));
      case 4:
        return VALIDATION.EMAIL_REGEX.test(formData.email.trim()) && formData.email.length <= VALIDATION.EMAIL_MAX;
      case 5:
        return !!formData.birthDate && getAge(formData.birthDate) >= VALIDATION.MIN_AGE;
      case 6:
        return formData.role === "client" ? formData.acceptedTerms : true;
      case 7:
      case 8:
        return true;
      case 9:
        return formData.acceptedTerms;
      default:
        return false;
    }
  };

  const ctaLabel = isLoading
    ? "…"
    : isLastStep
      ? "Créer mon compte →"
      : isProOptionalStep && !optionalValue.trim()
        ? "Plus tard →"
        : "Continuer →";

  const handleBack = useCallback(() => {
    if (step === 1) router.back();
    else {
      setNotice(null);
      setStep((s) => s - 1);
    }
  }, [step, router]);

  const submit = useCallback(async () => {
    if (formData.password !== formData.confirmPassword) {
      setNotice("Les mots de passe ne correspondent pas");
      return;
    }
    if (!VALIDATION.PASSWORD_REGEX.test(formData.password)) {
      setNotice("8 caractères min., une majuscule, un chiffre, un caractère spécial");
      return;
    }
    if (!formData.acceptedTerms) {
      setNotice("Accepte les conditions pour continuer");
      return;
    }
    const res = await signup({
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      phone_number: formData.phone.replace(/\s/g, ""),
      birth_date: formData.birthDate ? formData.birthDate.toISOString().split("T")[0] : "",
      role: formData.role,
      accepted_terms: true,
      activity_name: formData.activityName.trim() || null,
      city: formData.city.trim() || null,
      instagram_account: formData.instagramAccount.trim() || null,
    });
    if (!res.success) {
      setNotice(res.error ? (ERROR_CODES[res.error] ?? res.message ?? "Création impossible, réessaie") : "Création impossible, réessaie");
      return;
    }
    setStep(99);
  }, [formData, signup]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setNotice(null);
    if (step === 4 && !VALIDATION.EMAIL_REGEX.test(formData.email.trim())) {
      setNotice("Email invalide");
      return;
    }
    if (step === 5 && getAge(formData.birthDate) < VALIDATION.MIN_AGE) {
      setNotice("Tu dois avoir au moins 16 ans");
      return;
    }
    if (isLastStep) {
      submit();
      return;
    }
    ribbon.go(() => setStep((s) => s + 1));
  }, [step, formData, isLastStep, submit, ribbon]);

  const leaveToNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    showTransition();
    if (formData.role === "pro") router.replace("/(pro)/dashboard" as never);
    else router.replace("/client-onboarding?from=signup" as never);
    hideTransition();
  }, [formData.role, router, showTransition, hideTransition]);

  // ── Contenu par étape ───────────────────────────────────────────────────
  const renderStep = () => {
    if (step === 1) {
      return (
        <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
          <Text style={{ color: ink, fontWeight: "900", fontSize: 34, lineHeight: 34, letterSpacing: -1, textTransform: "uppercase" }}>
            Bienvenue sur Blyss
          </Text>
          <Text style={{ color: ink, opacity: 0.85, fontSize: 13, marginTop: 10 }}>Comment tu utilises Blyss ?</Text>
          <View style={{ gap: 10, marginTop: 22 }}>
            {(["client", "pro"] as Role[]).map((r) => {
              const on = formData.role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    update({ role: r });
                  }}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1.5,
                    padding: 16,
                    borderColor: on ? INK : withAlpha(ink, 0.2),
                    backgroundColor: on ? INK : withAlpha(ink, 0.04),
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: on ? CREAM : ink, fontSize: 15, fontWeight: "800", textTransform: "uppercase" }}>
                      {r === "client" ? "Cliente" : "Prothésiste"}
                    </Text>
                    {on && <Ionicons name="checkmark-circle" size={18} color={CREAM} />}
                  </View>
                  <Text style={{ color: on ? withAlpha(CREAM, 0.75) : withAlpha(ink, 0.6), fontSize: 12, marginTop: 5 }}>
                    {r === "client" ? "Je réserve mes soins des ongles" : "Agenda, réservations, paiements — tout en un"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 99) return <RegisterSuccess onPress={() => ribbon.go(leaveToNext)} />;

    // Étapes formulaire — même gabarit
    let body: React.ReactNode = null;
    let title = "";
    let subtitle = "";

    if (step === 2) {
      title = "Enchanté";
      subtitle = "Et toi, c'est ?";
      body = (
        <>
          <PosterField
            label="Prénom"
            ink={ink}
            accent={colors.primary}
            value={formData.firstName}
            onChangeText={(v) => update({ firstName: v })}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={VALIDATION.NAME_MAX}
          />
          <PosterField
            label="Nom"
            ink={ink}
            accent={colors.primary}
            value={formData.lastName}
            onChangeText={(v) => update({ lastName: v })}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            maxLength={VALIDATION.NAME_MAX}
          />
        </>
      );
    } else if (step === 3) {
      title = formData.firstName ? `Enchanté ${formData.firstName}` : "Enchanté";
      subtitle = "Un numéro pour tes confirmations de RDV";
      body = (
        <PosterField
          label="Téléphone"
          ink={ink}
          accent={colors.primary}
          value={formData.phone}
          onChangeText={(v) => update({ phone: formatPhone(v) })}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="06 12 34 56 78"
        />
      );
    } else if (step === 4) {
      title = "Ton email";
      subtitle = "Pour te connecter et recevoir tes reçus";
      body = (
        <PosterField
          label="Email"
          ink={ink}
          accent={colors.primary}
          value={formData.email}
          onChangeText={(v) => update({ email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          placeholder="ton@email.com"
          maxLength={VALIDATION.EMAIL_MAX}
        />
      );
    } else if (step === 5) {
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - VALIDATION.MIN_AGE);
      title = "Ta date de naissance";
      subtitle = "On vérifie juste que tu as 16 ans ou plus";
      body = (
        <View style={{ marginBottom: 4 }}>
          <Text style={{ color: ink, opacity: 0.72, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            Date de naissance
          </Text>
          <Pressable
            onPress={() => setDatePickerOpen((o) => !o)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1.5,
              borderBottomColor: datePickerOpen ? colors.primary : withAlpha(ink, 0.25),
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontSize: 16, color: formData.birthDate ? ink : withAlpha(ink, 0.4) }}>
              {formData.birthDate ? formatDate(formData.birthDate) : "Choisir une date"}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={withAlpha(ink, 0.6)} />
          </Pressable>
          {datePickerOpen && (
            <View style={{ marginTop: 14, backgroundColor: CREAM, borderRadius: 16, padding: 8 }}>
              <RNDateTimePicker
                mode="date"
                display="spinner"
                value={formData.birthDate ?? maxDate}
                maximumDate={maxDate}
                locale="fr-FR"
                themeVariant="light"
                style={{ height: 180 }}
                onChange={(_e: DateTimePickerEvent, d?: Date) => {
                  if (d) update({ birthDate: d });
                  if (Platform.OS === "android") setDatePickerOpen(false);
                }}
              />
              {Platform.OS === "ios" && (
                <Pressable
                  onPress={() => setDatePickerOpen(false)}
                  style={{ alignSelf: "center", paddingVertical: 8, paddingHorizontal: 20 }}
                >
                  <Text style={{ color: INK, fontWeight: "700", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Valider
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      );
    } else if (formData.role === "pro" && step === 6) {
      title = "Ton activité";
      subtitle = "Modifiable plus tard";
      body = (
        <PosterField
          label="Nom de l'activité"
          ink={ink}
          accent={colors.primary}
          value={formData.activityName}
          onChangeText={(v) => update({ activityName: v })}
          placeholder="Ex. : Studio Blyss"
          maxLength={VALIDATION.TEXT_MAX}
        />
      );
    } else if (formData.role === "pro" && step === 7) {
      title = "Où exerces-tu ?";
      subtitle = "Ville ou quartier";
      body = (
        <PosterField
          label="Ville"
          ink={ink}
          accent={colors.primary}
          value={formData.city}
          onChangeText={(v) => update({ city: v })}
          placeholder="Ex. : Paris 11"
          maxLength={VALIDATION.TEXT_MAX}
        />
      );
    } else if (formData.role === "pro" && step === 8) {
      title = "Ton Instagram";
      subtitle = "Tes clientes verront ton travail avant de réserver";
      body = (
        <PosterField
          label="Compte Instagram"
          ink={ink}
          accent={colors.primary}
          value={formData.instagramAccount}
          onChangeText={(v) => update({ instagramAccount: v })}
          autoCapitalize="none"
          placeholder="@ton_instagram"
          maxLength={VALIDATION.TEXT_MAX}
        />
      );
    } else {
      // Dernière étape (client 6 / pro 9) : mot de passe + conditions
      title = "Dernière étape";
      subtitle = "Choisis ton mot de passe";
      body = (
        <>
          <PosterField
            label="Mot de passe"
            ink={ink}
            accent={colors.primary}
            value={formData.password}
            onChangeText={(v) => update({ password: v })}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="8 caractères minimum"
            right={
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={withAlpha(ink, 0.6)} />
              </Pressable>
            }
          />
          <PosterField
            label="Confirmer"
            ink={ink}
            accent={colors.primary}
            value={formData.confirmPassword}
            onChangeText={(v) => update({ confirmPassword: v })}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Répète ton mot de passe"
          />
          <Text style={{ color: ink, opacity: 0.55, fontSize: 11, marginTop: 4 }}>
            Une majuscule, un chiffre et un caractère spécial (!@#$%^&*)
          </Text>
          <Pressable
            onPress={() => update({ acceptedTerms: !formData.acceptedTerms })}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 20 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                borderWidth: 1.5,
                marginTop: 1,
                alignItems: "center",
                justifyContent: "center",
                borderColor: formData.acceptedTerms ? INK : withAlpha(ink, 0.35),
                backgroundColor: formData.acceptedTerms ? INK : "transparent",
              }}
            >
              {formData.acceptedTerms && <Ionicons name="checkmark" size={13} color={CREAM} />}
            </View>
            <Text style={{ flex: 1, color: ink, fontSize: 12, lineHeight: 17 }}>
              J'accepte les{" "}
              <Text style={{ textDecorationLine: "underline", fontWeight: "700" }} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}>
                conditions générales
              </Text>{" "}
              et la{" "}
              <Text style={{ textDecorationLine: "underline", fontWeight: "700" }} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}>
                politique de confidentialité
              </Text>
            </Text>
          </Pressable>
        </>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: ink, fontWeight: "900", fontSize: 26, lineHeight: 27, letterSpacing: -0.5, textTransform: "uppercase" }}>
          {title}
        </Text>
        {subtitle ? <Text style={{ color: ink, opacity: 0.65, fontSize: 13, marginTop: 8, marginBottom: 20 }}>{subtitle}</Text> : null}
        {body}
      </ScrollView>
    );
  };

  const headerRight =
    step !== 99 ? (
      <Text style={{ color: ink, opacity: 0.55, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 8 }}>
        {String(step).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
      </Text>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: field.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {step !== 99 && <StepHeader step={step} total={totalSteps} ink={ink} right={headerRight} onBack={handleBack} />}

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={12}>
          <Reanimated.View key={step} entering={ribbon.reduceMotion ? undefined : FadeIn.duration(180)} style={{ flex: 1 }}>
            {renderStep()}
          </Reanimated.View>

          {step !== 99 && (
            <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8 }}>
              <PillButton
                label={ctaLabel}
                onPress={handleNext}
                bg={isStepValid() ? field.pill.bg : withAlpha(ink, 0.25)}
                fg={field.pill.fg}
                loading={isLoading}
                disabled={!isStepValid()}
              />
              <Pressable onPress={() => router.push("/(auth)/login")} style={{ alignItems: "center", paddingVertical: 10 }}>
                <Text style={{ color: ink, opacity: 0.6, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Déjà un compte ? Se connecter
                </Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Ribbon x={ribbon.x} width={width} rose={colors.primary} />
      <FloatingNotice message={notice} onHide={() => setNotice(null)} />
    </View>
  );
}
