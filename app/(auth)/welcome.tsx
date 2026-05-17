import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Animated,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const FEATURES = [
  {
    icon: "flash-outline" as const,
    title: "Réservations en un clic",
    subtitle: "Gestion simplifiée de ton agenda",
    iconBg: "#FFF0F5",
    iconColor: "#FE5D9D",
  },
  {
    icon: "heart-outline" as const,
    title: "Clients fidèles",
    subtitle: "Historique et préférences sauvegardés",
    iconBg: "#F0FFF4",
    iconColor: "#10B981",
  },
  {
    icon: "shield-checkmark-outline" as const,
    title: "Paiements sécurisés",
    subtitle: "Conformité PCI-DSS garantie",
    iconBg: "#EFF6FF",
    iconColor: "#3B82F6",
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.inner,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* 1 + 2. Logo Blyss */}
          <Image
            source={require("@/assets/logo.png")}
            style={{ width: 160, height: 160 }}
            resizeMode="contain"
          />

          {/* 3. Tagline */}
          <Text style={styles.tagline}>Beauté. Business. Sérénité.</Text>

          {/* 4. Description */}
          <Text style={styles.description}>
            La plateforme tout-en-un pour gérer{"\n"}
            ton salon de nail art comme une pro
          </Text>

          {/* 5. Feature cards */}
          <View style={styles.featuresContainer}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={[styles.featureIconWrap, { backgroundColor: f.iconBg }]}>
                  <Ionicons name={f.icon} size={22} color={f.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 6. CTA primary */}
          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>Commencer gratuitement →</Text>
          </Pressable>

          {/* 7. Secondary button */}
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>J'ai déjà un compte →</Text>
          </Pressable>

          {/* 8. Footer légal */}
          <Text style={styles.footer}>
            {"En continuant, tu acceptes nos "}
            <Text style={styles.footerLink}>Conditions générales</Text>
            {" et notre "}
            <Text style={styles.footerLink}>Politique de confidentialité</Text>
            {"\n"}
            <Text style={styles.footerLink}>Mentions légales</Text>
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF0F5",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: "center",
  },
  inner: {
    width: "100%",
    alignItems: "center",
  },
  tagline: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FE5D9D",
    textAlign: "center",
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  featuresContainer: {
    marginTop: 32,
    gap: 12,
    width: "100%",
  },
  featureCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  featureSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  ctaButton: {
    marginTop: 40,
    backgroundColor: "#FE5D9D",
    borderRadius: 999,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
  },
  secondaryText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 16,
  },
  footer: {
    marginTop: 24,
    marginBottom: 32,
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  footerLink: {
    textDecorationLine: "underline",
    color: "#6B7280",
  },
});
