import React, { useRef, useEffect } from "react";
import { View, Text, Image, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { withAlpha } from "@/constants/colors";
import { INK, CREAM, PillButton } from "@/components/onboarding/kit";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();

  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [reduceMotion, opacity]);

  const go = (path: "/(auth)/register" | "/(auth)/login") => {
    Haptics.impactAsync(
      path === "/(auth)/register" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    ).catch(() => {});
    router.push(path);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <View style={{ position: "absolute", top: insets.top + 12, left: 22 }}>
        <Image source={require("@/assets/logo.png")} style={{ width: 38, height: 38 }} resizeMode="contain" />
      </View>

      <Animated.View style={{ flex: 1, opacity, paddingTop: insets.top + 78 }}>
        <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
          <Text
            style={{ color: INK, fontWeight: "900", fontSize: 44, lineHeight: 44, letterSpacing: -1.2, textTransform: "uppercase" }}
          >
            Tes ongles, ton rendez-vous
          </Text>

          <View
            style={{
              alignSelf: "flex-start",
              marginTop: 18,
              backgroundColor: INK,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 5,
              transform: [{ rotate: "-3deg" }],
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Ton compte en 1 minute
            </Text>
          </View>

          <Text style={{ color: INK, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 22, maxWidth: 320 }}>
            Trouve ta prothésiste ongulaire et réserve un vrai créneau. Sans appeler, sans DM.
          </Text>
          <Text
            style={{
              color: INK,
              opacity: 0.72,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginTop: 18,
            }}
          >
            → Chaque prothésiste est vérifiée par Blyss
          </Text>
        </View>
      </Animated.View>

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 16, paddingTop: 10, gap: 10 }}>
        <PillButton label="Créer mon compte →" onPress={() => go("/(auth)/register")} bg={INK} fg={CREAM} />
        <Pressable onPress={() => go("/(auth)/login")} style={{ alignItems: "center", paddingVertical: 8 }}>
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
