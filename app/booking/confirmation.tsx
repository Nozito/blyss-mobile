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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useToast } from "@/components/ui/Toast";
import { addAppointmentToCalendar } from "@/lib/appleCalendarSync";
import { messagesApi } from "@/lib/api";

// ─── Screen ───────────────────────────────────────────────────────────────────
// Direction "moment chaleureux" (3 propositions soumises à l'user, 2026-09-11) :
// halo rose derrière le check, carte à lignes iconées, bouton pilule.

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
    paymentMethod?: "online" | "on_site";
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

  // Lignes iconées de la carte — regroupe date+heure, et met le montant sur
  // la même ligne que la prestation (comme un ticket, sans en avoir l'air).
  const dateTimeValue = [params.date, params.time].filter(Boolean).join(" · ");
  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; trailing?: { label: string; value: string } }[] = [];
  if (params.specialistName) {
    rows.push({ icon: "person-outline", label: "Spécialiste", value: params.specialistName });
  }
  if (dateTimeValue) {
    rows.push({ icon: "calendar-outline", label: "Rendez-vous", value: dateTimeValue });
  }
  if (params.serviceName) {
    rows.push({
      icon: "pricetag-outline",
      label: "Prestation",
      value: params.serviceName,
      trailing: params.amount
        ? { label: "Acompte", value: `${params.amount} €` }
        : params.paymentMethod === "on_site"
        ? { label: "Paiement", value: "Sur place" }
        : undefined,
    });
  } else if (params.amount) {
    rows.push({ icon: "card-outline", label: "Acompte payé", value: `${params.amount} €` });
  }
  if (params.confirmationCode) {
    rows.push({ icon: "receipt-outline", label: "Référence", value: params.confirmationCode });
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.primaryLight, colors.background, colors.background]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Halo + check */}
          <Animated.View
            style={[
              styles.glowRing,
              { backgroundColor: withAlpha(colors.primary, 0.16) },
              { transform: [{ scale: scaleAnim }], opacity: opacAnim },
            ]}
          >
            <View style={[styles.checkCircle, { backgroundColor: colors.card, shadowColor: colors.primary }]}>
              <Ionicons name="checkmark" size={34} color={colors.primary} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={{ opacity: opacAnim, transform: [{ translateY: slideAnim }], alignItems: "center" }}
          >
            <Text style={[styles.title, { color: colors.foreground }]}>Réservation confirmée</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {params.specialistName ? `${params.specialistName} te recevra` : "Tu recevras"} une confirmation et un rappel avant ton rendez‑vous.
            </Text>
          </Animated.View>

          {/* Detail card */}
          {rows.length > 0 && (
            <Animated.View
              style={[styles.card, { backgroundColor: colors.card }, { opacity: opacAnim, transform: [{ translateY: slideAnim }] }]}
            >
              {rows.map((row, i) => (
                <View key={row.label}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <View style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name={row.icon} size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                      <Text style={[styles.rowValue, { color: colors.foreground }]} numberOfLines={1}>{row.value}</Text>
                    </View>
                    {row.trailing && (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.rowLabel, { color: colors.mutedForeground, textAlign: "right" }]}>{row.trailing.label}</Text>
                        <Text style={[styles.rowValue, { color: colors.primary, textAlign: "right" }]}>{row.trailing.value}</Text>
                      </View>
                    )}
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
                style={[styles.ctaSecondary, { backgroundColor: colors.primaryLight }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.ctaSecondaryText, { color: colors.primary }]}>
                  {addingToCalendar ? "Ajout en cours…" : "Ajouter à mon calendrier"}
                </Text>
              </AnimatedPressable>
            )}

            {!!params.proId && (
              <AnimatedPressable
                onPress={handleContactPro}
                disabled={openingThread}
                style={[styles.ctaSecondary, { backgroundColor: colors.primaryLight }]}
              >
                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                <Text style={[styles.ctaSecondaryText, { color: colors.primary }]}>
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
    </View>
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

  glowRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },

  card: {
    borderRadius: 22,
    padding: 18,
    width: "100%",
    ...Shadows.card,
  },
  divider: { height: 1, marginVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  rowValue: { fontSize: 14, fontWeight: "700" },

  ctas: { width: "100%", gap: 10 },
  ctaPrimary: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaPrimaryText: { fontSize: 15, fontWeight: "700" },
  ctaSecondary: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: "700" },
  ctaGhost: { height: 48, alignItems: "center", justifyContent: "center" },
  ctaGhostText: { fontSize: 14, fontWeight: "600" },
});
