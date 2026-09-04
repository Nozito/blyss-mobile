/**
 * #34 — Onboarding client nails. Route top-level (comme pro-onboarding).
 * 5 étapes, skippable à tout moment. Cf. docs/DESIGN_34_client-onboarding.md.
 *
 *   1 Bienvenue → 2 Préférences + ville → 3 Recommandations → 4 CTA → 5 Features
 *
 * Entrée : router.replace("/client-onboarding?from=signup") après l'inscription,
 * ou "?from=settings" pour une reprise manuelle.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput, ActivityIndicator, Image, Pressable } from "react-native";
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
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";

const STYLE_LABEL = Object.fromEntries(NAIL_STYLE_OPTIONS.map((o) => [o.value, o.label]));

export default function ClientOnboardingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const posthog = usePostHog();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromSettings = params.from === "settings";

  const [step, setStep] = useState<number>(STEP.WELCOME);
  const [style, setStyle] = useState<NailStyle | null>(null);
  const [city, setCity] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [recos, setRecos] = useState<OnboardingRecommendation[] | null>(null);
  const [loadingRecos, setLoadingRecos] = useState(false);
  const [featureSlide, setFeatureSlide] = useState(0);

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

  const goPreferences = () => setStep(STEP.PREFERENCES);

  const submitPreferences = async () => {
    if (!style) return;
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track("onboarding_cta_tapped", { pro_id: r.pro_id, position, from });
    clientOnboardingApi.tapCta().catch(() => {});
    router.push(`/specialist/${r.pro_id}` as never);
  };

  const finish = async () => {
    track("onboarding_completed", { steps_seen: STEP.FEATURES });
    await clientOnboardingApi.complete().catch(() => {});
    leave();
  };

  const topStyle = useMemo(() => recos?.[0] ?? null, [recos]);

  // ── Header commun : progression + skip ──────────────────────────────────
  const Header = () => (
    <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
      <View className="flex-row gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <View
            key={s}
            style={{
              width: 22,
              height: 4,
              borderRadius: 2,
              backgroundColor: s <= step ? colors.primary : withAlpha(colors.foreground, 0.12),
            }}
          />
        ))}
      </View>
      <Pressable onPress={doSkip} hitSlop={12}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>
          {fromSettings ? "Fermer" : "Plus tard"}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <Header />

      {/* ── 1. Bienvenue ─────────────────────────────────────────────── */}
      {step === STEP.WELCOME && (
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>💅</Text>
          <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800", lineHeight: 32 }}>
            {WELCOME.title}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22, marginTop: 12 }}>
            {WELCOME.body}
          </Text>
          <View style={{ marginTop: 32 }}>
            <LoadingButton loading={false} onPress={goPreferences} label={WELCOME.cta} />
          </View>
        </View>
      )}

      {/* ── 2. Préférences + localisation ───────────────────────────── */}
      {step === STEP.PREFERENCES && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>
            Quel style tu préfères ?
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 6 }}>
            Ça nous aide à te présenter les bonnes pros.
          </Text>

          <View style={{ gap: 10, marginTop: 20 }}>
            {NAIL_STYLE_OPTIONS.map((opt) => {
              const selected = style === opt.value;
              return (
                <AnimatedPressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setStyle(opt.value);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? withAlpha(colors.primary, 0.08) : colors.card,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
                    {opt.label}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </AnimatedPressable>
              );
            })}
          </View>

          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginTop: 26 }}>
            Où cherches-tu une pro ?
          </Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Ville ou code postal"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            autoCorrect={false}
            style={{
              marginTop: 8,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 13,
              fontSize: 15,
              color: colors.foreground,
              backgroundColor: colors.card,
            }}
          />

          <View style={{ marginTop: 24 }}>
            <LoadingButton
              loading={savingPrefs}
              onPress={submitPreferences}
              label="Continuer"
              disabled={!style}
            />
          </View>
        </ScrollView>
      )}

      {/* ── 3. Recommandations ──────────────────────────────────────── */}
      {step === STEP.RECOMMENDATIONS && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>
            {style ? `Nos pros ${STYLE_LABEL[style]?.toLowerCase() ?? ""} pour toi` : "Nos pros pour toi"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 6 }}>
            {city.trim() ? `Autour de ${city.trim()}` : "Sélectionnées selon leurs avis et leur activité"}
          </Text>

          {loadingRecos && (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {!loadingRecos && recos && recos.length === 0 && (
            <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 24 }}>
              Aucune pro trouvée pour l'instant. Tu peux explorer toutes les pros depuis l'accueil.
            </Text>
          )}

          <View style={{ gap: 14, marginTop: 20 }}>
            {recos?.map((r, i) => (
              <AnimatedPressable
                key={r.pro_id}
                onPress={() => openPro(r, i + 1, "reco_card")}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  overflow: "hidden",
                }}
              >
                {r.banner_photo || r.profile_photo ? (
                  <Image
                    source={{ uri: r.banner_photo ?? r.profile_photo ?? undefined }}
                    style={{ width: "100%", height: 96 }}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={{ padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ flex: 1, color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
                      {r.name}
                    </Text>
                    {r.matches_style && (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 999,
                          backgroundColor: withAlpha(colors.primary, 0.12),
                        }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                          Pour ton style
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {r.reviews_count > 0 && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                        ★ {r.rating.toFixed(1)} · {r.reviews_count} avis
                      </Text>
                    )}
                    {r.city && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{r.city}</Text>
                    )}
                  </View>
                  {r.open_slots.this_week > 0 ? (
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                      {r.open_slots.today > 0
                        ? `${r.open_slots.today} créneau${r.open_slots.today > 1 ? "x" : ""} aujourd'hui`
                        : `${r.open_slots.this_week} créneau${r.open_slots.this_week > 1 ? "x" : ""} cette semaine`}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                      Voir les disponibilités
                    </Text>
                  )}
                </View>
              </AnimatedPressable>
            ))}
          </View>

          {!loadingRecos && (
            <View style={{ marginTop: 24 }}>
              <LoadingButton
                loading={false}
                onPress={() => setStep(STEP.CTA)}
                label="Continuer"
                variant="ghost"
              />
            </View>
          )}
        </ScrollView>
      )}

      {/* ── 4. CTA premier RDV ──────────────────────────────────────── */}
      {step === STEP.CTA && (
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📅</Text>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800", lineHeight: 30 }}>
            Prête pour ton premier RDV ?
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22, marginTop: 12 }}>
            {topStyle
              ? `${topStyle.name} a de la place. Réserve ton créneau en quelques taps.`
              : "Choisis une pro et réserve ton créneau en quelques taps."}
          </Text>
          <View style={{ marginTop: 32, gap: 10 }}>
            {topStyle && (
              <LoadingButton
                loading={false}
                onPress={() => openPro(topStyle, 1, "cta_screen")}
                label={`Prendre RDV avec ${topStyle.name}`}
              />
            )}
            <LoadingButton
              loading={false}
              onPress={() => setStep(STEP.FEATURES)}
              label="Voir ce que Blyss propose"
              variant="ghost"
            />
          </View>
        </View>
      )}

      {/* ── 5. Carousel features ────────────────────────────────────── */}
      {step === STEP.FEATURES && (
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
          <Text style={{ fontSize: 44, marginBottom: 20 }}>{FEATURE_SLIDES[featureSlide].emoji}</Text>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800", lineHeight: 30 }}>
            {FEATURE_SLIDES[featureSlide].title}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22, marginTop: 12 }}>
            {FEATURE_SLIDES[featureSlide].body}
          </Text>

          <View style={{ flexDirection: "row", gap: 6, marginTop: 24 }}>
            {FEATURE_SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: i === featureSlide ? colors.primary : withAlpha(colors.foreground, 0.15),
                }}
              />
            ))}
          </View>

          <View style={{ marginTop: 32 }}>
            <LoadingButton
              loading={false}
              onPress={() => {
                if (featureSlide < FEATURE_SLIDES.length - 1) setFeatureSlide((s) => s + 1);
                else finish();
              }}
              label={featureSlide < FEATURE_SLIDES.length - 1 ? "Suivant" : "Commencer à explorer"}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
