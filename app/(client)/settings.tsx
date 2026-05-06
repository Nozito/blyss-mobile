import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Colors } from "@/constants/colors";
import type { User } from "@/lib/api";

export default function ClientSettingsScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Partial<User>>({
    defaultValues: {
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      phone_number: user?.phone_number ?? "",
      city: user?.city ?? "",
    },
  });

  const onSubmit = async (data: Partial<User>) => {
    setSaving(true);
    try {
      const res = await updateUser(data);
      if (res.success) {
        Alert.alert("Succès", "Profil mis à jour");
        router.back();
      } else {
        Alert.alert("Erreur", res.error ?? "Impossible de mettre à jour");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Mon profil
        </Text>
      </View>

      <View className="gap-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="first_name"
              render={({ field: { onChange, value } }) => (
                <Input label="Prénom" value={value ?? ""} onChangeText={onChange} autoCapitalize="words" />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="last_name"
              render={({ field: { onChange, value } }) => (
                <Input label="Nom" value={value ?? ""} onChangeText={onChange} autoCapitalize="words" />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="phone_number"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Téléphone"
              value={value ?? ""}
              onChangeText={onChange}
              keyboardType="phone-pad"
              leftIcon="call-outline"
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
              leftIcon="location-outline"
            />
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} loading={saving} fullWidth size="lg">
          Enregistrer
        </Button>
      </View>
    </ScrollView>
  );
}
