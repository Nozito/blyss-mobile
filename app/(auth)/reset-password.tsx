import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { authApi } from "@/lib/api";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,128}$/;

  const handleReset = async () => {
    setError(null);
    if (!password || !PASSWORD_REGEX.test(password)) {
      setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword({ token: token ?? "", password });
      setSuccess(true);
      setTimeout(() => router.replace("/(auth)/login"), 1500);
    } catch {
      setError("Lien invalide ou expiré. Demande un nouveau lien.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            className="w-10 h-10 rounded-xl bg-muted items-center justify-center mb-8"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>

          <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center mb-6">
            <Ionicons name="lock-closed-outline" size={28} color={Colors.primary} />
          </View>

          <Text className="text-3xl font-bold text-foreground mb-2">
            Nouveau mot de passe
          </Text>
          <Text className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Choisis un mot de passe sécurisé d'au moins 8 caractères.
          </Text>

          {/* Password field */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Nouveau mot de passe
            </Text>
            <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14">
              <Ionicons name="lock-closed-outline" size={18} color={Colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 text-foreground text-sm"
                placeholder="Min. 8 caractères"
                placeholderTextColor={Colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPwd((p) => !p)}>
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={Colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm field */}
          <View className="mb-8">
            <Text className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              Confirmer le mot de passe
            </Text>
            <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14">
              <Ionicons name="lock-closed-outline" size={18} color={Colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 text-foreground text-sm"
                placeholder="Répète ton mot de passe"
                placeholderTextColor={Colors.mutedForeground}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowConfirm((p) => !p)}>
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={Colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {error && <View className="mb-4"><ErrorMessage message={error} /></View>}
          {success && (
            <View className="mb-4 p-4 rounded-2xl bg-success/10 border border-success/30">
              <Text className="text-success font-semibold text-center">Mot de passe mis à jour ! Redirection…</Text>
            </View>
          )}

          <Pressable
            onPress={handleReset}
            disabled={isLoading || success}
            className="bg-primary rounded-2xl h-14 items-center justify-center active:opacity-80"
            style={{ opacity: isLoading ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isLoading ? "Enregistrement..." : "Enregistrer le mot de passe"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
