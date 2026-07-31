import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import RNAnimated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";
import { SplashOverlay } from "@/components/ui/SplashOverlay";

// Durée minimale d'affichage une fois l'overlay réellement visible (fade-in
// terminé). BlyssLogoLoader tourne sur un cycle de 3200ms (trait 0-1536ms,
// remplissage 1536-1984ms, tenue 1984-2816ms) : 2200ms laisse le dessin ET le
// remplissage se terminer entièrement au moins une fois avant le fondu de
// sortie — l'overlay se referme toujours tout seul, jamais de blocage.
const MIN_VISIBLE_MS = 2200;
const FADE_MS = 280;

interface TransitionContextValue {
  /** Affiche le splash animé Blyss par-dessus l'app (connexion, réservation, etc.) */
  showTransition: () => void;
  /** Masque le splash (durée minimale anti-flicker + fondu garantis) */
  hideTransition: () => void;
}

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function TransitionProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0);
  const shownAt = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTransition = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    shownAt.current = Date.now();
    setVisible(true);
    opacity.value = withTiming(1, { duration: FADE_MS });
  }, [opacity]);

  const hideTransition = useCallback(() => {
    const elapsed = Date.now() - shownAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    hideTimer.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }, wait);
  }, [opacity]);

  const value = useMemo(() => ({ showTransition, hideTransition }), [showTransition, hideTransition]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <TransitionContext.Provider value={value}>
      {children}
      {visible && (
        // pointerEvents par défaut ("auto") : bloque volontairement les taps sur
        // l'écran précédent pendant la transition (anti double-soumission).
        <RNAnimated.View style={[styles.overlay, animatedStyle]}>
          <SplashOverlay logoSize={180} />
        </RNAnimated.View>
      )}
    </TransitionContext.Provider>
  );
}

export function useAppTransition() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useAppTransition must be used within a TransitionProvider");
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});
