/**
 * #34 — Onboarding client nails (refonte design « B ancré »). Route top-level.
 * 5 étapes, skippable à tout moment. Cf. docs/DESIGN_34_client-onboarding-refonte.md.
 *
 *   1 Bienvenue → 2 Préférences + ville → 3 Recommandations → 4 CTA → 5 Features
 *
 * Parti pris : voix affirmée sur les écrans bornes (1 & 5) — champ de couleur
 * plein cadre, display lourd capitales, bouton pilule noir (accent réservé à
 * l'onboarding). Écrans 2-4 sobres et alignés sur les primitives de l'app
 * (cartes arrondies, LoadingButton, Playfair). Rose de marque partout, aucune
 * couleur neuve. Support dark mode via useThemeColors.
 *
 * Entrée : router.replace("/client-onboarding?from=signup") après l'inscription,
 * ou "?from=settings" pour une reprise manuelle.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
  Animated,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type TextStyle,
} from "react-native";
import Reanimated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  clientOnboardingApi,
  type NailStyle,
  type OnboardingRecommendation,
} from "@/lib/api";
import {
  NAIL_STYLE_OPTIONS,
  WELCOME,
  FEATURE_SLIDES,
  STEP,
} from "@/lib/clientOnboardingContent";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Shadows } from "@/constants/shadows";

const STYLE_LABEL = Object.fromEntries(NAIL_STYLE_OPTIONS.map((o) => [o.value, o.label]));

/** Encre foncée réutilisée sur les champs de couleur (rose / doré). */
const INK_DARK = "#1A0710";

const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
  Haptics.impactAsync(style).catch(() => {});

/** Titre "display" — SF Pro Black sur iOS, sans police embarquée. */
const display = (size: number): TextStyle => ({
  fontWeight: "900",
  fontSize: size,
  lineHeight: size * 1.02,
  letterSpacing: -size * 0.02,
  textTransform: "uppercase",
});

/** Bouton pilule plein — accent visuel réservé aux écrans bornes. */
function PillButton({
  label,
  onPress,
  bg,
  fg,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  fg: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: fg,
            fontSize: 15,
            fontWeight: "800",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ClientOnboardingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const { showToast } = useToast();
  const posthog = usePostHog();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromSettings = params.from === "settings";
  const { width } = useWindowDimensions();

  const [step, setStep] = useState<number>(STEP.WELCOME);
  const [style, setStyle] = useState<NailStyle | null>(null);
  const [city, setCity] = useState("");
  const [cityFocused, setCityFocused] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [recos, setRecos] = useState<OnboardingRecommendation[] | null>(null);
  const [loadingRecos, setLoadingRecos] = useState(false);
  const [featureSlide, setFeatureSlide] = useState(0);
  const featureScroll = useRef<ScrollView>(null);

  const track = useCallback(
    (event: string, props?: Record<string, string | number | boolean | null | number[]>) => {
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
          if (res.data.style_nails) setStyle(res.data.style_nails);
          if (fromSettings && res.data.current_step > 1 && !res.data.completed) {
            setStep(Math.min(res.data.current_step, STEP.FEATURES));
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = useCallback(() => {
    router.replace("/(client)" as never);
  }, [router]);

  const doSkip = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    track("onboarding_skipped", { at_step: step });
    clientOnboardingApi.skip().catch(() => {});
    leave();
  }, [step, track, leave]);

  const goPreferences = () => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setStep(STEP.PREFERENCES);
  };

  const submitPreferences = async () => {
    if (!style) return;
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setSavingPrefs(true);
    const res = await clientOnboardingApi.setPreferences(style, city.trim() || undefined);
    setSavingPrefs(false);
    if (!res.success) {
      showToast(res.error ?? "Impossible d'enregistrer", "error");
      return;
    }
    track("onboarding_preferences_selected", {
      style_nails: style,
      has_location: !!city.trim(),
      location: city.trim() || null,
    });
    setStep(STEP.RECOMMENDATIONS);
    loadRecos();
  };

  const loadRecos = async () => {
    setLoadingRecos(true);
    const res = await clientOnboardingApi.getRecommendations(city.trim() || undefined);
    setLoadingRecos(false);
    const list = res.success && res.data ? res.data.recommendations : [];
    setRecos(list);
    track("onboarding_recommendations_viewed", {
      style_nails: style,
      style_filter_active: (res.success && res.data?.style_filter_active) || false,
      results_count: list.length,
      pro_ids: list.map((r) => r.pro_id),
      had_scarcity: list.some((r) => r.open_slots.this_week > 0),
    });
  };

  const openPro = (r: OnboardingRecommendation, position: number, from: "reco_card" | "cta_screen") => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    track("onboarding_cta_tapped", { pro_id: r.pro_id, position, from });
    clientOnboardingApi.tapCta().catch(() => {});
    router.push(`/specialist/${r.pro_id}` as never);
  };

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    track("onboarding_completed", { steps_seen: STEP.FEATURES });
    await clientOnboardingApi.complete().catch(() => {});
    leave();
  };

  const topStyle = useMemo(() => recos?.[0] ?? null, [recos]);

  const isBoldStep = step === STEP.WELCOME || step === STEP.FEATURES;
  const slide = FEATURE_SLIDES[featureSlide];

  // ── Encre du header selon le fond de l'écran ────────────────────────────
  const headerInk =
    step === STEP.WELCOME
      ? INK_DARK
      : step === STEP.FEATURES
        ? slide.ink === "light"
          ? "#FFFFFF"
          : INK_DARK
        : colors.foreground;
  const headerAccent = step >= STEP.PREFERENCES && step <= STEP.CTA ? colors.primary : headerInk;

  // ── Header : progression segmentée + skip ──────────────────────────────
  const Header = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            flexDirection: "row",
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: withAlpha(headerInk, 0.16),
            backgroundColor: isBoldStep ? withAlpha(headerInk, 0.08) : "transparent",
          }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={{
                width: s === step ? 20 : 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: s <= step ? headerAccent : withAlpha(headerInk, 0.2),
              }}
            />
          ))}
        </View>

        <Pressable onPress={doSkip} hitSlop={12}>
          <Text
            style={{
              color: isBoldStep ? headerInk : colors.mutedForeground,
              fontSize: 13,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              opacity: isBoldStep ? 0.9 : 1,
            }}
          >
            {fromSettings ? "Fermer" : WELCOME.skip}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // ── Footer glass pour les écrans fonctionnels (2-4) ────────────────────
  const StickyFooter = ({ children }: { children: React.ReactNode }) => (
    <BlurView
      intensity={isDark ? 40 : 60}
      tint={isDark ? "dark" : "light"}
      style={{
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: withAlpha(colors.foreground, isDark ? 0.08 : 0.05),
      }}
    >
      {children}
    </BlurView>
  );

  const gradient: [string, string, string] = isDark
    ? [colors.background, "#141013", colors.background]
    : ["#FFF1F6", colors.background, "#FFE1EC"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fond : champ rose plein cadre (1), champ coloré par slide (5), dégradé doux (2-4) */}
      {step === STEP.WELCOME ? (
        <View style={{ position: "absolute", inset: 0, backgroundColor: colors.primary }} />
      ) : step === STEP.FEATURES ? (
        <View
          style={{ position: "absolute", inset: 0, backgroundColor: colors[slide.field] }}
        />
      ) : (
        <LinearGradient colors={gradient} style={{ position: "absolute", inset: 0 }} />
      )}

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <Header />

        {/* ── 1. Bienvenue — hero plein champ rose, voix affirmée ─────── */}
        {step === STEP.WELCOME && (
          <>
            <Reanimated.View
              entering={FadeInDown.duration(500)}
              style={{ flex: 1, paddingHorizontal: 26, justifyContent: "center" }}
            >
              <Text
                style={{
                  color: INK_DARK,
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  opacity: 0.7,
                  marginBottom: 18,
                }}
              >
                {WELCOME.eyebrow}
              </Text>

              <Text style={[display(42), { color: INK_DARK }]}>{WELCOME.title}</Text>

              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: 18,
                  backgroundColor: INK_DARK,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                  transform: [{ rotate: "-3deg" }],
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  ✦ 1 minute chrono
                </Text>
              </View>

              <Text
                style={{
                  color: INK_DARK,
                  fontSize: 15,
                  lineHeight: 22,
                  marginTop: 22,
                  opacity: 0.9,
                  maxWidth: 320,
                }}
              >
                {WELCOME.body}
              </Text>

              <Text
                style={{
                  color: INK_DARK,
                  fontSize: 13,
                  fontWeight: "700",
                  marginTop: 20,
                  opacity: 0.75,
                }}
              >
                {WELCOME.socialProof}
              </Text>
            </Reanimated.View>

            <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 }}>
              <PillButton label={WELCOME.cta} onPress={goPreferences} bg={INK_DARK} fg="#FFFFFF" />
            </View>
          </>
        )}

        {/* ── 2. Préférences + localisation — sobre, aligné app ──────── */}
        {step === STEP.PREFERENCES && (
          <>
            <Reanimated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: colors.foreground, fontFamily: Fonts.serif, fontSize: 25, lineHeight: 32 }}>
                  Quel style tu préfères&nbsp;?
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
                  Ça nous aide à te présenter les bonnes pros.
                </Text>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
                  {NAIL_STYLE_OPTIONS.map((opt, i) => {
                    const selected = style === opt.value;
                    return (
                      <Reanimated.View
                        key={opt.value}
                        entering={FadeInDown.delay(i * 40).duration(350)}
                        style={{ width: "47.5%" }}
                      >
                        <AnimatedPressable
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setStyle(opt.value);
                          }}
                          style={{
                            gap: 8,
                            paddingVertical: 16,
                            paddingHorizontal: 14,
                            borderRadius: 18,
                            borderWidth: 1.5,
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected
                              ? withAlpha(colors.primary, isDark ? 0.14 : 0.08)
                              : colors.card,
                            ...(selected ? Shadows.soft : Shadows.card),
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
                            {selected && (
                              <Reanimated.View entering={FadeIn.duration(150)}>
                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                              </Reanimated.View>
                            )}
                          </View>
                          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                            {opt.label}
                          </Text>
                        </AnimatedPressable>
                      </Reanimated.View>
                    );
                  })}
                </View>

                <Text
                  style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginTop: 28 }}
                >
                  Où cherches-tu une pro&nbsp;?
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 10,
                    borderWidth: 1.5,
                    borderColor: cityFocused ? colors.primary : colors.border,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    backgroundColor: colors.card,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={cityFocused ? colors.primary : colors.mutedForeground}
                  />
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    onFocus={() => setCityFocused(true)}
                    onBlur={() => setCityFocused(false)}
                    placeholder="Ville ou code postal"
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    style={{ flex: 1, paddingVertical: 15, fontSize: 15, color: colors.foreground }}
                  />
                </View>
              </ScrollView>
            </Reanimated.View>

            <StickyFooter>
              <LoadingButton
                loading={savingPrefs}
                onPress={submitPreferences}
                label="Continuer"
                disabled={!style}
              />
            </StickyFooter>
          </>
        )}

        {/* ── 3. Recommandations — sobre, même langage que la fiche pro ─ */}
        {step === STEP.RECOMMENDATIONS && (
          <>
            <Reanimated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ color: colors.foreground, fontFamily: Fonts.serif, fontSize: 25, lineHeight: 32 }}>
                  {style
                    ? `Nos pros ${STYLE_LABEL[style]?.toLowerCase() ?? ""} pour toi`
                    : "Nos pros pour toi"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
                  {city.trim()
                    ? `Autour de ${city.trim()}`
                    : "Sélectionnées selon leurs avis et leur activité"}
                </Text>

                {loadingRecos && (
                  <View style={{ paddingVertical: 48, alignItems: "center" }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}

                {!loadingRecos && recos && recos.length === 0 && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 24 }}>
                    Aucune pro trouvée pour l'instant. Tu peux explorer toutes les pros depuis
                    l'accueil.
                  </Text>
                )}

                <View style={{ gap: 16, marginTop: 22 }}>
                  {recos?.map((r, i) => (
                    <Reanimated.View key={r.pro_id} entering={FadeInDown.delay(i * 80).duration(400)}>
                      <AnimatedPressable
                        onPress={() => openPro(r, i + 1, "reco_card")}
                        style={{
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          overflow: "hidden",
                          ...Shadows.card,
                        }}
                      >
                        {r.banner_photo || r.profile_photo ? (
                          <View>
                            <Image
                              source={{ uri: r.banner_photo ?? r.profile_photo ?? undefined }}
                              style={{ width: "100%", height: 128 }}
                              contentFit="cover"
                              transition={200}
                            />
                            <LinearGradient
                              colors={["transparent", withAlpha("#000000", 0.35)]}
                              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60 }}
                            />
                            {r.matches_style && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 12,
                                  left: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 4,
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 999,
                                  backgroundColor: withAlpha(colors.primary, 0.95),
                                }}
                              >
                                <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                                  Pour ton style
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : null}

                        <View style={{ padding: 16, gap: 8 }}>
                          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>
                            {r.name}
                          </Text>

                          <View
                            style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                          >
                            {r.reviews_count > 0 && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Ionicons name="star" size={13} color="#F5A623" />
                                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                                  {r.rating.toFixed(1)}
                                </Text>
                                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                                  · {r.reviews_count} avis
                                </Text>
                              </View>
                            )}
                            {r.city && (
                              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{r.city}</Text>
                            )}
                          </View>

                          {r.open_slots.this_week > 0 ? (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                alignSelf: "flex-start",
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: withAlpha(colors.primary, isDark ? 0.16 : 0.1),
                              }}
                            >
                              <View
                                style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.primary }}
                              />
                              <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "700" }}>
                                {r.open_slots.today > 0
                                  ? `${r.open_slots.today} créneau${r.open_slots.today > 1 ? "x" : ""} aujourd'hui`
                                  : `${r.open_slots.this_week} créneau${r.open_slots.this_week > 1 ? "x" : ""} cette semaine`}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                              Voir les disponibilités
                            </Text>
                          )}
                        </View>
                      </AnimatedPressable>
                    </Reanimated.View>
                  ))}
                </View>
              </ScrollView>
            </Reanimated.View>

            {!loadingRecos && (
              <StickyFooter>
                <LoadingButton
                  loading={false}
                  onPress={() => {
                    tap();
                    setStep(STEP.CTA);
                  }}
                  label="Continuer"
                />
              </StickyFooter>
            )}
          </>
        )}

        {/* ── 4. CTA premier RDV — sobre + un accent de conversion ────── */}
        {step === STEP.CTA && (
          <>
            <Reanimated.View
              entering={FadeInDown.duration(500)}
              style={{ flex: 1, paddingHorizontal: 26, justifyContent: "center" }}
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: withAlpha(colors.primary, isDark ? 0.18 : 0.12),
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Réservation 24/7
                </Text>
              </View>

              <Text style={{ color: colors.foreground, fontFamily: Fonts.serif, fontSize: 28, lineHeight: 36 }}>
                Prête pour ton premier RDV&nbsp;?
              </Text>
              <Text
                style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 23, marginTop: 14 }}
              >
                {topStyle
                  ? `${topStyle.name} a de la place. Réserve ton créneau en quelques taps.`
                  : "Choisis une pro et réserve ton créneau en quelques taps."}
              </Text>
            </Reanimated.View>

            <StickyFooter>
              <View style={{ gap: 10 }}>
                {topStyle && (
                  <LoadingButton
                    loading={false}
                    onPress={() => openPro(topStyle, 1, "cta_screen")}
                    label={`Prendre RDV avec ${topStyle.name}`}
                  />
                )}
                <LoadingButton
                  loading={false}
                  onPress={() => {
                    tap();
                    setStep(STEP.FEATURES);
                  }}
                  label="Voir ce que Blyss propose"
                  variant="ghost"
                />
              </View>
            </StickyFooter>
          </>
        )}

        {/* ── 5. Carousel features — champs de couleur plein cadre ────── */}
        {step === STEP.FEATURES && (
          <>
            <ScrollView
              ref={featureScroll}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                if (idx !== featureSlide) {
                  Haptics.selectionAsync().catch(() => {});
                  setFeatureSlide(idx);
                }
              }}
            >
              {FEATURE_SLIDES.map((s) => {
                const ink = s.ink === "light" ? "#FFFFFF" : INK_DARK;
                return (
                  <View key={s.title} style={{ width, paddingHorizontal: 26, justifyContent: "center" }}>
                    <Text style={{ fontSize: 52, marginBottom: 24 }}>{s.emoji}</Text>
                    <Text style={[display(38), { color: ink }]}>{s.title}</Text>
                    <Text
                      style={{
                        color: ink,
                        fontSize: 15,
                        lineHeight: 23,
                        marginTop: 16,
                        opacity: 0.9,
                        maxWidth: 320,
                      }}
                    >
                      {s.body}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 }}>
              <View style={{ flexDirection: "row", gap: 7, justifyContent: "center", marginBottom: 16 }}>
                {FEATURE_SLIDES.map((_, i) => {
                  const ink = slide.ink === "light" ? "#FFFFFF" : INK_DARK;
                  return (
                    <View
                      key={i}
                      style={{
                        width: i === featureSlide ? 22 : 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: i === featureSlide ? ink : withAlpha(ink, 0.3),
                      }}
                    />
                  );
                })}
              </View>
              <PillButton
                label={featureSlide < FEATURE_SLIDES.length - 1 ? "Suivant" : "Commencer à explorer"}
                onPress={() => {
                  if (featureSlide < FEATURE_SLIDES.length - 1) {
                    const next = featureSlide + 1;
                    featureScroll.current?.scrollTo({ x: next * width, animated: true });
                    setFeatureSlide(next);
                    tap();
                  } else {
                    finish();
                  }
                }}
                bg={slide.ink === "light" ? "#FFFFFF" : INK_DARK}
                fg={slide.ink === "light" ? INK_DARK : "#FFFFFF"}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
