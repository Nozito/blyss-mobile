import "../global.css";

import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";
import { SplashOverlay } from "@/components/ui/SplashOverlay";
import { Stack, usePathname } from "expo-router";
import { useFonts, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic } from "@expo-google-fonts/playfair-display";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { StripeProvider } from "@stripe/stripe-react-native";
import * as Sentry from "@sentry/react-native";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { RevenueCatProvider } from "@/contexts/RevenueCatContext";
import { LiveActivityProvider } from "@/contexts/LiveActivityContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { queryClient } from "@/lib/queryClient";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ToastProvider } from "@/components/ui/Toast";
import { ActionSheetProvider } from "@/components/ui/ActionSheet";
import { TransitionProvider } from "@/contexts/TransitionContext";
import { validateEnv, ENV } from "@/lib/env";
import { markStartup, logStartupReport } from "@/lib/startupMetrics";

validateEnv();
markStartup("module_eval");

// Pas de crash reporting sans DSN (dev local sans variable, ou build sans
// secret configuré) — évite un throw silencieux au démarrage.
if (ENV.SENTRY_DSN) {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    tracesSampleRate: 0.2,
    enableNativeCrashHandling: true,
    debug: __DEV__,
    // Breadcrumbs réseau (requêtes échouées visibles dans le fil d'événements).
    enableCaptureFailedRequests: true,
    // Session Replay — activé partout (les données clientes sensibles restent
    // masquées par défaut : maskAllText/maskAllImages/maskAllVectors à `true`).
    replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const STRIPE_PK = ENV.STRIPE_PK;

// Garde le splash natif affiché jusqu'à l'appel explicite de hideAsync() ci-dessous.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Filet de sécurité : si l'auth ou les polices restent bloquées anormalement
// longtemps (réseau mort, police corrompue…), on ne verrouille jamais l'app
// derrière un splash indéfini — on force l'affichage et on laisse l'écran
// cible gérer son propre état de chargement dégradé.
const READY_FAILSAFE_MS = 6000;

// Durée de fondu du launch splash — alignée sur `animationDuration` du Stack
// pour une sensation de mouvement cohérente à travers toute l'app.
const SPLASH_FADE_MS = 280;

// Plancher d'affichage du logo APRÈS que le splash natif ait réellement cédé
// la place au rendu JS (pas avant : le splash natif, lui, n'a aucun plancher
// artificiel — cf. `revealed` ci-dessous, pas `ready`). BlyssLogoLoader tourne
// sur un cycle de 3200ms (trait 0-1536ms, remplissage 1536-1984ms, tenue
// 1984-2816ms) : 2200ms laisse le dessin ET le remplissage se terminer
// entièrement au moins une fois avant le fondu de sortie.
const MIN_LOGO_VISIBLE_MS = 2200;

// ── Launch splash — fondu piloté par un vrai état de readiness ──────────────
// `revealed` ne devient vrai qu'une fois le splash natif effectivement masqué
// (cf. AppContent) : c'est SEULEMENT à cet instant que le logo JS est visible
// à l'écran, donc c'est le seul point de départ valable pour son plancher
// d'affichage.
function LaunchSplash({ revealed, onHidden }: { revealed: boolean; onHidden: () => void }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: SPLASH_FADE_MS }, (finished) => {
        if (finished) runOnJS(onHidden)();
      });
    }, MIN_LOGO_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [revealed, opacity, onHidden]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.splash, animatedStyle]}>
      <SplashOverlay logoSize={180} />
    </Animated.View>
  );
}

// ── App content ────────────────────────────────────────────────────────────
// Le Stack est monté dès le premier rendu (écran cible prêt sous le splash) ;
// `ready` pilote le hide natif, `nativeHidden` confirme qu'il a réellement eu
// lieu — c'est ce dernier (via `revealed`) qui pilote le fondu du logo JS,
// puisque c'est le seul instant où ce logo devient visible à l'écran.
// Suit la route active (expo-router ne s'appuie pas sur un NavigationContainer
// directement accessible par l'autocapture screens de PostHog) et synchronise
// l'identité PostHog avec la session — reset() explicite à la déconnexion pour
// ne pas mélanger les événements de deux comptes sur le même appareil.
function PostHogTracking() {
  const posthog = usePostHog();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const identifiedUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!posthog || !pathname) return;
    posthog.screen(pathname);
  }, [posthog, pathname]);

  useEffect(() => {
    if (!posthog || isLoading) return;
    if (user) {
      if (identifiedUserId.current !== user.id) {
        posthog.identify(String(user.id), { role: user.role, is_admin: user.is_admin, pro_status: user.pro_status ?? null });
        identifiedUserId.current = user.id;
      }
    } else if (identifiedUserId.current !== null) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [posthog, user, isLoading]);

  return null;
}

function AppContent() {
  const { isLoading } = useAuth();
  const colors = useThemeColors();
  const [fontsLoaded, fontError] = useFonts({ PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic });
  const [splashVisible, setSplashVisible] = useState(true);
  const [failsafeTriggered, setFailsafeTriggered] = useState(false);
  const [nativeHidden, setNativeHidden] = useState(false);
  const nativeHideRequested = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setFailsafeTriggered(true), READY_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, []);

  // fontError : on ne bloque jamais l'app pour une police manquante — repli silencieux.
  const ready = (!isLoading && (fontsLoaded || !!fontError)) || failsafeTriggered;

  useEffect(() => {
    if (!ready || nativeHideRequested.current) return;
    nativeHideRequested.current = true;
    markStartup("fonts_auth_ready");
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        markStartup("native_splash_hidden");
        setNativeHidden(true);
      });
  }, [ready]);

  return (
    <>
      <StatusBar style="auto" />
      <PostHogTracking />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade_from_bottom",
          animationDuration: 280,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="(client)" options={{ animation: "fade" }} />
        <Stack.Screen name="(pro)" options={{ animation: "fade" }} />
        <Stack.Screen name="(admin)" options={{ animation: "fade" }} />
        <Stack.Screen name="pro-onboarding" options={{ animation: "fade" }} />
        <Stack.Screen name="client-onboarding" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="pro-nail-styles" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        <Stack.Screen name="pro-subscription" options={{ animation: "fade" }} />
        <Stack.Screen name="pro-subscription-success" options={{ animation: "fade" }} />
        <Stack.Screen name="pro-working-hours" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        <Stack.Screen
          name="specialists"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="booking"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="specialist/[id]"
          options={{ presentation: "card", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="s/[id]" options={{ animation: "none" }} />
        <Stack.Screen
          name="booking/[id]"
          options={{ presentation: "card", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="message-thread/[id]"
          options={{ presentation: "card", animation: "slide_from_bottom" }}
        />
      </Stack>
      {splashVisible && (
        <LaunchSplash
          revealed={nativeHidden}
          onHidden={() => {
            markStartup("launch_splash_dismissed");
            logStartupReport();
            setSplashVisible(false);
          }}
        />
      )}
    </>
  );
}

// Pas d'analytics sans clé (dev local sans variable, ou build sans secret
// configuré) — même filet de sécurité que pour Sentry ci-dessus.
function PostHogRoot({ children }: { children: React.ReactNode }) {
  if (!ENV.POSTHOG_KEY) return <>{children}</>;
  return (
    <PostHogProvider apiKey={ENV.POSTHOG_KEY} options={{ host: ENV.POSTHOG_HOST }} autocapture={{ captureScreens: false }}>
      {children}
    </PostHogProvider>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <ActionSheetProvider>
            <TransitionProvider>
              <OfflineBanner />
              <StripeProvider publishableKey={STRIPE_PK} urlScheme="blyss" merchantIdentifier="merchant.com.blyss.app">
                <QueryClientProvider client={queryClient}>
                  <PostHogRoot>
                    <AuthProvider>
                      <RevenueCatProvider>
                        <NotificationProvider>
                          <LiveActivityProvider>
                            <AppContent />
                          </LiveActivityProvider>
                        </NotificationProvider>
                      </RevenueCatProvider>
                    </AuthProvider>
                  </PostHogRoot>
                </QueryClientProvider>
              </StripeProvider>
            </TransitionProvider>
          </ActionSheetProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default ENV.SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});
