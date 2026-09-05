/**
 * #34 — Onboarding client nails (passe 3b « poster editorial »). Route top-level.
 * 7 étapes, skippable à tout moment. Cf. docs/DESIGN_34_client-onboarding-refonte.md.
 *
 *   1 Bienvenue → 2 Comment ça marche → 3 Préférences (style multi + ville)
 *   → 4 Recos (+ ♥ favori) → 5 Notifications → 6 Comment tu as connu Blyss
 *   → 7 CTA premier RDV (dernier — pour ne pas perdre 5/6 si la cliente part réserver)
 *
 * Système : zéro emoji ; titres fontWeight 900 capitales (SF Pro Black, aucune
 * police embarquée) ; 3 fonds pleins issus de la palette (rose / cream / prune
 * #3D1F2C) ; header = numéro géant + « Plus tard » ; boutons pilule 1 ligne ;
 * ruban à rayures rose × prune qui balaie entre chaque écran. Dark mode via
 * useThemeColors. Le ♥ favori réutilise favoritesApi (table favorites).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
  Animated as RNAnimated,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  clientOnboardingApi,
  favoritesApi,
  type NailStyle,
  type OnboardingRecommendation,
} from "@/lib/api";
import {
  NAIL_STYLE_OPTIONS,
  ATTRIBUTION_OPTIONS,
  WELCOME,
  HOW_IT_WORKS,
  NOTIF,
  STEP,
  STEP_COUNT,
} from "@/lib/clientOnboardingContent";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";

/** Encres fixes utilisées sur les champs de couleur assumés (rose, prune). */
const INK = "#1A0710";
const CREAM = "#F6E9EE";
const PRUNE = "#3D1F2C";

const STYLE_LABEL = Object.fromEntries(NAIL_STYLE_OPTIONS.map((o) => [o.value, o.label]));

const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
  Haptics.impactAsync(style).catch(() => {});

const pad2 = (n: number) => String(n).padStart(2, "0");

const scarcityLabel = (s: { today: number; this_week: number }) =>
  s.today > 0
    ? `${s.today} créneau${s.today > 1 ? "x" : ""} · aujourd'hui`
    : `${s.this_week} créneau${s.this_week > 1 ? "x" : ""} · cette semaine`;

/** Bouton pilule pleine largeur — libellé sur une ligne. */
function PillButton({
  label,
  onPress,
  bg,
  fg,
  loading,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  fg: string;
  loading?: boolean;
}) {
  const scale = useRef(new RNAnimated.Value(1)).current;
  return (
    <RNAnimated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={loading}
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

/** Fond de chaque écran : un token de la palette, texte encre ou cream. */
function useField(step: number, colors: ReturnType<typeof useThemeColors>) {
  return useMemo(() => {
    switch (step) {
      case STEP.WELCOME:
      case STEP.CTA:
        return { bg: colors.primary, ink: INK, pill: { bg: INK, fg: CREAM } };
      case STEP.HOW_IT_WORKS:
      case STEP.NOTIFICATIONS:
        return { bg: PRUNE, ink: CREAM, pill: { bg: CREAM, fg: PRUNE } };
      default:
        return { bg: colors.cream, ink: colors.foreground, pill: { bg: colors.foreground, fg: colors.background } };
    }
  }, [step, colors]);
}

export default function ClientOnboardingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const posthog = usePostHog();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromSettings = params.from === "settings";
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<number>(STEP.WELCOME);
  const [styles, setStyles] = useState<NailStyle[]>([]);
  const [city, setCity] = useState("");
  const [cityFocused, setCityFocused] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [recos, setRecos] = useState<OnboardingRecommendation[] | null>(null);
  const [loadingRecos, setLoadingRecos] = useState(false);
  const [followed, setFollowed] = useState<Set<number>>(new Set());
  const [attribution, setAttribution] = useState<string | null>(null);
  const notifFrom = useRef<"onboarding" | "empty_state">("onboarding");

  const field = useField(step, colors);
  const ink = field.ink;

  // ── Ruban de transition (largeur 2×écran, sort complètement à gauche) ──
  const ribbonX = useSharedValue(1.1);
  const ribbonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ribbonX.value * width }, { skewX: "-9deg" }],
  }));

  const go = useCallback(
    (next: number) => {
      if (reduceMotion) {
        setStep(next);
        return;
      }
      ribbonX.value = withTiming(-0.5, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (!finished) return;
        runOnJS(setStep)(next);
        runOnJS(tap)(Haptics.ImpactFeedbackStyle.Light);
        ribbonX.value = withTiming(-2.2, { duration: 320, easing: Easing.out(Easing.cubic) });
      });
    },
    [reduceMotion, ribbonX]
  );

  // ── Filet de progression ─────────────────────────────────────────────
  const progress = useSharedValue(step / STEP_COUNT);
  useEffect(() => {
    progress.value = withTiming(step / STEP_COUNT, { duration: 400 });
  }, [step, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const track = useCallback(
    (event: string, props?: Record<string, string | number | boolean | null | string[] | number[]>) => {
      posthog?.capture(event, props as Record<string, unknown> as never);
    },
    [posthog]
  );

  useEffect(() => {
    track(fromSettings ? "onboarding_resumed" : "onboarding_started", { source: params.from ?? "signup" });
    clientOnboardingApi
      .getStatus()
      .then((res) => {
        if (res.success && res.data) {
          if (res.data.styles?.length) setStyles(res.data.styles);
          else if (res.data.style_nails) setStyles([res.data.style_nails]);
          if (res.data.city) setCity(res.data.city);
          if (res.data.acquisition_source) setAttribution(res.data.acquisition_source);
          if (fromSettings && res.data.current_step > 1 && !res.data.completed) {
            setStep(Math.min(res.data.current_step, STEP_COUNT));
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === STEP.NOTIFICATIONS) track("onboarding_notif_prompted", { from: notifFrom.current });
  }, [step, track]);

  // Géocodage de la ville / du code postal pour l'aperçu carte + la reco régionale.
  useEffect(() => {
    const q = city.trim();
    if (q.length < 2) {
      setCoords(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [hit] = await Location.geocodeAsync(q);
        if (!cancelled && hit) setCoords({ latitude: hit.latitude, longitude: hit.longitude });
      } catch {
        if (!cancelled) setCoords(null);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [city]);

  const leave = useCallback(() => {
    router.replace("/(client)" as never);
  }, [router]);

  const doSkip = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    track("onboarding_skipped", { at_step: step });
    clientOnboardingApi.skip().catch(() => {});
    leave();
  }, [step, track, leave]);

  const finish = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    track("onboarding_completed", { steps_seen: STEP_COUNT });
    clientOnboardingApi.complete().catch(() => {});
    leave();
  }, [track, leave]);

  const onHeaderSkip = () => {
    if (step === STEP.CTA) finish();
    else if (step === STEP.ATTRIBUTION) go(STEP.CTA);
    else doSkip();
  };
  const skipLabel = fromSettings ? "Fermer" : step === STEP.ATTRIBUTION ? "Passer" : "Plus tard";

  const submitPreferences = async () => {
    if (styles.length === 0) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setSavingPrefs(true);
    const res = await clientOnboardingApi.setPreferences(styles, city.trim() || undefined);
    setSavingPrefs(false);
    if (!res.success) {
      showToast(res.error ?? "Impossible d'enregistrer", "error");
      return;
    }
    track("onboarding_preferences_selected", {
      styles,
      styles_count: styles.length,
      has_location: !!city.trim(),
      location: city.trim() || null,
    });
    go(STEP.RECOMMENDATIONS);
    loadRecos();
  };

  const loadRecos = async () => {
    setLoadingRecos(true);
    const res = await clientOnboardingApi.getRecommendations({
      city: city.trim() || undefined,
      lat: coords?.latitude,
      lng: coords?.longitude,
    });
    setLoadingRecos(false);
    const list = res.success && res.data ? res.data.recommendations : [];
    setRecos(list);
    track("onboarding_recommendations_viewed", {
      styles,
      style_filter_active: (res.success && res.data?.style_filter_active) || false,
      results_count: list.length,
      empty: list.length === 0,
      pro_ids: list.map((r) => r.pro_id),
      had_scarcity: list.some((r) => r.open_slots.this_week > 0),
    });
  };

  const openPro = (r: OnboardingRecommendation, position: number, from: "reco_card" | "cta_screen") => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    track("onboarding_cta_tapped", { pro_id: r.pro_id, position, from });
    clientOnboardingApi.tapCta().catch(() => {});
    // Depuis le CTA (dernier écran), la cliente termine l'onboarding en partant réserver.
    if (from === "cta_screen") clientOnboardingApi.complete().catch(() => {});
    router.push(`/specialist/${r.pro_id}` as never);
  };

  const toggleFollow = (r: OnboardingRecommendation, position: number) => {
    Haptics.selectionAsync().catch(() => {});
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(r.pro_id)) {
        next.delete(r.pro_id);
        favoritesApi.remove(r.pro_id).catch(() => {});
      } else {
        next.add(r.pro_id);
        favoritesApi.add(r.pro_id).catch(() => {});
        track("onboarding_pro_followed", { pro_id: r.pro_id, position });
      }
      return next;
    });
  };

  const enableNotifs = async () => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    let result = "denied";
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      result = status === "granted" ? "granted" : "denied";
    } catch {
      result = "error";
    }
    track("onboarding_notif_result", { result });
    go(STEP.ATTRIBUTION);
  };

  const skipNotifs = () => {
    track("onboarding_notif_result", { result: "later" });
    go(STEP.ATTRIBUTION);
  };

  const pickAttribution = (source: string) => {
    tap();
    setAttribution(source);
    clientOnboardingApi.setAttribution(source).catch(() => {});
    track("onboarding_attribution", { source });
  };

  const topStyle = useMemo(() => recos?.[0] ?? null, [recos]);
  const isEmpty = !loadingRecos && recos !== null && recos.length === 0;

  const Header = (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ color: ink, fontWeight: "900", fontSize: 30, letterSpacing: -1.5 }}>{pad2(step)}</Text>
        <Pressable onPress={onHeaderSkip} hitSlop={12} style={{ marginTop: 8 }}>
          <Text
            style={{
              color: ink,
              opacity: 0.62,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {skipLabel}
          </Text>
        </Pressable>
      </View>
      <View
        style={{ height: 2, marginTop: 10, borderRadius: 2, backgroundColor: withAlpha(ink, 0.18), overflow: "hidden" }}
      >
        <Reanimated.View style={[{ height: 2, borderRadius: 2, backgroundColor: ink }, progressStyle]} />
      </View>
    </View>
  );

  const Footer = ({ children }: { children: React.ReactNode }) => (
    <View style={{ paddingHorizontal: 22, paddingBottom: 10, paddingTop: 8 }}>{children}</View>
  );

  const Chip = ({
    label,
    selected,
    onPress,
    sub,
    width: w,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    sub?: string;
    width: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        width: w as never,
        borderRadius: 12,
        borderWidth: 1.5,
        paddingVertical: 11,
        paddingHorizontal: 11,
        borderColor: selected ? colors.primary : withAlpha(ink, 0.18),
        backgroundColor: selected ? colors.primary : withAlpha(ink, 0.04),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{
            color: selected ? INK : ink,
            fontSize: 11.5,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.2,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {selected && <Ionicons name="checkmark-circle" size={16} color={INK} />}
      </View>
      {sub ? (
        <Text
          style={{
            color: selected ? withAlpha(INK, 0.6) : withAlpha(ink, 0.4),
            fontSize: 8.5,
            letterSpacing: 1,
            marginTop: 2,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: field.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {Header}

        <Reanimated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(180)} style={{ flex: 1 }}>
          {/* ── 1. Bienvenue ─────────────────────────────────────────── */}
          {step === STEP.WELCOME && (
            <>
              <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                <Text style={{ color: ink, fontWeight: "900", fontSize: 44, lineHeight: 44, letterSpacing: -1.2, textTransform: "uppercase" }}>
                  {WELCOME.title}
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
                    {WELCOME.sticker}
                  </Text>
                </View>
                <Text style={{ color: ink, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 22, maxWidth: 320 }}>
                  {WELCOME.body}
                </Text>
                <Text style={{ color: ink, opacity: 0.72, fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 18 }}>
                  {WELCOME.socialProof}
                </Text>
              </View>
              <Footer>
                <PillButton label={`${WELCOME.cta} →`} onPress={() => go(STEP.HOW_IT_WORKS)} bg={field.pill.bg} fg={field.pill.fg} />
              </Footer>
            </>
          )}

          {/* ── 2. Comment ça marche ─────────────────────────────────── */}
          {step === STEP.HOW_IT_WORKS && (
            <>
              <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>
                  {HOW_IT_WORKS.eyebrow}
                </Text>
                <Text style={{ color: ink, fontWeight: "900", fontSize: 34, lineHeight: 34, letterSpacing: -1, textTransform: "uppercase" }}>
                  {HOW_IT_WORKS.title}
                </Text>
                <View style={{ marginTop: 24, gap: 14 }}>
                  {HOW_IT_WORKS.steps.map((s, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "baseline" }}>
                      <Text style={{ color: ink, opacity: 0.45, fontWeight: "900", fontSize: 20 }}>{i + 1}</Text>
                      <Text style={{ color: ink, fontSize: 14, lineHeight: 20, flex: 1 }}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Footer>
                <PillButton label={`${HOW_IT_WORKS.cta} →`} onPress={() => go(STEP.PREFERENCES)} bg={field.pill.bg} fg={field.pill.fg} />
              </Footer>
            </>
          )}

          {/* ── 3. Préférences (style multi + ville) ──────────────────── */}
          {step === STEP.PREFERENCES && (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: ink, fontWeight: "900", fontSize: 24, lineHeight: 25, letterSpacing: -0.5, textTransform: "uppercase" }}>
                  Dis-nous ce que tu aimes
                </Text>
                <Text style={{ color: ink, opacity: 0.72, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 16 }}>
                  Le style — plusieurs choix possibles
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {NAIL_STYLE_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      sub={o.code}
                      width="48%"
                      selected={styles.includes(o.value)}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setStyles((prev) =>
                          prev.includes(o.value) ? prev.filter((v) => v !== o.value) : [...prev, o.value]
                        );
                      }}
                    />
                  ))}
                </View>

                <Text style={{ color: ink, opacity: 0.72, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 22 }}>
                  Où cherches-tu ?
                </Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => setCityFocused(false)}
                  placeholder="Ville / code postal"
                  placeholderTextColor={withAlpha(ink, 0.4)}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={{
                    marginTop: 8,
                    borderBottomWidth: 1.5,
                    borderBottomColor: cityFocused ? colors.primary : withAlpha(ink, 0.25),
                    paddingVertical: 9,
                    fontSize: 14,
                    color: ink,
                  }}
                />

                {coords && (
                  <View
                    style={{
                      marginTop: 14,
                      height: 148,
                      borderRadius: 16,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: withAlpha(ink, 0.12),
                    }}
                  >
                    <MapView
                      provider={PROVIDER_DEFAULT}
                      style={{ flex: 1 }}
                      pointerEvents="none"
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      region={{ ...coords, latitudeDelta: 0.09, longitudeDelta: 0.09 }}
                    >
                      <Marker coordinate={coords} pinColor={colors.primary} />
                    </MapView>
                    <View
                      style={{
                        position: "absolute",
                        left: 10,
                        bottom: 10,
                        backgroundColor: withAlpha(INK, 0.82),
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: CREAM, fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" }}>
                        {city.trim()}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
              <Footer>
                <PillButton
                  label="Continuer →"
                  onPress={submitPreferences}
                  bg={styles.length ? field.pill.bg : withAlpha(ink, 0.25)}
                  fg={field.pill.fg}
                  loading={savingPrefs}
                />
              </Footer>
            </>
          )}

          {/* ── 4. Recos (+ ♥ favori) / état vide ─────────────────────── */}
          {step === STEP.RECOMMENDATIONS && (
            <>
              {isEmpty ? (
                <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                  <Text style={{ color: ink, fontWeight: "900", fontSize: 26, lineHeight: 27, letterSpacing: -0.5, textTransform: "uppercase" }}>
                    {city.trim() ? `Pas encore de pro à ${city.trim()}` : "Pas encore de pro par ici"}
                  </Text>
                  <Text style={{ color: ink, opacity: 0.7, fontSize: 13, lineHeight: 19, marginTop: 12 }}>
                    On agrandit le réseau chaque semaine.
                  </Text>
                  <View style={{ alignSelf: "flex-start", marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ color: INK, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>
                      On te prévient dès qu'une pro ouvre près de toi
                    </Text>
                  </View>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={{ color: ink, fontWeight: "900", fontSize: 24, lineHeight: 25, letterSpacing: -0.5, textTransform: "uppercase" }}>
                    Notre sélection pour toi
                  </Text>
                  <Text style={{ color: ink, opacity: 0.6, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 6 }}>
                    {city.trim() ? `Autour de ${city.trim()} · ` : ""}
                    {styles[0] ? `${STYLE_LABEL[styles[0]] ?? ""} · ` : ""}
                    {recos?.length ?? 0} pro{(recos?.length ?? 0) > 1 ? "s" : ""}
                  </Text>

                  {loadingRecos && (
                    <View style={{ paddingVertical: 44, alignItems: "center" }}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )}

                  <View style={{ marginTop: 14 }}>
                    {recos?.map((r, i) => {
                      const isFollowed = followed.has(r.pro_id);
                      return (
                        <View
                          key={r.pro_id}
                          style={{ flexDirection: "row", gap: 11, paddingVertical: 12, borderTopWidth: 1, borderTopColor: withAlpha(ink, 0.15) }}
                        >
                          <Pressable onPress={() => openPro(r, i + 1, "reco_card")} style={{ flexDirection: "row", gap: 11, flex: 1 }}>
                            <Image
                              source={{ uri: r.banner_photo ?? r.profile_photo ?? undefined }}
                              style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: withAlpha(ink, 0.2), backgroundColor: withAlpha(ink, 0.06) }}
                              contentFit="cover"
                              transition={150}
                            />
                            <View style={{ flex: 1 }}>
                              {r.matches_style && (
                                <Text style={{ color: colors.primary, fontSize: 9, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
                                  ✦ Pour ton style
                                </Text>
                              )}
                              <Text numberOfLines={1} style={{ color: ink, fontSize: 16, fontWeight: "900", letterSpacing: -0.3, textTransform: "uppercase" }}>
                                {r.name}
                              </Text>
                              <Text style={{ color: withAlpha(ink, 0.6), fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase", marginTop: 3 }}>
                                {r.reviews_count > 0 ? `★ ${r.rating.toFixed(1)} · ${r.reviews_count} avis` : "Nouvelle sur Blyss"}
                                {r.city ? ` · ${r.city}` : ""}
                                {r.distance_km != null ? ` · ${Math.round(r.distance_km)} km` : ""}
                              </Text>
                              {r.open_slots.this_week > 0 ? (
                                <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: colors.primary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 }}>
                                  <Text style={{ color: INK, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>
                                    {scarcityLabel(r.open_slots)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                          <Pressable
                            onPress={() => toggleFollow(r, i + 1)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={isFollowed ? `Retirer ${r.name} des favoris` : `Ajouter ${r.name} aux favoris`}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 999,
                              borderWidth: 1.5,
                              alignItems: "center",
                              justifyContent: "center",
                              borderColor: isFollowed ? colors.primary : withAlpha(ink, 0.25),
                              backgroundColor: isFollowed ? colors.primary : "transparent",
                            }}
                          >
                            <Ionicons name={isFollowed ? "heart" : "heart-outline"} size={15} color={isFollowed ? INK : withAlpha(ink, 0.5)} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
              <Footer>
                {isEmpty ? (
                  <View style={{ gap: 8 }}>
                    <PillButton
                      label="Préviens-moi →"
                      onPress={() => {
                        notifFrom.current = "empty_state";
                        go(STEP.NOTIFICATIONS);
                      }}
                      bg={field.pill.bg}
                      fg={field.pill.fg}
                    />
                    <Pressable onPress={leave} style={{ alignItems: "center", paddingVertical: 6 }}>
                      <Text style={{ color: ink, opacity: 0.6, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
                        Explorer les autres villes
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <PillButton
                    label="Continuer →"
                    onPress={() => go(STEP.NOTIFICATIONS)}
                    bg={field.pill.bg}
                    fg={field.pill.fg}
                    loading={loadingRecos}
                  />
                )}
              </Footer>
            </>
          )}

          {/* ── 5. Notifications ─────────────────────────────────────── */}
          {step === STEP.NOTIFICATIONS && (
            <>
              <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>
                  {NOTIF.eyebrow}
                </Text>
                <Text style={{ color: ink, fontWeight: "900", fontSize: 32, lineHeight: 33, letterSpacing: -1, textTransform: "uppercase" }}>
                  {NOTIF.title}
                </Text>
                <Text style={{ color: ink, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 16, maxWidth: 320 }}>
                  {NOTIF.body}
                </Text>
              </View>
              <Footer>
                <View style={{ gap: 8 }}>
                  <PillButton label={`${NOTIF.cta} →`} onPress={enableNotifs} bg={field.pill.bg} fg={field.pill.fg} />
                  <Pressable onPress={skipNotifs} style={{ alignItems: "center", paddingVertical: 6 }}>
                    <Text style={{ color: ink, opacity: 0.6, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
                      {NOTIF.later}
                    </Text>
                  </Pressable>
                </View>
              </Footer>
            </>
          )}

          {/* ── 6. Comment tu as connu Blyss ─────────────────────────── */}
          {step === STEP.ATTRIBUTION && (
            <>
              <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                <Text style={{ color: ink, fontWeight: "900", fontSize: 26, lineHeight: 27, letterSpacing: -0.5, textTransform: "uppercase" }}>
                  Comment tu as connu Blyss ?
                </Text>
                <Text style={{ color: ink, opacity: 0.6, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 10 }}>
                  1 choix — ça nous aide, c'est tout
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {ATTRIBUTION_OPTIONS.map((o) => (
                    <Chip key={o.value} label={o.label} width="48%" selected={attribution === o.value} onPress={() => pickAttribution(o.value)} />
                  ))}
                </View>
              </View>
              <Footer>
                <PillButton label="Continuer →" onPress={() => go(STEP.CTA)} bg={field.pill.bg} fg={field.pill.fg} />
              </Footer>
            </>
          )}

          {/* ── 7. CTA premier RDV (dernier) ─────────────────────────── */}
          {step === STEP.CTA && (
            <>
              <View style={{ flex: 1, paddingHorizontal: 22, justifyContent: "center" }}>
                <Text style={{ color: ink, opacity: 0.7, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 14 }}>
                  Réservation 24/7
                </Text>
                <Text style={{ color: ink, fontWeight: "900", fontSize: 38, lineHeight: 38, letterSpacing: -1, textTransform: "uppercase" }}>
                  Premier rendez-vous ?
                </Text>
                <Text style={{ color: ink, opacity: 0.9, fontSize: 14, lineHeight: 21, marginTop: 16, maxWidth: 320 }}>
                  {topStyle
                    ? `${topStyle.name} a de la place. Ton créneau en quelques taps.`
                    : "Choisis une pro et réserve ton créneau en quelques taps."}
                </Text>
              </View>
              <Footer>
                <View style={{ gap: 8 }}>
                  {topStyle && (
                    <PillButton label="Réserver mon RDV →" onPress={() => openPro(topStyle, 1, "cta_screen")} bg={field.pill.bg} fg={field.pill.fg} />
                  )}
                  <Pressable onPress={finish} style={{ alignItems: "center", paddingVertical: 6 }}>
                    <Text style={{ color: ink, opacity: 0.6, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
                      Explorer les pros
                    </Text>
                  </Pressable>
                </View>
              </Footer>
            </>
          )}
        </Reanimated.View>
      </SafeAreaView>

      {/* ── Ruban de transition (au-dessus de tout) ──────────────────── */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: -80, bottom: -80, left: 0, width: width * 2, flexDirection: "row" },
          ribbonStyle,
        ]}
      >
        {Array.from({ length: 22 }).map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? PRUNE : colors.primary }} />
        ))}
      </Reanimated.View>
    </View>
  );
}
