import React, { useState, useRef } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
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
            <View style={{ position: "relative", marginBottom: 16 }}>
              <View
                style={{
                  position: "absolute",
                  width: 128,
                  height: 128,
                  borderRadius: 64,
                  backgroundColor: "rgba(254,93,157,0.2)",
                }}
              />
              <Image
                source={require("@/assets/logo.png")}
                style={{ width: 128, height: 128 }}
                resizeMode="contain"
              />
            </View>
            <Text className="text-3xl font-black text-foreground tracking-tight">
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
                  <View className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-sm font-semibold ${
                          errors.password ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        Mot de passe
                        {errors.password && (
                          <Text className="text-xs font-normal">
                            {" "}· {errors.password.message}
                          </Text>
                        )}
                      </Text>
                      <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                        <Text className="text-xs text-primary font-medium">Oublié ?</Text>
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
              <View className="bg-destructive/10 rounded-lg p-3">
                <Text className="text-sm text-destructive">{submitError}</Text>
              </View>
            )}

            {/* CTA */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              style={{ marginTop: 32, opacity: isSubmitting ? 0.7 : 1 }}
            >
              <LinearGradient
                colors={["#FE5D9D", "rgba(254,93,157,0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 56,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#FE5D9D",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                    <Text className="text-white font-bold text-base">Se connecter</Text>
                  </View>
                )}
              </LinearGradient>
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
            className="h-14 rounded-2xl bg-card border-2 border-border items-center justify-center active:opacity-70"
          >
            <View className="flex-row gap-2 items-center">
              <Ionicons name="sparkles-outline" size={18} color="#09090B" />
              <Text className="text-foreground font-semibold text-base">Créer un compte</Text>
            </View>
          </Pressable>

          {/* Legal */}
          <Text className="text-center text-xs text-muted-foreground mt-6 px-4 leading-relaxed">
            En te connectant, tu acceptes les{" "}
            <Text className="underline font-medium">Conditions générales</Text> et la{" "}
            <Text className="underline font-medium">Politique de confidentialité</Text>
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
