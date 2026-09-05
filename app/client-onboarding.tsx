/**
 * #34 — Onboarding client nails (refonte design). Route top-level.
 * 5 étapes, skippable à tout moment. Cf. docs/DESIGN_34_client-onboarding-refonte.md.
 *
 *   1 Bienvenue → 2 Préférences + ville → 3 Recommandations → 4 CTA → 5 Features
 *
 * Entrée : router.replace("/client-onboarding?from=signup") après l'inscription,
 * ou "?from=settings" pour une reprise manuelle.
 *
 * Design : surfaces "fluid glass" (expo-blur), dégradés de marque, transitions
 * Reanimated, haptique sur chaque tap, support dark mode via useThemeColors.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
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

const tap = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) =>
  Haptics.impactAsync(style).catch(() => {});

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

  // onboarding_started + reprise éventuelle à la bonne étape
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
    tap();
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

  // ── Dégradé de fond, teinté marque en clair, profond en sombre ──────────
  const gradient: [string, string, string] = isDark
    ? [colors.background, "#141013", colors.background]
    : ["#FFF1F6", colors.background, "#FFE1EC"];

  // ── Header : progression segmentée dans une pilule "glass" + skip ───────
  const Header = () => (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BlurView
          intensity={isDark ? 30 : 40}
          tint={isDark ? "dark" : "light"}
          style={{
            flexDirection: "row",
            gap: 5,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: withAlpha(colors.foreground, isDark ? 0.1 : 0.06),
          }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={{
                width: s === step ? 20 : 7,
                height: 7,
                borderRadius: 999,
                backgroundColor:
                  s <= step ? colors.primary : withAlpha(colors.foreground, 0.14),
              }}
            />
          ))}
        </BlurView>

        <Pressable onPress={doSkip} hitSlop={12}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>
            {fromSettings ? "Fermer" : WELCOME.skip}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  // ── Footer collant "glass" pour les CTA principaux ──────────────────────
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={gradient} style={{ position: "absolute", inset: 0 }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <Header />

        {/* ── 1. Bienvenue ───────────────────────────────────────────── */}
        {step === STEP.WELCOME && (
          <>
            <Animated.View
              entering={FadeInDown.duration(500)}
              style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center" }}
            >
              <View
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(colors.primary, isDark ? 0.16 : 0.1),
                  marginBottom: 28,
                  ...Shadows.soft,
                }}
              >
                <Text style={{ fontSize: 44 }}>💅</Text>
              </View>

              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {WELCOME.eyebrow}
              </Text>

              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts.serif,
                  fontSize: 30,
                  lineHeight: 38,
                }}
              >
                {WELCOME.title}
              </Text>

              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 15,
                  lineHeight: 23,
                  marginTop: 14,
                }}
              >
                {WELCOME.body}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 22,
                }}
              >
                <Ionicons name="sparkles" size={15} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                  {WELCOME.socialProof}{" "}
                  <Text style={{ color: colors.mutedForeground, fontWeight: "400" }}>
                    {WELCOME.socialProofSuffix}
                  </Text>
                </Text>
              </View>
            </Animated.View>

            <StickyFooter>
              <LoadingButton loading={false} onPress={goPreferences} label={WELCOME.cta} />
            </StickyFooter>
          </>
        )}

        {/* ── 2. Préférences + localisation ──────────────────────────── */}
        {step === STEP.PREFERENCES && (
          <>
            <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts.serif,
                    fontSize: 25,
                    lineHeight: 32,
                  }}
                >
                  Quel style tu préfères ?
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
                  Ça nous aide à te présenter les bonnes pros.
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                    marginTop: 22,
                  }}
                >
                  {NAIL_STYLE_OPTIONS.map((opt, i) => {
                    const selected = style === opt.value;
                    return (
                      <Animated.View
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
                              <Animated.View entering={FadeIn.duration(150)}>
                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                              </Animated.View>
                            )}
                          </View>
                          <Text
                            style={{
                              color: colors.foreground,
                              fontSize: 14,
                              fontWeight: "600",
                            }}
                          >
                            {opt.label}
                          </Text>
                        </AnimatedPressable>
                      </Animated.View>
                    );
                  })}
                </View>

                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 15,
                    fontWeight: "700",
                    marginTop: 28,
                  }}
                >
                  Où cherches-tu une pro ?
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
                    style={{
                      flex: 1,
                      paddingVertical: 15,
                      fontSize: 15,
                      color: colors.foreground,
                    }}
                  />
                </View>
              </ScrollView>
            </Animated.View>

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

        {/* ── 3. Recommandations ────────────────────────────────────── */}
        {step === STEP.RECOMMENDATIONS && (
          <>
            <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: Fonts.serif,
                    fontSize: 25,
                    lineHeight: 32,
                  }}
                >
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
                    <Animated.View key={r.pro_id} entering={FadeInDown.delay(i * 80).duration(400)}>
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
                          <Text
                            style={{
                              color: colors.foreground,
                              fontSize: 17,
                              fontWeight: "700",
                            }}
                          >
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
                              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                                {r.city}
                              </Text>
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
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 999,
                                  backgroundColor: colors.primary,
                                }}
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
                    </Animated.View>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>

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

        {/* ── 4. CTA premier RDV ────────────────────────────────────── */}
        {step === STEP.CTA && (
          <>
            <Animated.View
              entering={FadeInDown.duration(500)}
              style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center" }}
            >
              <View
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(colors.primary, isDark ? 0.16 : 0.1),
                  marginBottom: 28,
                  ...Shadows.soft,
                }}
              >
                <Text style={{ fontSize: 44 }}>📅</Text>
              </View>

              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: Fonts.serif,
                  fontSize: 28,
                  lineHeight: 36,
                }}
              >
                Prête pour ton premier RDV ?
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 15,
                  lineHeight: 23,
                  marginTop: 14,
                }}
              >
                {topStyle
                  ? `${topStyle.name} a de la place. Réserve ton créneau en quelques taps, 24/7.`
                  : "Choisis une pro et réserve ton créneau en quelques taps, 24/7."}
              </Text>
            </Animated.View>

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

        {/* ── 5. Carousel features ──────────────────────────────────── */}
        {step === STEP.FEATURES && (
          <>
            <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }} exiting={FadeOut}>
              <ScrollView
                ref={featureScroll}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  if (idx !== featureSlide) {
                    Haptics.selectionAsync().catch(() => {});
                    setFeatureSlide(idx);
                  }
                }}
              >
                {FEATURE_SLIDES.map((slide) => {
                  const tint = colors[slide.tint];
                  return (
                    <View
                      key={slide.title}
                      style={{ width, paddingHorizontal: 28, justifyContent: "center" }}
                    >
                      <View
                        style={{
                          width: 104,
                          height: 104,
                          borderRadius: 32,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: withAlpha(tint, isDark ? 0.16 : 0.1),
                          marginBottom: 28,
                          ...Shadows.soft,
                        }}
                      >
                        <Text style={{ fontSize: 50 }}>{slide.emoji}</Text>
                      </View>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: Fonts.serif,
                          fontSize: 27,
                          lineHeight: 34,
                        }}
                      >
                        {slide.title}
                      </Text>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 15,
                          lineHeight: 23,
                          marginTop: 14,
                        }}
                      >
                        {slide.body}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </Animated.View>

            <StickyFooter>
              <View style={{ flexDirection: "row", gap: 7, justifyContent: "center", marginBottom: 16 }}>
                {FEATURE_SLIDES.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === featureSlide ? 22 : 7,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor:
                        i === featureSlide ? colors.primary : withAlpha(colors.foreground, 0.15),
                    }}
                  />
                ))}
              </View>
              <LoadingButton
                loading={false}
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
                label={featureSlide < FEATURE_SLIDES.length - 1 ? "Suivant" : "Commencer à explorer"}
              />
            </StickyFooter>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
