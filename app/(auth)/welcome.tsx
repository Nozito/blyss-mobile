import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, Text, Image, Pressable, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withAlpha } from "@/constants/colors";
import { INK, CREAM, PillButton } from "@/components/onboarding/kit";

// Techniques nails défilant en fond — étiquettes mono à filet.
const ROW1_BASE = ["pose gel", "french manucure", "nail art", "capsules", "prolongation", "baby boomer"];
const ROW2_BASE = ["agenda pro", "semi-permanent", "clientes fidèles", "stamping", "décoration", "gel uv"];
const ROW3_BASE = ["paiement en ligne", "résine", "avis clients", "ombré nails", "nail piercing", "extensions"];
const ROW1 = [...ROW1_BASE, ...ROW1_BASE];
const ROW2 = [...ROW2_BASE, ...ROW2_BASE];
const ROW3 = [...ROW3_BASE, ...ROW3_BASE];
const SPEED_PX_MS = 0.035;

const PillRow = React.memo(function PillRow({
  items,
  translateX,
  onMeasureWidth,
}: {
  items: string[];
  translateX: Animated.Value;
  onMeasureWidth: (width: number) => void;
}) {
  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.View
        style={{ flexDirection: "row", paddingVertical: 2, paddingLeft: 18, alignSelf: "flex-start", transform: [{ translateX }] }}
        onLayout={(e) => onMeasureWidth(e.nativeEvent.layout.width)}
      >
        {items.map((label, i) => (
          <View
            key={i}
            style={{
              borderWidth: 1,
              borderColor: withAlpha(INK, 0.35),
              paddingHorizontal: 9,
              paddingVertical: 4,
              marginRight: 6,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: INK,
                opacity: 0.75,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();

  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const contentY = useRef(new Animated.Value(reduceMotion ? 0 : 18)).current;

  const scroll1 = useRef(new Animated.Value(0)).current;
  const scroll2 = useRef(new Animated.Value(0)).current;
  const scroll3 = useRef(new Animated.Value(0)).current;
  const rowWidths = useRef<[number, number, number]>([0, 0, 0]);
  const [widthsReady, setWidthsReady] = useState(false);
  const handleMeasureWidth = useCallback(
    (idx: 0 | 1 | 2) => (width: number) => {
      if (rowWidths.current[idx] === width) return;
      rowWidths.current[idx] = width;
      if (rowWidths.current.every((w) => w > 0)) setWidthsReady(true);
    },
    []
  );

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(contentY, { toValue: 0, damping: 16, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, contentOpacity, contentY]);

  useEffect(() => {
    if (reduceMotion || !widthsReady) return;
    const [w1, w2, w3] = rowWidths.current.map((w) => w / 2);
    const mk = (v: Animated.Value, to: number, from = 0) => {
      v.setValue(from);
      return Animated.loop(
        Animated.timing(v, { toValue: to, duration: Math.abs(to - from) / SPEED_PX_MS, easing: Easing.linear, useNativeDriver: true })
      );
    };
    const a1 = mk(scroll1, -w1);
    const a2 = mk(scroll2, 0, -w2);
    const a3 = mk(scroll3, -w3);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [reduceMotion, widthsReady, scroll1, scroll2, scroll3]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <View style={{ position: "absolute", top: insets.top + 10, left: 0, right: 0, alignItems: "center" }}>
        <Image source={require("@/assets/logo.png")} style={{ width: 44, height: 44 }} resizeMode="contain" />
      </View>

      <Animated.View style={{ flex: 1, opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
        <View style={{ flex: 1, paddingHorizontal: 22, paddingTop: insets.top + 70, justifyContent: "center" }}>
          <Text
            style={{ color: INK, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.7, marginBottom: 16 }}
          >
            ✦ Blyss · onglerie
          </Text>
          <Text style={{ color: INK, fontWeight: "900", fontSize: 46, lineHeight: 46, letterSpacing: -1.4, textTransform: "uppercase" }}>
            Fais briller tes ongles
          </Text>
          <Text style={{ color: INK, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 18, maxWidth: 320 }}>
            La plateforme des prothésistes ongulaires et de leurs clientes.
          </Text>
        </View>

        <View style={{ gap: 8, paddingBottom: 10 }}>
          <PillRow items={ROW1} translateX={scroll1} onMeasureWidth={handleMeasureWidth(0)} />
          <PillRow items={ROW2} translateX={scroll2} onMeasureWidth={handleMeasureWidth(1)} />
          <PillRow items={ROW3} translateX={scroll3} onMeasureWidth={handleMeasureWidth(2)} />
        </View>
      </Animated.View>

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16, paddingTop: 10, gap: 10 }}>
        <PillButton
          label="Rejoindre Blyss →"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push("/(auth)/register");
          }}
          bg={INK}
          fg={CREAM}
        />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push("/(auth)/login");
          }}
          style={{ alignItems: "center", paddingVertical: 8 }}
        >
          <Text style={{ color: INK, opacity: 0.7, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
            J'ai déjà un compte
          </Text>
        </Pressable>
        <Text style={{ color: withAlpha(INK, 0.5), fontSize: 10, textAlign: "center", lineHeight: 15 }}>
          En continuant tu acceptes nos{" "}
          <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/cgu")}>
            CGU
          </Text>{" "}
          et la{" "}
          <Text style={{ fontWeight: "700", textDecorationLine: "underline" }} onPress={() => WebBrowser.openBrowserAsync("https://blyssapp.fr/confidentialite")}>
            politique de confidentialité
          </Text>
        </Text>
      </View>
    </View>
  );
}
