import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useToast } from "@/components/ui/Toast";
import { addAppointmentToCalendar } from "@/lib/appleCalendarSync";
import { messagesApi } from "@/lib/api";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookingConfirmationScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    specialistName?: string;
    serviceName?: string;
    date?: string;
    time?: string;
    amount?: string;
    confirmationCode?: string;
    dateISO?: string;
    durationMinutes?: string;
    proCity?: string;
    proId?: string;
  }>();
  const { showToast } = useToast();
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [openingThread, setOpeningThread] = useState(false);

  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;

  const canAddToCalendar = Platform.OS === "ios" && !!params.dateISO && !!params.time;

  const handleAddToCalendar = async () => {
    if (!params.dateISO || !params.time) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddingToCalendar(true);
    try {
      const startDate = new Date(`${params.dateISO}T${params.time}:00`);
      const duration = params.durationMinutes ? Number(params.durationMinutes) : 60;
      const endDate = new Date(startDate.getTime() + duration * 60_000);
      const title = params.serviceName
        ? `${params.serviceName} — ${params.specialistName ?? "Blyss"}`
        : params.specialistName ?? "Rendez-vous Blyss";

      const result = await addAppointmentToCalendar({
        title,
        startDate,
        endDate,
        location: params.proCity || undefined,
        notes: params.confirmationCode ? `Référence Blyss : ${params.confirmationCode}` : undefined,
      });

      if (result.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Rendez-vous ajouté à ton calendrier", "success");
      } else {
        showToast(result.error ?? "Impossible d'ajouter le rendez-vous au calendrier", "error");
      }
    } finally {
      setAddingToCalendar(false);
    }
  };

  const handleContactPro = async () => {
    if (!params.proId || openingThread) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpeningThread(true);
    const res = await messagesApi.openThread(Number(params.proId));
    setOpeningThread(false);
    if (res.success && res.data) {
      router.push({ pathname: "/message-thread/[id]", params: { id: String(res.data.id) } });
    } else {
      showToast(res.error ?? "Impossible d'ouvrir la conversation", "error");
    }
  };

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
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Animated checkmark */}
        <Animated.View
          style={[
            styles.checkCircle,
            { backgroundColor: colors.success, shadowColor: colors.success },
            { transform: [{ scale: scaleAnim }], opacity: opacAnim },
          ]}
        >
          <Ionicons name="checkmark" size={52} color={colors.onColor} />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{ opacity: opacAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>Réservation confirmée !</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Tu recevras une confirmation et un rappel avant ton rendez-vous.
          </Text>
        </Animated.View>

        {/* Detail card */}
        {details.length > 0 && (
          <Animated.View
            style={[styles.card, { backgroundColor: colors.card }, { opacity: opacAnim, transform: [{ translateY: slideAnim }] }]}
          >
            {details.map((d, i) => (
              <View key={d.label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{d.label}</Text>
                  <Text style={[styles.rowValue, { color: colors.foreground }]}>{d.value}</Text>
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
            style={[styles.ctaPrimary, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.onColor} />
            <Text style={[styles.ctaPrimaryText, { color: colors.onColor }]}>Voir mes réservations</Text>
          </AnimatedPressable>

          {canAddToCalendar && (
            <AnimatedPressable
              onPress={handleAddToCalendar}
              disabled={addingToCalendar}
              style={[styles.ctaSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.foreground} />
              <Text style={[styles.ctaSecondaryText, { color: colors.foreground }]}>
                {addingToCalendar ? "Ajout en cours…" : "Ajouter à mon calendrier"}
              </Text>
            </AnimatedPressable>
          )}

          {!!params.proId && (
            <AnimatedPressable
              onPress={handleContactPro}
              disabled={openingThread}
              style={[styles.ctaSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.foreground} />
              <Text style={[styles.ctaSecondaryText, { color: colors.foreground }]}>
                {openingThread ? "Ouverture…" : `Écrire à ${params.specialistName ?? "la pro"}`}
              </Text>
            </AnimatedPressable>
          )}

          <AnimatedPressable
            onPress={() => {
              router.replace("/(client)" as Parameters<typeof router.replace>[0]);
            }}
            style={styles.ctaGhost}
          >
            <Text style={[styles.ctaGhostText, { color: colors.mutedForeground }]}>Retour à l'accueil</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },

  card: {
    borderRadius: 20,
    padding: 20,
    width: "100%",
    ...Shadows.card,
  },
  divider: { height: 1, marginVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 13, fontWeight: "500", flex: 1 },
  rowValue: { fontSize: 14, fontWeight: "700", textAlign: "right", flex: 1 },

  ctas: { width: "100%", gap: 12 },
  ctaPrimary: {
    height: 56,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaPrimaryText: { fontSize: 15, fontWeight: "700" },
  ctaSecondary: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: "600" },
  ctaGhost: { height: 48, alignItems: "center", justifyContent: "center" },
  ctaGhostText: { fontSize: 14, fontWeight: "600" },
});
