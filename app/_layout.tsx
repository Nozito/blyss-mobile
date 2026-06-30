import "../global.css";

import React, { useEffect, useRef, useState } from "react";
import { View, Image, Animated, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Stack } from "expo-router";
import { useFonts, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic } from "@expo-google-fonts/playfair-display";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { queryClient } from "@/lib/queryClient";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { validateEnv, ENV } from "@/lib/env";

validateEnv();

const STRIPE_PK = ENV.STRIPE_PK;

SplashScreen.preventAutoHideAsync();

// ── Splash JS animé (fond rose + logo, fade-out 500ms) ───────────────────────
function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onDone());
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.splash, { opacity }]} pointerEvents="none">
      <Image
        source={require("../assets/logo.png")}
        style={styles.splashLogo}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

// ── App content — attend que l'auth + les fonts soient prêts ─────────────────
function AppContent() {
  const { isLoading } = useAuth();
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic });
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      setAppReady(true);
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, fontsLoaded]);

  // Pendant la restauration de session : splash statique (zéro flash)
  if (!appReady) {
    return (
      <View style={styles.splash}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <>
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
          name="specialists"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="booking"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="my-bookings"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="specialist/[id]"
          options={{ presentation: "card", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="booking/[id]"
          options={{ presentation: "card", animation: "slide_from_bottom" }}
        />
      </Stack>
      {/* Fade-out du splash JS par-dessus l'app */}
      {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
    </>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <OfflineBanner />
        <StripeProvider publishableKey={STRIPE_PK} urlScheme="blyss" merchantIdentifier="merchant.com.blyss.app">
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RevenueCatProvider>
                <NotificationProvider>
                  <AppContent />
                </NotificationProvider>
              </RevenueCatProvider>
            </AuthProvider>
          </QueryClientProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  splashLogo: {
    width: 180,
    height: 180,
  },
});
