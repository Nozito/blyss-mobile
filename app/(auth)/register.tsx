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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

// ── Constants (mirrored from web) ──────────────────────────────────────────
const VALIDATION = {
  PHONE_REGEX: /^[0-9]{10}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  NAME_MAX: 50,
  TEXT_MAX: 100,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  MIN_AGE: 16,
} as const;

const ERROR_CODES: Record<string, string> = {
  email_exists: "Cet email est déjà utilisé",
  weak_password: "Mot de passe trop faible (minuscule, majuscule, chiffre)",
  age_restriction: "Tu dois avoir au moins 16 ans",
  invalid_phone: "Numéro de téléphone invalide",
  invalid_email: "Email invalide",
  missing_fields: "Champs obligatoires manquants",
  data_too_long: "Un ou plusieurs champs sont trop longs",
};

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
}

function getAge(birthDate: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age;
}

// ── Password step (shared between client step 6 and pro step 9) ────────────
function PasswordStep({
  formData,
  update,
}: {
  formData: FormData;
  update: (u: Partial<FormData>) => void;
}) {
  return (
    <View className="gap-6">
      <View>
        <Text className="text-3xl font-black text-foreground">Dernière étape</Text>
        <Text className="text-muted-foreground mt-2">Choisis ton mot de passe</Text>
      </View>

      <View className="gap-4">
        <Input
          label="Mot de passe"
          value={formData.password}
          onChangeText={(v) => update({ password: v })}
          secure
          autoComplete="new-password"
          placeholder="Min. 8 caractères"
          leftIcon="lock-closed-outline"
          hint="1 minuscule, 1 majuscule, 1 chiffre minimum"
        />
        <Input
          label="Confirmer le mot de passe"
          value={formData.confirmPassword}
          onChangeText={(v) => update({ confirmPassword: v })}
          secure
          autoComplete="new-password"
          placeholder="Répète ton mot de passe"
          leftIcon="lock-closed-outline"
        />

        {/* CGU checkbox */}
        <Pressable
          onPress={() => update({ acceptedTerms: !formData.acceptedTerms })}
          className="flex-row items-start gap-3"
        >
          <View
            className={[
              "w-5 h-5 rounded border-2 items-center justify-center mt-0.5 flex-shrink-0",
              formData.acceptedTerms ? "bg-primary border-primary" : "border-border bg-card",
            ].join(" ")}
          >
            {formData.acceptedTerms && (
              <Ionicons name="checkmark" size={12} color="#fff" />
            )}
          </View>
          <Text className="text-sm text-muted-foreground flex-1 leading-5">
            J'accepte les{" "}
            <Text className="text-primary font-medium">Conditions générales</Text>
            {" "}et la{" "}
            <Text className="text-primary font-medium">Politique de confidentialité</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();
  const { signup, isLoading } = useAuth();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    role: "client",
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
  const [stepError, setStepError] = useState("");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!stepError) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 35, useNativeDriver: true }),
    ]).start();
  }, [stepError, shakeAnim]);

  const totalSteps = useMemo(
    () => (formData.role === "pro" ? 9 : 6),
    [formData.role],
  );

  const update = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setStepError("");
  }, []);

  // ── Step validation ──────────────────────────────────────────────────────
  const isStepValid = (): boolean => {
    switch (step) {
      case 1: return true;
      case 2:
        return (
          formData.firstName.trim().length > 0 &&
          formData.lastName.trim().length > 0
        );
      case 3:
        return VALIDATION.PHONE_REGEX.test(formData.phone.replace(/\s/g, ""));
      case 4:
        return (
          VALIDATION.EMAIL_REGEX.test(formData.email.trim()) &&
          formData.email.length <= VALIDATION.EMAIL_MAX
        );
      case 5:
        return !!formData.birthDate && getAge(formData.birthDate.toISOString().split("T")[0]) >= VALIDATION.MIN_AGE;
      case 6:
        return formData.role === "client" ? formData.acceptedTerms : true;
      case 7: case 8: return true;
      case 9: return formData.acceptedTerms;
      default: return false;
    }
  };

  const isLastStep =
    (formData.role === "client" && step === 6) ||
    (formData.role === "pro" && step === 9);

  const isProOptionalStep =
    formData.role === "pro" && [6, 7, 8].includes(step);

  const currentOptionalValue =
    step === 6 ? formData.activityName
    : step === 7 ? formData.city
    : step === 8 ? formData.instagramAccount
    : "";

  const ctaLabel = isLoading
    ? "Chargement..."
    : isLastStep
    ? "Créer mon compte"
    : isProOptionalStep && !currentOptionalValue.trim()
    ? "Remplir plus tard"
    : "Continuer";

  // ── Navigation ───────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (step === 1) router.back();
    else { setStep((s) => s - 1); setStepError(""); }
  }, [step, router]);

  const handleNext = useCallback(async () => {
    setStepError("");

    if (step === 4 && !VALIDATION.EMAIL_REGEX.test(formData.email.trim())) {
      setStepError("Email invalide");
      return;
    }
    if (step === 5 && (!formData.birthDate || getAge(formData.birthDate.toISOString().split("T")[0]) < VALIDATION.MIN_AGE)) {
      setStepError("Tu dois avoir au moins 16 ans");
      return;
    }

    if (isLastStep) {
      if (formData.password !== formData.confirmPassword) {
        setStepError("Les mots de passe ne correspondent pas");
        return;
      }
      if (!VALIDATION.PASSWORD_REGEX.test(formData.password)) {
        setStepError("Le mot de passe doit contenir une minuscule, une majuscule et un chiffre");
        return;
      }
      if (!formData.acceptedTerms) {
        setStepError("Tu dois accepter les CGU pour continuer");
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
        const msg = res.error
          ? (ERROR_CODES[res.error] ?? res.message ?? "Erreur lors de la création")
          : "Erreur lors de la création";
        setStepError(msg);
      }
      return;
    }

    setStep((s) => s + 1);
  }, [step, formData, isLastStep, signup]);

  // ── Step content ─────────────────────────────────────────────────────────
  const renderContent = () => {
    if (step === 1) {
      return (
        <View className="gap-8">
          <View className="items-center">
            <Text className="text-3xl font-black text-foreground text-center">
              Bienvenue sur Blyss
            </Text>
            <Text className="text-muted-foreground text-center mt-2">
              Choisis comment tu utilises Blyss
            </Text>
          </View>

          <View className="gap-4">
            {(["client", "pro"] as Role[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => update({ role: r })}
                disabled={isLoading}
                className={[
                  "flex-row items-center gap-4 rounded-2xl px-5 py-5 border-2",
                  formData.role === r
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {r === "client" ? "Cliente" : "Prothésiste"}
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-0.5">
                    {r === "client"
                      ? "Je réserve des prestations manucure"
                      : "Je propose mes prestations sur Blyss"}
                  </Text>
                </View>
                <View
                  className={[
                    "w-6 h-6 rounded-full border-2 items-center justify-center flex-shrink-0",
                    formData.role === r
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {formData.role === r && (
                    <View className="w-2.5 h-2.5 rounded-full bg-white" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View className="gap-6">
          <View>
            <Text className="text-3xl font-black text-foreground">Enchanté</Text>
            <Text className="text-muted-foreground mt-2">Et toi, c'est ?</Text>
          </View>
          <View className="gap-4">
            <Input
              label="Prénom"
              value={formData.firstName}
              onChangeText={(v) => update({ firstName: v })}
              autoCapitalize="words"
              autoComplete="given-name"
              maxLength={VALIDATION.NAME_MAX}
            />
            <Input
              label="Nom"
              value={formData.lastName}
              onChangeText={(v) => update({ lastName: v })}
              autoCapitalize="words"
              autoComplete="family-name"
              maxLength={VALIDATION.NAME_MAX}
            />
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View className="gap-6">
          <View>
            <Text className="text-3xl font-black text-foreground">
              Enchanté {formData.firstName}
            </Text>
            <Text className="text-muted-foreground mt-2">Un 06 ?</Text>
          </View>
          <Input
            label="Téléphone"
            value={formData.phone}
            onChangeText={(v) => update({ phone: formatPhone(v) })}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
            leftIcon="call-outline"
          />
        </View>
      );
    }

    if (step === 4) {
      return (
        <View className="gap-6">
          <View>
            <Text className="text-3xl font-black text-foreground">Super !</Text>
            <Text className="text-muted-foreground mt-2">Ton email ?</Text>
          </View>
          <Input
            label="Email"
            value={formData.email}
            onChangeText={(v) => update({ email: v })}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="ton@email.com"
            leftIcon="mail-outline"
            maxLength={VALIDATION.EMAIL_MAX}
          />
        </View>
      );
    }

    if (step === 5) {
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - VALIDATION.MIN_AGE);
      return (
        <View className="gap-6">
          <View>
            <Text className="text-3xl font-black text-foreground">
              Ta date de naissance
            </Text>
            <Text className="text-muted-foreground mt-2">
              Tu dois avoir au moins 16 ans
            </Text>
          </View>
          <DatePicker
            label="Date de naissance"
            value={formData.birthDate}
            onChange={(date) => update({ birthDate: date })}
            maximumDate={maxDate}
            placeholder="Sélectionner ta date de naissance"
          />
        </View>
      );
    }

    if (formData.role === "client" && step === 6) {
      return <PasswordStep formData={formData} update={update} />;
    }

    if (formData.role === "pro") {
      if (step === 6) {
        return (
          <View className="gap-6">
            <View>
              <Text className="text-3xl font-black text-foreground">Ton activité</Text>
              <Text className="text-muted-foreground mt-2">
                Nom de ton activité (modifiable plus tard)
              </Text>
            </View>
            <Input
              label="Nom de l'activité"
              value={formData.activityName}
              onChangeText={(v) => update({ activityName: v })}
              placeholder="Ex. : Studio Blyss"
              leftIcon="storefront-outline"
              maxLength={VALIDATION.TEXT_MAX}
            />
          </View>
        );
      }
      if (step === 7) {
        return (
          <View className="gap-6">
            <View>
              <Text className="text-3xl font-black text-foreground">Où exerces-tu ?</Text>
              <Text className="text-muted-foreground mt-2">Ville ou quartier</Text>
            </View>
            <Input
              label="Ville"
              value={formData.city}
              onChangeText={(v) => update({ city: v })}
              placeholder="Ex. : Paris 11"
              leftIcon="location-outline"
              maxLength={VALIDATION.TEXT_MAX}
            />
          </View>
        );
      }
      if (step === 8) {
        return (
          <View className="gap-6">
            <View>
              <Text className="text-3xl font-black text-foreground">Ton Instagram</Text>
              <Text className="text-muted-foreground mt-2">
                Aide les clientes à te découvrir
              </Text>
            </View>
            <Input
              label="Compte Instagram"
              value={formData.instagramAccount}
              onChangeText={(v) => update({ instagramAccount: v })}
              placeholder="@ton_instagram"
              leftIcon="logo-instagram"
              maxLength={VALIDATION.TEXT_MAX}
            />
          </View>
        );
      }
      if (step === 9) {
        return <PasswordStep formData={formData} update={update} />;
      }
    }

    return null;
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Progress header */}
      <View className="flex-row items-center gap-4 px-6 py-4">
        <AnimatedIconButton
          onPress={handleBack}
          disabled={isLoading}
          className="p-2 -ml-2 rounded-xl active:bg-muted"
        >
          <Ionicons name="chevron-back" size={24} color="#09090B" />
        </AnimatedIconButton>
        <View className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </View>
        <Text className="text-sm font-medium text-muted-foreground w-10 text-right">
          {step}/{totalSteps}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}

          {stepError ? (
            <Animated.View
              style={{
                transform: [{ translateX: shakeAnim }],
                marginTop: 16,
                backgroundColor: "#FFF0F3",
                borderRadius: 14,
                borderLeftWidth: 3,
                borderLeftColor: "#EF4444",
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={{ flex: 1, fontSize: 13, color: "#EF4444", fontWeight: "500", lineHeight: 18 }}>
                {stepError}
              </Text>
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* Fixed bottom CTA */}
        <View
          className="px-6 pb-8 pt-4"
          style={{ backgroundColor: "rgba(255,234,241,0.97)" }}
        >
          <Pressable
            onPress={handleNext}
            disabled={!isStepValid() || isLoading}
          >
            <LinearGradient
              colors={
                !isStepValid() || isLoading
                  ? ["#D1D5DB", "#D1D5DB"]
                  : ["#FE5D9D", "rgba(254,93,157,0.9)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 56,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  {ctaLabel}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Login redirect */}
          <Text className="text-xs text-muted-foreground text-center mt-4">
            Déjà un compte ?{" "}
            <Text
              className="text-primary font-semibold"
              onPress={() => router.push("/(auth)/login")}
            >
              Se connecter
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
