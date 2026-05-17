import React from "react";
import { View, Text, Image } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
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

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user?.is_admin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (user?.role === "pro") {
    return <Redirect href="/(pro)/dashboard" />;
  }

  return <Redirect href="/(client)" />;
}
