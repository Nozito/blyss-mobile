/**
 * Kit visuel « poster editorial » partagé par la création de compte
 * (app/(auth)/register.tsx) et l'onboarding client (app/client-onboarding.tsx) :
 * champs de couleur pleins, titres 900 capitales, bouton pilule, ruban de
 * transition à rayures. Cf. docs/DESIGN_34_client-onboarding-refonte.md.
 */
import React, { useCallback, useRef } from "react";
import { Animated as RNAnimated, Pressable, Text, View, ActivityIndicator } from "react-native";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { withAlpha } from "@/constants/colors";

/** Encres fixes des champs de couleur assumés (rose, prune). */
export const INK = "#1A0710";
export const CREAM = "#F6E9EE";
export const PRUNE = "#3D1F2C";

export type FieldTone = "rose" | "cream" | "prune";

/** Fond + encre + couleurs du bouton pilule pour une tonalité donnée. */
export function fieldColors(
  tone: FieldTone,
  colors: { primary: string; cream: string; foreground: string; background: string }
) {
  switch (tone) {
    case "rose":
      return { bg: colors.primary, ink: INK, pill: { bg: INK, fg: CREAM } };
    case "prune":
      return { bg: PRUNE, ink: CREAM, pill: { bg: CREAM, fg: PRUNE } };
    default:
      return { bg: colors.cream, ink: colors.foreground, pill: { bg: colors.foreground, fg: colors.background } };
  }
}

/** Bouton pilule pleine largeur — libellé sur une ligne. */
export function PillButton({
  label,
  onPress,
  bg,
  fg,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  fg: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const scale = useRef(new RNAnimated.Value(1)).current;
  const off = loading || disabled;
  return (
    <RNAnimated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={off}
        onPressIn={() => RNAnimated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          height: 54,
          borderRadius: 999,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          opacity: off ? 0.55 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Text
            numberOfLines={1}
            style={{ color: fg, fontSize: 13.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </RNAnimated.View>
  );
}

/** Ruban à rayures diagonales rose × prune, piloté par `useRibbon`. */
export function Ribbon({ x, width, rose }: { x: SharedValue<number>; width: number; rose: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * width }, { skewX: "-9deg" }],
  }));
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: -80, bottom: -80, left: 0, width: width * 2, flexDirection: "row" }, style]}
    >
      {Array.from({ length: 22 }).map((_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? PRUNE : rose }} />
      ))}
    </Reanimated.View>
  );
}

/**
 * Transition ruban : couvre l'écran (200 ms) → `onCover()` (change d'étape ou
 * navigue) → découvre (320 ms). `prefers-reduced-motion` → `onCover()` direct.
 */
export function useRibbon() {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(1.1);

  const go = useCallback(
    (onCover: () => void) => {
      if (reduceMotion) {
        onCover();
        return;
      }
      x.value = withTiming(-0.5, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (!finished) return;
        runOnJS(onCover)();
        x.value = withTiming(-2.2, { duration: 320, easing: Easing.out(Easing.cubic) });
      });
    },
    [reduceMotion, x]
  );

  return { x, go, reduceMotion };
}

/** Header commun : numéro d'étape géant + filet de progression + skip/retour. */
export function StepHeader({
  step,
  total,
  ink,
  right,
  onBack,
}: {
  step: number;
  total: number;
  ink: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  const progress = useSharedValue(step / total);
  React.useEffect(() => {
    progress.value = withTiming(step / total, { duration: 400 });
  }, [step, total, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
              <Text style={{ color: ink, fontSize: 22, opacity: 0.7 }}>←</Text>
            </Pressable>
          ) : null}
          <Text style={{ color: ink, fontWeight: "900", fontSize: 30, letterSpacing: -1.5 }}>
            {String(step).padStart(2, "0")}
          </Text>
        </View>
        {right}
      </View>
      <View
        style={{ height: 2, marginTop: 10, borderRadius: 2, backgroundColor: withAlpha(ink, 0.18), overflow: "hidden" }}
      >
        <Reanimated.View style={[{ height: 2, borderRadius: 2, backgroundColor: ink }, fill]} />
      </View>
    </View>
  );
}
