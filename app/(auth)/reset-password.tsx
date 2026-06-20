import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { authApi } from "@/lib/api";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,128}$/;

  const handleReset = async () => {
    if (!password || !PASSWORD_REGEX.test(password)) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword({ token: token ?? "", password });
      Alert.alert("Succès", "Mot de passe mis à jour !", [
        { text: "Se connecter", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch {
      Alert.alert("Erreur", "Lien invalide ou expiré. Demande un nouveau lien.");
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
            onPress={() => router.back()}
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

          <Pressable
            onPress={handleReset}
            disabled={isLoading}
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
