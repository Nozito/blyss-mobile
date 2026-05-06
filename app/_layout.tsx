import "../global.css";

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { queryClient } from "@/lib/queryClient";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
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
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
