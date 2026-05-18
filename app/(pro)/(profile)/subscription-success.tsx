import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { Colors } from "@/constants/colors";

type PlanId = "start" | "serenite" | "signature";

const PLAN_LABELS: Record<PlanId, string> = {
  start: "Start",
  serenite: "Sérénité",
  signature: "Signature",
};

export default function ProSubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<ConfettiCannon>(null);
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = (params.plan ?? "start") as PlanId;

  useEffect(() => {
    confettiRef.current?.start();

    // 4s : laisse le confetti se déployer complètement avant de naviguer
    const timer = setTimeout(() => {
      router.replace("/(pro)/onboarding");
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {/* Confetti depuis le haut de l'écran */}
      <ConfettiCannon
        ref={confettiRef}
        count={180}
        origin={{ x: 200, y: -20 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={2800}
        colors={[Colors.primary, "#7C3AED", "#F59E0B", "#10B981", "#EC4899", "#fff"]}
      />

      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        {/* Badge succès animé */}
        <View style={styles.iconWrap}>
          <View style={[styles.iconBg, { backgroundColor: `${Colors.success}20` }]} />
          <View style={[styles.iconCircle, { backgroundColor: Colors.success }]}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
        </View>

        {/* Texte */}
        <Text style={[styles.title, { color: Colors.foreground }]}>
          Félicitations ! 🎉
        </Text>
        <Text style={[styles.subtitle, { color: Colors.primary }]}>
          Votre espace pro est prêt
        </Text>
        <Text style={[styles.body, { color: Colors.mutedForeground }]}>
          Tu as maintenant accès à toutes les{"\n"}fonctionnalités de la formule{" "}
          <Text style={{ fontWeight: "700", color: Colors.foreground }}>
            {PLAN_LABELS[plan]}
          </Text>
          .
        </Text>

        {/* Badge plan actif */}
        <View style={[styles.activeBadge, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }]}>
          <View style={styles.activeDot} />
          <Text style={[styles.activeBadgeText, { color: "#15803D" }]}>
            {PLAN_LABELS[plan]} · Actif
          </Text>
        </View>

        <Text style={[styles.redirect, { color: Colors.mutedForeground }]}>
          Redirection en cours…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconBg: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 32,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  redirect: {
    fontSize: 12,
  },
});
