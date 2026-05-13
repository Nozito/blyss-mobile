import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

function AnimatedInputContainer({
  children,
  isFocused,
}: {
  children: React.ReactNode;
  isFocused: boolean;
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
        style={{
          height: 56,
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          borderWidth: 2,
          backgroundColor: "rgba(255,255,255,0.5)",
          borderColor: isFocused ? Colors.primary : Colors.border,
          ...(isFocused && {
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
          }),
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsSending(true);
    try {
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
          flexGrow: 1,
          justifyContent: "center",
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 32 }}
        >
          <Ionicons name="chevron-back" size={18} color={Colors.mutedForeground} />
          <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Retour</Text>
        </Pressable>

        {sent ? (
          /* ── SUCCESS STATE ── */
          <View style={{ alignItems: "center", gap: 16 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: `${Colors.primary}18`,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={32} color={Colors.primary} />
            </View>

            <Text
              style={{
                fontSize: 26,
                fontWeight: "900",
                color: Colors.foreground,
                letterSpacing: -0.5,
                textAlign: "center",
              }}
            >
              Email envoyé
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: Colors.mutedForeground,
                textAlign: "center",
                lineHeight: 20,
                paddingHorizontal: 8,
              }}
            >
              Si cette adresse est associée à un compte, tu recevras un lien de
              réinitialisation dans quelques minutes.
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, textAlign: "center" }}>
              Pense à vérifier tes spams.
            </Text>

            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={{ width: "100%", marginTop: 8 }}
            >
              <LinearGradient
                colors={[Colors.primary, `${Colors.primary}E6`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 56,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: Colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  Retour à la connexion
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          /* ── FORM STATE ── */
          <>
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  backgroundColor: `${Colors.primary}18`,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Ionicons name="mail-outline" size={30} color={Colors.primary} />
              </View>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: Colors.foreground,
                  letterSpacing: -0.5,
                  textAlign: "center",
                }}
              >
                Mot de passe oublié
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.mutedForeground,
                  textAlign: "center",
                  marginTop: 6,
                  lineHeight: 20,
                }}
              >
                Saisis ton email et on t'envoie un lien de réinitialisation.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: Colors.foreground,
                  marginBottom: 6,
                }}
              >
                Adresse email
              </Text>
              <AnimatedInputContainer isFocused={isFocused}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={isFocused ? Colors.primary : Colors.mutedForeground}
                />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    fontSize: 16,
                    color: Colors.foreground,
                  }}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ton@email.fr"
                  placeholderTextColor={Colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </AnimatedInputContainer>

              <Pressable
                onPress={handleSubmit}
                disabled={isSending || !email.trim()}
                style={{ marginTop: 24, opacity: !email.trim() ? 0.5 : 1 }}
              >
                <LinearGradient
                  colors={[Colors.primary, `${Colors.primary}E6`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 56,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: Colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Ionicons name="send-outline" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                        Envoyer le lien
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
