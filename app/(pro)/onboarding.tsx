import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";

const STORAGE_KEY = "pro_onboarding_done";

const SLIDES = [
  {
    icon: "calendar-outline" as const,
    title: "Ton agenda pro",
    description:
      "Crée tes créneaux, accepte les réservations en ligne. Fini les allers-retours par messages.",
    color: Colors.primary,
    bg: "#FFF0F5",
  },
  {
    icon: "people-outline" as const,
    title: "Tes clientes",
    description:
      "Retrouve l'historique de chaque cliente, ses préférences et tes notes en un seul endroit.",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    icon: "card-outline" as const,
    title: "Tes encaissements",
    description:
      "Suis ton chiffre d'affaires en temps réel et envoie tes factures en un tap.",
    color: "#10B981",
    bg: "#ECFDF5",
  },
];

export default function ProOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [ready, setReady] = useState(false);

  // Si déjà vu → skip direct vers le dashboard
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((done) => {
      if (done === "true") {
        router.replace("/(pro)/dashboard");
      } else {
        setReady(true);
      }
    });
  }, []);

  const isLast = currentSlide === SLIDES.length - 1;
  const slide = SLIDES[currentSlide];

  const handleNext = async () => {
    if (!isLast) {
      setCurrentSlide((p) => p + 1);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
      router.replace("/(pro)/dashboard");
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "true");
    router.replace("/(pro)/dashboard");
  };

  if (!ready) return null;

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      {/* Skip */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: `${slide.color}80` }]}>Passer</Text>
        </Pressable>
      </View>

      {/* Slide content */}
      <View style={styles.slideContent}>
        <View style={[styles.iconWrap, { backgroundColor: `${slide.color}18` }]}>
          <Ionicons name={slide.icon} size={52} color={slide.color} />
        </View>
        <Text style={[styles.title, { color: Colors.foreground }]}>{slide.title}</Text>
        <Text style={[styles.description, { color: Colors.mutedForeground }]}>
          {slide.description}
        </Text>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setCurrentSlide(i)}
              hitSlop={8}
            >
              <View
                style={[
                  styles.dot,
                  {
                    width: i === currentSlide ? 22 : 7,
                    backgroundColor:
                      i === currentSlide ? slide.color : `${slide.color}35`,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleNext}
          style={[
            styles.cta,
            {
              backgroundColor: slide.color,
              shadowColor: slide.color,
            },
          ]}
        >
          <Text style={styles.ctaText}>
            {isLast ? "C'est parti !" : "Suivant"}
          </Text>
          <Ionicons
            name={isLast ? "rocket-outline" : "arrow-forward"}
            size={20}
            color="#fff"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 20,
  },
  iconWrap: {
    width: 108,
    height: 108,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  cta: {
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
  },
});
