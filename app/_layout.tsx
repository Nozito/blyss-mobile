import "../global.css";

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { queryClient } from "@/lib/queryClient";

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider publishableKey={STRIPE_PK}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RevenueCatProvider>
            <NotificationProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade_from_bottom",
                  animationDuration: 280,
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
                <Stack.Screen name="(client)" options={{ animation: "fade" }} />
                <Stack.Screen name="(pro)" options={{ animation: "fade" }} />
                <Stack.Screen name="(admin)" options={{ animation: "fade" }} />
                <Stack.Screen
                  name="specialist/[id]"
                  options={{ presentation: "card", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="booking/[id]"
                  options={{ presentation: "card", animation: "slide_from_bottom" }}
                />
              </Stack>
            </NotificationProvider>
            </RevenueCatProvider>
          </AuthProvider>
        </QueryClientProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
