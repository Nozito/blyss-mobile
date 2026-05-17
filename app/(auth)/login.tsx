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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import RoleSelectionModal, { type AdminRole } from "@/components/ui/RoleSelectionModal";

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
      setSubmitError(res.error ?? "Identifiants incorrects");
      return;
    }
    const user = res.data?.user;
    console.log("user role:", user?.role);

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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & header */}
          <View className="items-center mb-10">
            <Image
              source={require("@/assets/logo.png")}
              style={{ width: 130, height: 130, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#FE5D9D",
                letterSpacing: -0.5,
              }}
            >
              Bon retour
            </Text>
            <Text className="text-sm text-muted-foreground mt-1 text-center">
              Connecte-toi pour gérer tes nails en quelques taps
            </Text>
          </View>

          {/* Form */}
          <View className="gap-3">
            {/* Email */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <ScaleOnFocus focused={focusedField === "email"}>
                  <Input
                    label="Email"
                    value={value}
                    onChangeText={onChange}
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
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: errors.password ? "#EF4444" : "#3F3F46", letterSpacing: 0.1 }}>
                        Mot de passe
                        {errors.password && (
                          <Text style={{ fontSize: 12, fontWeight: "400" }}>
                            {" "}· {errors.password.message}
                          </Text>
                        )}
                      </Text>
                      <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                        <Text style={{ fontSize: 12, color: "#FE5D9D", fontWeight: "500" }}>Oublié ?</Text>
                      </Pressable>
                    </View>
                    <Input
                      value={value}
                      onChangeText={onChange}
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

            {/* Submit error banner */}
            {submitError && (
              <Animated.View
                style={{
                  transform: [{ translateX: shakeAnim }],
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
                  {submitError}
                </Text>
              </Animated.View>
            )}

            {/* CTA */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              style={{
                marginTop: 32,
                opacity: isSubmitting ? 0.7 : 1,
                backgroundColor: "#FE5D9D",
                borderRadius: 999,
                paddingVertical: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#FE5D9D",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                    Se connecter
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Separator */}
          <View className="flex-row items-center gap-3 my-8">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-xs text-muted-foreground px-3">Pas encore de compte ?</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Sign up */}
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={{
              backgroundColor: "#fff",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="sparkles-outline" size={18} color="#374151" />
              <Text style={{ color: "#374151", fontWeight: "600", fontSize: 16 }}>
                Créer un compte
              </Text>
            </View>
          </Pressable>

          {/* Legal */}
          <Text
            style={{
              marginTop: 24,
              marginBottom: 32,
              fontSize: 12,
              color: "#9CA3AF",
              textAlign: "center",
              lineHeight: 20,
              paddingHorizontal: 8,
            }}
          >
            {"En continuant, tu acceptes nos "}
            <Text style={{ textDecorationLine: "underline", color: "#6B7280" }}>
              Conditions générales
            </Text>
            {" et notre "}
            <Text style={{ textDecorationLine: "underline", color: "#6B7280" }}>
              Politique de confidentialité
            </Text>
            {"\n"}
            <Text style={{ textDecorationLine: "underline", color: "#6B7280" }}>
              Mentions légales
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <RoleSelectionModal
        visible={showRoleModal}
        userName={loggedUserName}
        onSelectRole={handleRoleSelection}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  );
}
