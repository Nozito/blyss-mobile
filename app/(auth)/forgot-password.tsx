import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components/ui/Input";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsSending(true);
    try {
      // Always show success — don't reveal whether the email exists (security best practice)
      await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).catch(() => {});
    } finally {
      setIsSending(false);
      setSent(true);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 48,
            paddingBottom: 32,
            flexGrow: 1,
            justifyContent: "center",
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <AnimatedIconButton
            onPress={() => router.back()}
            className="flex-row items-center gap-1.5 mb-8"
          >
            <Ionicons name="chevron-back" size={18} color="#6D6D78" />
            <Text className="text-sm text-muted-foreground">Retour</Text>
          </AnimatedIconButton>

          {sent ? (
            /* ── Success state ─────────────────────────────────────── */
            <View className="items-center gap-4">
              <View className="w-18 h-18 rounded-2xl bg-primary/10 items-center justify-center mb-2"
                style={{ width: 72, height: 72, borderRadius: 22 }}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#FE5D9D" />
              </View>

              <Text className="text-2xl font-black text-foreground tracking-tight text-center">
                Email envoyé
              </Text>
              <Text className="text-sm text-muted-foreground text-center leading-5 px-2">
                Si cette adresse est associée à un compte, tu recevras un lien
                de réinitialisation dans quelques minutes.
              </Text>
              <Text className="text-xs text-muted-foreground text-center">
                Pense à vérifier tes spams.
              </Text>

              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                className="w-full mt-2"
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
                  <Text className="text-white font-bold text-base">
                    Retour à la connexion
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            /* ── Form state ────────────────────────────────────────── */
            <>
              <View className="items-center mb-8">
                <View
                  className="bg-primary/10 items-center justify-center mb-4"
                  style={{ width: 72, height: 72, borderRadius: 22 }}
                >
                  <Ionicons name="mail-outline" size={30} color="#FE5D9D" />
                </View>
                <Text className="text-2xl font-black text-foreground tracking-tight text-center">
                  Mot de passe oublié
                </Text>
                <Text className="text-sm text-muted-foreground text-center mt-2 leading-5">
                  Saisis ton email et on t'envoie un lien de réinitialisation.
                </Text>
              </View>

              <View className="gap-3">
                <ScaleOnFocus focused={isFocused}>
                  <Input
                    label="Adresse email"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="ton@email.fr"
                    keyboardType="email-address"
                    autoComplete="email"
                    leftIcon="mail-outline"
                  />
                </ScaleOnFocus>

                <Pressable
                  onPress={handleSubmit}
                  disabled={isSending || !email.trim()}
                  style={{ marginTop: 24, opacity: !email.trim() ? 0.5 : 1 }}
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
                    {isSending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="send-outline" size={18} color="#fff" />
                        <Text className="text-white font-bold text-base">
                          Envoyer le lien
                        </Text>
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>

              <Pressable
                onPress={() => router.replace("/(auth)/login")}
                className="mt-6 items-center"
              >
                <Text className="text-sm text-primary font-medium">
                  Retour à la connexion
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
