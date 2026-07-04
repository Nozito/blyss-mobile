import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    specialistName?: string;
    serviceName?: string;
    date?: string;
    time?: string;
    amount?: string;
    confirmationCode?: string;
  }>();

  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const details = [
    params.specialistName ? { label: "Spécialiste", value: params.specialistName } : null,
    params.serviceName    ? { label: "Prestation",   value: params.serviceName }    : null,
    params.date           ? { label: "Date",          value: params.date }           : null,
    params.time           ? { label: "Heure",         value: params.time }           : null,
    params.amount         ? { label: "Montant",       value: `${params.amount} €` } : null,
    params.confirmationCode ? { label: "Référence", value: params.confirmationCode } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated checkmark */}
        <Animated.View
          style={[
            styles.checkCircle,
            { transform: [{ scale: scaleAnim }], opacity: opacAnim },
          ]}
        >
          <Ionicons name="checkmark" size={52} color={Colors.white} />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{ opacity: opacAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}
        >
          <Text style={styles.title}>Réservation confirmée !</Text>
          <Text style={styles.subtitle}>
            Tu recevras une confirmation et un rappel avant ton rendez-vous.
          </Text>
        </Animated.View>

        {/* Detail card */}
        {details.length > 0 && (
          <Animated.View
            style={[styles.card, { opacity: opacAnim, transform: [{ translateY: slideAnim }] }]}
          >
            {details.map((d, i) => (
              <View key={d.label}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{d.label}</Text>
                  <Text style={styles.rowValue}>{d.value}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* CTAs */}
        <Animated.View style={[styles.ctas, { opacity: opacAnim }]}>
          <AnimatedPressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(client)/bookings" as Parameters<typeof router.push>[0]);
            }}
            style={styles.ctaPrimary}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.white} />
            <Text style={styles.ctaPrimaryText}>Voir mes réservations</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => {
              router.replace("/(client)" as Parameters<typeof router.replace>[0]);
            }}
            style={styles.ctaGhost}
          >
            <Text style={styles.ctaGhostText}>Retour à l'accueil</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
  },

  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.foreground,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.mutedForeground,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    ...Shadows.card,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 13, color: Colors.mutedForeground, fontWeight: "500", flex: 1 },
  rowValue: { fontSize: 14, color: Colors.foreground, fontWeight: "700", textAlign: "right", flex: 1 },

  ctas: { width: "100%", gap: 12 },
  ctaPrimary: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaPrimaryText: { fontSize: 15, fontWeight: "700", color: Colors.white },
  ctaGhost: { height: 48, alignItems: "center", justifyContent: "center" },
  ctaGhostText: { fontSize: 14, fontWeight: "600", color: Colors.mutedForeground },
});
