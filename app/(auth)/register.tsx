import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

const schema = z.object({
  first_name: z.string().min(2, "Prénom requis"),
  last_name: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  phone_number: z.string().min(10, "Numéro invalide"),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  role: z.enum(["client", "pro"]),
  activity_name: z.string().optional(),
  city: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const ERROR_MESSAGES: Record<string, string> = {
  email_exists: "Cet email est déjà utilisé",
  weak_password: "Mot de passe trop faible",
  age_restriction: "Vous devez avoir 18 ans minimum",
  invalid_phone: "Numéro de téléphone invalide",
  invalid_email: "Email invalide",
  missing_fields: "Champs requis manquants",
  data_too_long: "Données trop longues",
  server_error: "Erreur serveur, réessayez",
};

export default function RegisterScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "client" },
  });

  const role = watch("role");

  const onSubmit = async (data: FormData) => {
    setError(null);
    const res = await signup({
      ...data,
      activity_name: data.activity_name ?? null,
      city: data.city ?? null,
      instagram_account: null,
    });
    if (!res.success) {
      setError(
        res.error ? (ERROR_MESSAGES[res.error] ?? res.message ?? "Erreur inconnue") : (res.message ?? "Erreur inconnue")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} className="mb-6">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>

        <Animated.View entering={FadeInDown.springify()} className="gap-4">
          <View>
            <Text className="text-2xl font-bold text-foreground tracking-tight">
              Créer un compte
            </Text>
            <Text className="text-muted-foreground mt-1">
              Rejoignez la communauté Blyss
            </Text>
          </View>

          {error && (
            <View className="bg-destructive/10 rounded-2xl p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}

          {/* Role selector */}
          <View>
            <Text className="text-sm font-medium text-foreground mb-2">Je suis…</Text>
            <View className="flex-row gap-3">
              {[
                { value: "client", label: "Cliente", icon: "person", color: Colors.client },
                { value: "pro", label: "Professionnelle", icon: "briefcase", color: Colors.pro },
              ].map(({ value, label, icon, color }) => (
                <Pressable
                  key={value}
                  onPress={() => setValue("role", value as "client" | "pro")}
                  className={[
                    "flex-1 flex-row items-center justify-center gap-2 h-12 rounded-2xl border",
                    role === value ? "border-2" : "border-border bg-card",
                  ].join(" ")}
                  style={role === value ? { borderColor: color, backgroundColor: `${color}15` } : {}}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={role === value ? color : Colors.mutedForeground}
                  />
                  <Text
                    className="text-sm font-medium"
                    style={{ color: role === value ? color : Colors.mutedForeground }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller
                control={control}
                name="first_name"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Prénom"
                    value={value}
                    onChangeText={onChange}
                    autoComplete="given-name"
                    autoCapitalize="words"
                    error={errors.first_name?.message}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller
                control={control}
                name="last_name"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Nom"
                    value={value}
                    onChangeText={onChange}
                    autoComplete="family-name"
                    autoCapitalize="words"
                    error={errors.last_name?.message}
                  />
                )}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Email"
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                autoComplete="email"
                error={errors.email?.message}
                leftIcon="mail-outline"
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Mot de passe"
                value={value}
                onChangeText={onChange}
                secure
                autoComplete="new-password"
                error={errors.password?.message}
                leftIcon="lock-closed-outline"
              />
            )}
          />

          <Controller
            control={control}
            name="phone_number"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Téléphone"
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={errors.phone_number?.message}
                leftIcon="call-outline"
              />
            )}
          />

          <Controller
            control={control}
            name="birth_date"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Date de naissance (YYYY-MM-DD)"
                value={value}
                onChangeText={onChange}
                placeholder="1990-01-15"
                error={errors.birth_date?.message}
                leftIcon="calendar-outline"
              />
            )}
          />

          {role === "pro" && (
            <>
              <Controller
                control={control}
                name="activity_name"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Nom de votre activité"
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="Ex: Studio Nails by Sophie"
                    leftIcon="storefront-outline"
                  />
                )}
              />
              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Ville"
                    value={value ?? ""}
                    onChangeText={onChange}
                    placeholder="Ex: Paris"
                    leftIcon="location-outline"
                  />
                )}
              />
            </>
          )}

          <Button
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          >
            Créer mon compte
          </Button>

          <Text className="text-xs text-muted-foreground text-center">
            En créant un compte, vous acceptez nos{" "}
            <Text className="text-primary">Conditions d'utilisation</Text>
          </Text>
        </Animated.View>

        <View className="mt-6 items-center">
          <Text className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Text
              className="text-primary font-semibold"
              onPress={() => router.push("/(auth)/login")}
            >
              Se connecter
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
