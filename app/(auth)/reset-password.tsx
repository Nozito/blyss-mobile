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
import { useThemeColors } from "@/hooks/useThemeColors";
import { authApi } from "@/lib/api";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,128}$/;

  const handleReset = async () => {
    setError(null);
    if (!password || !PASSWORD_REGEX.test(password)) {
      setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial (!@#$%^&*).");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    try {
      // apiCall() ne rejette jamais sa promesse — sans vérifier res.success,
      // un lien invalide/expiré affichait quand même "mot de passe mis à
      // jour", laissant croire à l'utilisateur que son mot de passe avait
      // changé alors que rien ne s'était passé côté serveur.
      const res = await authApi.resetPassword({ token: token ?? "", password });
      if (!res.success) {
        setError(res.error ?? "Lien invalide ou expiré. Demande un nouveau lien.");
        return;
      }
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
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            className="w-10 h-10 rounded-xl items-center justify-center mb-8"
            style={{ backgroundColor: colors.muted }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>

          <View className="w-16 h-16 rounded-2xl items-center justify-center mb-6" style={{ backgroundColor: `${colors.primary}1A` }}>
            <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
          </View>

          <Text className="text-3xl font-bold mb-2" style={{ color: colors.foreground }}>
            Nouveau mot de passe
          </Text>
          <Text className="text-sm mb-8 leading-relaxed" style={{ color: colors.mutedForeground }}>
            Choisis un mot de passe sécurisé d'au moins 8 caractères.
          </Text>

          {/* Password field */}
          <View className="mb-4">
            <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: colors.mutedForeground }}>
              Nouveau mot de passe
            </Text>
            <View className="flex-row items-center border rounded-2xl px-4 h-14" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 text-sm"
                style={{ color: colors.foreground }}
                placeholder="Min. 8 caractères"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPwd((p) => !p)}
                accessibilityRole="button"
                accessibilityLabel={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                accessibilityState={{ checked: showPwd }}
              >
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm field */}
          <View className="mb-8">
            <Text className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: colors.mutedForeground }}>
              Confirmer le mot de passe
            </Text>
            <View className="flex-row items-center border rounded-2xl px-4 h-14" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                className="flex-1 ml-3 text-sm"
                style={{ color: colors.foreground }}
                placeholder="Répète ton mot de passe"
                placeholderTextColor={colors.mutedForeground}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowConfirm((p) => !p)}
                accessibilityRole="button"
                accessibilityLabel={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                accessibilityState={{ checked: showConfirm }}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>

          {error && <View className="mb-4"><ErrorMessage message={error} /></View>}
          {success && (
            <View className="mb-4 p-4 rounded-2xl border" style={{ backgroundColor: `${colors.success}1A`, borderColor: `${colors.success}4D` }}>
              <Text className="font-semibold text-center" style={{ color: colors.success }}>Mot de passe mis à jour ! Redirection…</Text>
            </View>
          )}

          <Pressable
            onPress={handleReset}
            disabled={isLoading || success}
            className="rounded-2xl h-14 items-center justify-center"
            style={{ backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }}
          >
            <Text className="font-bold text-base" style={{ color: colors.onColor }}>
              {isLoading ? "Enregistrement..." : "Enregistrer le mot de passe"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
