import React, { useEffect } from "react";
import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/(auth)/welcome");
    } else if (user?.is_admin) {
      router.replace("/(admin)/dashboard");
    } else if (user?.role === "pro") {
      router.replace("/(pro)/dashboard");
    } else {
      router.replace("/(client)");
    }
  // router intentionnellement exclu : nouvel objet à chaque state change nav
  // user?.id stable (primitive) au lieu de user (référence objet)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user?.id, user?.role, user?.is_admin]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFF0F5",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require("@/assets/logo.png")}
        style={{ width: 120, height: 120 }}
        resizeMode="contain"
      />
      <Text
        style={{
          fontSize: 28,
          fontWeight: "900",
          color: "#FE5D9D",
          marginTop: 16,
        }}
      >
        Blyss
      </Text>
      <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
        Beauté. Business. Sérénité.
      </Text>
    </View>
  );
}
