import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 16 }}
    >
      <Pressable onPress={() => router.back()} className="mb-8">
        <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
      </Pressable>

      <Text className="text-2xl font-bold text-foreground">
        Mot de passe oublié
      </Text>
      <Text className="text-muted-foreground mt-2 mb-8">
        Cette fonctionnalité sera disponible prochainement.
      </Text>

      <Pressable
        onPress={() => router.back()}
        className="flex-row items-center gap-2"
      >
        <Ionicons name="arrow-back-outline" size={16} color={Colors.primary} />
        <Text className="text-primary font-medium">Retour à la connexion</Text>
      </Pressable>
    </View>
  );
}
