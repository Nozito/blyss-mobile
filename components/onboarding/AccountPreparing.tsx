/**
 * Interstitiel « on prépare / on vérifie ton compte » entre la création du
 * compte et l'écran de succès. Donne une impression de travail réel (analyse,
 * vérification) au lieu d'un basculement instantané qui paraît suspect.
 *
 * Progression volontairement irrégulière (incréments aléatoires) et bornée :
 * jamais moins de ~2,6 s, jamais plus de ~4 s.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import Reanimated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { withAlpha } from "@/constants/colors";

const FILL_WORD = "Presque prêt";

const STEPS = [
  { at: 0, label: "Création de ton compte" },
  { at: 0.32, label: "Vérification de tes informations" },
  { at: 0.62, label: "Sécurisation de ton profil" },
  { at: 0.86, label: "Préparation de tes recommandations" },
];

const TICK_MS = 400;
const MIN_MS = 2600;
const MAX_MS = 4000;

export function AccountPreparing({ ink, onDone }: { ink: string; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [textW, setTextW] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const doneRef = useRef(false);

  const fillStyle = useAnimatedStyle(() => ({ width: textW * progress.value }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(onDone, 320);
  }, [onDone]);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      const t = setTimeout(finish, MIN_MS);
      return () => clearTimeout(t);
    }

    const start = Date.now();
    let value = 0;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      // Plancher qui monte avec le temps : évite une fin trop précoce.
      const floor = Math.min(0.92, elapsed / MIN_MS);
      value = Math.max(value + 0.05 + Math.random() * 0.15, floor);
      if (value >= 1 || elapsed >= MAX_MS) {
        value = 1;
        clearInterval(id);
      }
      progress.value = withTiming(value, { duration: TICK_MS * 0.9 });

      const next = STEPS.reduce((acc, s, i) => (value >= s.at ? i : acc), 0);
      setStepIndex((prev) => {
        if (next !== prev) Haptics.selectionAsync().catch(() => {});
        return next;
      });

      if (value >= 1) finish();
    }, TICK_MS);

    return () => clearInterval(id);
  }, [reduceMotion, progress, finish]);

  return (
    <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
      <View style={{ alignSelf: "flex-start" }}>
        <Text
          numberOfLines={1}
          onLayout={(e) => setTextW(e.nativeEvent.layout.width)}
          style={{
            color: withAlpha(ink, 0.22),
            fontWeight: "900",
            fontSize: 40,
            letterSpacing: -1.2,
            textTransform: "uppercase",
          }}
        >
          {FILL_WORD}
        </Text>
        <Reanimated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" }, fillStyle]}>
          <Text
            numberOfLines={1}
            style={{
              width: textW || undefined,
              color: ink,
              fontWeight: "900",
              fontSize: 40,
              letterSpacing: -1.2,
              textTransform: "uppercase",
            }}
          >
            {FILL_WORD}
          </Text>
        </Reanimated.View>
      </View>

      <View style={{ height: 2, marginTop: 26, backgroundColor: withAlpha(ink, 0.15), overflow: "hidden" }}>
        <Reanimated.View style={[{ height: 2, backgroundColor: ink }, barStyle]} />
      </View>

      <Text
        style={{
          color: ink,
          opacity: 0.72,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginTop: 16,
        }}
      >
        {STEPS[stepIndex].label}
      </Text>
    </View>
  );
}
