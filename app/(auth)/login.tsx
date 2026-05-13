import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  Animated,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

const schema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type FormData = z.infer<typeof schema>;

function AnimatedInputContainer({
  children,
  isFocused,
  hasError,
}: {
  children: React.ReactNode;
  isFocused: boolean;
  hasError: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: isFocused ? 1.02 : 1,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [isFocused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        style={[
          {
            height: 56,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            borderWidth: 2,
            backgroundColor: hasError
              ? "rgba(240,58,58,0.05)"
              : "rgba(255,255,255,0.5)",
            borderColor: hasError
              ? "rgba(240,58,58,0.5)"
              : isFocused
              ? Colors.primary
              : Colors.border,
          },
          isFocused && {
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    const res = await login(data);
    if (!res.success) {
      setError(res.error ?? "Identifiants incorrects");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{
          paddingTop: insets.top + 48,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View style={{ position: "relative", marginBottom: 16 }}>
            <View
              style={{
                position: "absolute",
                inset: 0,
                width: 128,
                height: 128,
                borderRadius: 64,
                backgroundColor: `${Colors.primary}33`,
              }}
            />
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("@/assets/logo.png")}
              style={{ width: 128, height: 128 }}
              resizeMode="contain"
            />
          </View>
          <Text
            style={{
              fontSize: 30,
              fontWeight: "900",
              color: Colors.foreground,
              letterSpacing: -0.5,
            }}
          >
            Bon retour
          </Text>
          <Text
            style={{
              color: Colors.mutedForeground,
              fontSize: 14,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            Connecte-toi pour gérer tes nails en quelques taps
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: errors.email ? Colors.destructive : Colors.foreground,
                    marginBottom: 6,
                  }}
                >
                  {errors.email ? `Email · ${errors.email.message}` : "Email"}
                </Text>
                <AnimatedInputContainer
                  isFocused={focusedField === "email"}
                  hasError={!!errors.email}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={
                      focusedField === "email"
                        ? Colors.primary
                        : Colors.mutedForeground
                    }
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 16,
                      color: Colors.foreground,
                    }}
                    value={value}
                    onChangeText={onChange}
                    placeholder="ton@email.com"
                    placeholderTextColor={Colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                  />
                </AnimatedInputContainer>
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: errors.password
                        ? Colors.destructive
                        : Colors.foreground,
                    }}
                  >
                    {errors.password
                      ? `Mot de passe · ${errors.password.message}`
                      : "Mot de passe"}
                  </Text>
                  <Pressable
                    onPress={() => router.push("/(auth)/forgot-password")}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.primary,
                        fontWeight: "500",
                      }}
                    >
                      Oublié ?
                    </Text>
                  </Pressable>
                </View>
                <AnimatedInputContainer
                  isFocused={focusedField === "password"}
                  hasError={!!errors.password}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={
                      focusedField === "password"
                        ? Colors.primary
                        : Colors.mutedForeground
                    }
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 16,
                      color: Colors.foreground,
                    }}
                    value={value}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.mutedForeground}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)}>
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color={Colors.mutedForeground}
                    />
                  </Pressable>
                </AnimatedInputContainer>
              </View>
            )}
          />

          {error && (
            <View
              style={{
                backgroundColor: "rgba(240,58,58,0.1)",
                borderRadius: 16,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: Colors.destructive }}>
                {error}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            style={{ marginTop: 32 }}
          >
            <LinearGradient
              colors={["#FF5EA0", "rgba(255,94,160,0.9)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 56,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#FF5EA0",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  Se connecter
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginVertical: 32,
          }}
        >
          <View
            style={{ flex: 1, height: 1, backgroundColor: Colors.border }}
          />
          <Text
            style={{
              fontSize: 12,
              color: Colors.mutedForeground,
              paddingHorizontal: 12,
            }}
          >
            Pas encore de compte ?
          </Text>
          <View
            style={{ flex: 1, height: 1, backgroundColor: Colors.border }}
          />
        </View>

        <Pressable
          onPress={() => router.push("/(auth)/register")}
          style={{
            height: 56,
            borderRadius: 16,
            backgroundColor: Colors.card,
            borderWidth: 2,
            borderColor: Colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons
              name="sparkles-outline"
              size={18}
              color={Colors.foreground}
            />
            <Text
              style={{
                color: Colors.foreground,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              Créer un compte
            </Text>
          </View>
        </Pressable>

        <Text
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "rgba(107,114,128,0.7)",
            marginTop: 24,
            paddingHorizontal: 16,
            lineHeight: 18,
          }}
        >
          En te connectant, tu acceptes les Conditions générales et la Politique
          de confidentialité
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
