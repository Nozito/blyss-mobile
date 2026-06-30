import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

export default function InstagramCallbackScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const handleCallback = async () => {
      if (!token) {
        setStatus("error");
        setTimeout(() => router.back(), 1500);
        return;
      }
      try {
        await SecureStore.setItemAsync("instagram_token", token);
        setStatus("success");
      } catch {
        setStatus("error");
      } finally {
        setTimeout(() => router.back(), 1200);
      }
    };
    void handleCallback();
  }, [token, router]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
        {status === "loading" && <ActivityIndicator size="large" color={Colors.primary} />}
        {status === "success" && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.successLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="logo-instagram" size={36} color={Colors.success} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.foreground, textAlign: "center" }}>Instagram connecté ✓</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>Tes photos seront disponibles dans ton profil.</Text>
          </>
        )}
        {status === "error" && (
          <>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: Colors.destructiveLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close-circle-outline" size={36} color={Colors.destructive} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.foreground, textAlign: "center" }}>Connexion échouée</Text>
            <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>Réessaie depuis ton profil.</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
