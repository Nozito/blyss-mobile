import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Colors } from "@/constants/colors";

const { width: SCREEN_W } = Dimensions.get("window");

type PlanId = "start" | "serenite" | "signature";

const PLAN_LABELS: Record<PlanId, string> = {
  start: "Start",
  serenite: "Sérénité",
  signature: "Signature",
};

const PLAN_NEW_FEATURES: Record<PlanId, string[]> = {
  start: ["Réservation en ligne 24h/24", "Agenda intelligent", "Notifications clientes auto", "Tableau de bord activité"],
  serenite: ["Module finance & facturation", "Statistiques avancées", "Portfolio photos intégré", "Rappels automatiques"],
  signature: ["Visibilité premium dans les résultats", "Rappels post-prestation", "Encaissement en ligne Stripe"],
};

const SLIDES = [
  {
    id: "agenda",
    icon: "calendar-outline" as const,
    title: "Gestion d'agenda",
    description: "Créez vos créneaux et laissez vos clientes réserver en ligne. Fini les messages pour caler un RDV.",
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  {
    id: "clientes",
    icon: "people-outline" as const,
    title: "Base clientes",
    description: "Toutes vos clientes au même endroit : coordonnées, historique et notes privées en un tap.",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    id: "finance",
    icon: "bar-chart-outline" as const,
    title: "Module Finance",
    description: "Pilotez votre activité : CA en temps réel, objectif mensuel, factures et prestations les plus rentables.",
    color: "#10B981",
    bg: "#ECFDF5",
  },
  {
    id: "portfolio",
    icon: "camera-outline" as const,
    title: "Portfolio professionnel",
    description: "Valorisez vos réalisations avec un portfolio photo pour attirer de nouvelles clientes.",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  {
    id: "paiement",
    icon: "card-outline" as const,
    title: "Encaissement en ligne",
    description: "Vos clientes paient directement depuis l'app au moment de la réservation. Zéro impayé.",
    color: "#EC4899",
    bg: "#FDF2F8",
  },
];

function SlideCard({ slide, active }: { slide: typeof SLIDES[0]; active: boolean }) {
  return (
    <View style={[{ width: SCREEN_W - 40, borderRadius: 24, backgroundColor: slide.bg, padding: 24 }]} className="overflow-hidden">
      <View
        className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
        style={{ backgroundColor: slide.color }}
      >
        <Ionicons name={slide.icon} size={28} color={Colors.white} />
      </View>

      {/* Mock bento UI */}
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.8)" }}>
          <Text className="text-xs font-bold" style={{ color: slide.color }}>Prochain RDV</Text>
          <Text className="text-lg font-black text-foreground mt-1">14h00</Text>
          <Text className="text-xs text-muted-foreground">Sophie M.</Text>
        </View>
        <View className="gap-2" style={{ flex: 0.6 }}>
          <View className="rounded-xl p-2.5" style={{ backgroundColor: "rgba(255,255,255,0.8)", flex: 1 }}>
            <Text className="text-xs text-muted-foreground">Aujourd'hui</Text>
            <Text className="text-base font-black" style={{ color: slide.color }}>3</Text>
          </View>
          <View className="rounded-xl p-2.5" style={{ backgroundColor: "rgba(255,255,255,0.8)", flex: 1 }}>
            <Text className="text-xs text-muted-foreground">Ce mois</Text>
            <Text className="text-base font-black text-foreground">1248€</Text>
          </View>
        </View>
      </View>

      <Text className="text-base font-black text-foreground mb-1">{slide.title}</Text>
      <Text className="text-sm text-muted-foreground leading-relaxed">{slide.description}</Text>
    </View>
  );
}

export default function ProSubscriptionSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ plan?: string; isUpgrade?: string; previousPlan?: string }>();

  const plan = (params.plan ?? "start") as PlanId;
  const isUpgrade = params.isUpgrade === "true";
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const progressAnim = useSharedValue(0);

  useEffect(() => {
    if (!showOnboarding) return;
    progressAnim.value = 0;
    progressAnim.value = withTiming(1, { duration: 7000 });
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev < SLIDES.length - 1 ? prev + 1 : prev));
    }, 7000);
    return () => clearInterval(id);
  }, [showOnboarding, currentSlide]);

  const newFeatures = PLAN_NEW_FEATURES[plan] ?? [];
  const isLast = currentSlide === SLIDES.length - 1;

  // ── UPGRADE flow ─────────────────────────────────────────────────────────────
  if (isUpgrade) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} className="items-center w-full">
          {/* Icon */}
          <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: "#ECFDF5" }}>
            <Ionicons name="checkmark-circle-outline" size={36} color="#22C55E" />
          </View>

          <Text className="text-3xl font-black text-foreground mb-2 text-center">Formule mise à jour !</Text>
          <Text className="text-sm text-muted-foreground text-center leading-relaxed mb-8">
            Tu as maintenant accès à toutes les fonctionnalités de la formule{" "}
            <Text className="font-semibold text-foreground">{PLAN_LABELS[plan]}</Text>.
          </Text>

          {/* Features */}
          {newFeatures.length > 0 && (
            <View
              className="w-full bg-card rounded-2xl p-5 mb-8 border border-border"
              style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
            >
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                Ce que tu gagnes
              </Text>
              <View className="gap-3">
                {newFeatures.map((f, i) => (
                  <Animated.View
                    key={i}
                    entering={FadeInDown.duration(250).delay(i * 80).springify()}
                    className="flex-row items-center gap-3"
                  >
                    <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: "#ECFDF5" }}>
                      <Ionicons name="checkmark" size={13} color="#22C55E" />
                    </View>
                    <Text className="text-sm font-medium text-foreground flex-1">{f}</Text>
                  </Animated.View>
                ))}
              </View>
            </View>
          )}

          <View className="w-full gap-3">
            <Pressable
              onPress={() => router.push("/(pro)/dashboard")}
              className="h-14 rounded-2xl items-center justify-center flex-row gap-2"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="sparkles-outline" size={20} color={Colors.white} />
              <Text className="text-white font-bold text-base">Accéder au dashboard</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(pro)/subscription-settings" as any)}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text className="text-sm font-medium text-muted-foreground">Gérer mon abonnement</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    );
  }

  // ── FIRST TIME confirmation ───────────────────────────────────────────────────
  if (!showOnboarding) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          {/* Badge */}
          <View className="items-center mb-6">
            <View
              className="flex-row items-center gap-2 px-4 py-2 rounded-full mb-4"
              style={{ backgroundColor: `${Colors.primary}15`, borderWidth: 1, borderColor: `${Colors.primary}30` }}
            >
              <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
              <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: Colors.primary }}>
                Compte Pro Activé
              </Text>
            </View>

            <Text className="text-3xl font-black text-foreground text-center mb-3">
              Félicitations ! 🎉{"\n"}
              <Text style={{ color: Colors.primary }}>Votre espace pro est prêt</Text>
            </Text>
            <Text className="text-base text-muted-foreground text-center leading-relaxed">
              Vous avez maintenant accès à tous les outils pour développer votre activité.
            </Text>
          </View>

          {/* Feature grid */}
          <View className="flex-row gap-3 mb-6">
            {[
              { icon: "calendar-outline" as const, label: "Agenda illimité", color: Colors.primary },
              { icon: "trending-up-outline" as const, label: "Analytics pro", color: Colors.secondary },
              { icon: "flash-outline" as const, label: "Sans limite", color: "#10B981" },
            ].map(({ icon, label, color }, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.duration(250).delay(i * 80).springify()}
                className="flex-1 bg-card rounded-2xl p-4 items-center gap-2 border border-border"
              >
                <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                  <Ionicons name={icon} size={20} color={color} />
                </View>
                <Text className="text-xs font-semibold text-foreground text-center">{label}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Plan card */}
          <Animated.View
            entering={FadeInDown.duration(300).delay(200).springify()}
            className="bg-card rounded-2xl p-5 mb-6 border-2"
            style={{ borderColor: `${Colors.primary}20` }}
          >
            <View className="flex-row items-center gap-3 mb-4 pb-4 border-b border-border">
              <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: `${Colors.primary}15` }}>
                <Ionicons name="sparkles-outline" size={24} color={Colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-0.5">Votre formule</Text>
                <Text className="text-lg font-bold text-foreground">{PLAN_LABELS[plan]}</Text>
              </View>
              <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" }}>
                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#22C55E" }} />
                <Text className="text-xs font-bold" style={{ color: "#15803D" }}>Actif</Text>
              </View>
            </View>
            {[["Accès aux fonctionnalités", "Complet"], ["Support prioritaire", "Inclus"], ["Mises à jour", "Auto"]].map(([k, v]) => (
              <View key={k} className="flex-row items-center justify-between py-1">
                <Text className="text-sm text-muted-foreground">{k}</Text>
                <Text className="text-sm font-semibold text-foreground">{v}</Text>
              </View>
            ))}
          </Animated.View>

          {/* CTA */}
          <View className="gap-3">
            <Pressable
              onPress={() => setShowOnboarding(true)}
              className="h-14 rounded-2xl items-center justify-center flex-row gap-2"
              style={{ backgroundColor: Colors.primary }}
            >
              <Text className="text-white font-bold text-base">Découvrir mon espace pro</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(pro)/dashboard")}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text className="text-sm font-medium text-muted-foreground">Accéder directement à l'espace</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    );
  }

  // ── ONBOARDING slides ─────────────────────────────────────────────────────────
  const slide = SLIDES[currentSlide];

  return (
    <View className="flex-1" style={{ backgroundColor: slide.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View className="flex-row items-center justify-between">
          {/* Progress dots */}
          <View className="flex-row items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <View
                key={i}
                className="h-1.5 rounded-full"
                style={{
                  width: i === currentSlide ? 20 : 6,
                  backgroundColor: i <= currentSlide ? "#00000040" : "#00000018",
                }}
              />
            ))}
          </View>
          <Pressable onPress={() => router.push("/(pro)/dashboard")}>
            <Text className="text-sm font-semibold" style={{ color: "#00000050" }}>Passer</Text>
          </Pressable>
        </View>
      </View>

      {/* Slide content */}
      <View className="flex-1 items-center justify-center px-5">
        <SlideCard slide={slide} active />
      </View>

      {/* Footer */}
      <View style={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 20, gap: 16 }}>
        <View className="flex-row gap-2.5">
          {currentSlide > 0 && (
            <Pressable
              onPress={() => setCurrentSlide((p) => p - 1)}
              className="px-5 py-3.5 rounded-2xl items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
            >
              <Text className="text-sm font-semibold text-foreground">Retour</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => isLast ? router.push("/(pro)/dashboard") : setCurrentSlide((p) => p + 1)}
            className="flex-1 py-4 rounded-2xl items-center justify-center flex-row gap-2"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="text-white font-bold text-base">{isLast ? "Commencer" : "Suivant"}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </Pressable>
        </View>

        {/* Dot indicators */}
        <View className="flex-row items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setCurrentSlide(i)}
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === currentSlide ? "#00000040" : "#00000020",
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
