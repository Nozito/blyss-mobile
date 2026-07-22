import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Category = "agenda" | "clientes" | "paiement" | "compte";

interface FAQItem {
  category: Category;
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  { category: "agenda", question: "Comment créer des créneaux disponibles ?", answer: "Depuis l'onglet Agenda, sélectionne un jour et appuie sur + pour ajouter un créneau. Tu peux définir l'heure de début et de fin." },
  { category: "agenda", question: "Comment bloquer des indisponibilités ?", answer: "Dans l'onglet Agenda, appuie sur « Bloquer un créneau » pour marquer une plage horaire comme indisponible. Tes clientes ne pourront pas réserver à ces horaires." },
  { category: "agenda", question: "Comment gérer mes réservations ?", answer: "Toutes les réservations sont visibles dans l'onglet Agenda, classées par date. Tu peux confirmer, modifier ou annuler chaque réservation." },
  { category: "clientes", question: "Comment voir mes clientes ?", answer: "L'onglet Clientes liste toutes les personnes qui ont réservé avec toi. Tu peux voir leur historique et leurs informations de contact." },
  { category: "clientes", question: "Comment contacter une cliente ?", answer: "Depuis la fiche d'une cliente, tu peux l'appeler ou lui envoyer un email directement depuis l'application." },
  { category: "paiement", question: "Comment activer les paiements en ligne ?", answer: "Depuis l'onglet Paramètres > Paiements, connecte ton compte Stripe pour accepter les paiements en ligne lors des réservations." },
  { category: "paiement", question: "Quand reçois-je mes virements ?", answer: "Les virements sont effectués automatiquement sous 2 jours ouvrés après chaque paiement reçu, sur le compte bancaire renseigné dans tes paramètres." },
  { category: "paiement", question: "Comment voir mes revenus ?", answer: "L'onglet Finance affiche ton chiffre d'affaires, les paiements reçus et un graphique hebdomadaire de ton activité." },
  { category: "compte", question: "Comment modifier mon profil public ?", answer: "Depuis l'onglet Profil > Profil public, tu peux modifier ton nom d'activité, ta bio, ta ville et tes conditions de réservation." },
  { category: "compte", question: "Comment gérer mon abonnement ?", answer: "Depuis l'onglet Profil > Abonnement, tu peux voir ton plan actuel, le modifier ou l'annuler." },
  { category: "compte", question: "Comment supprimer mon compte ?", answer: "Depuis les Paramètres > Mes données personnelles, tu peux demander la suppression définitive de ton compte." },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "clientes", label: "Clientes" },
  { id: "paiement", label: "Paiements" },
  { id: "compte", label: "Compte" },
];

export default function ProHelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<Category>("agenda");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [contentOpacity]);

  const filteredFaqs = faqs.filter((f) => f.category === activeCategory);

  return (
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center mb-2">
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            className="w-10 h-10 rounded-xl bg-muted items-center justify-center mr-3"
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <Text className="text-2xl font-bold text-foreground">Aide & support</Text>
        </View>
        <Text className="text-sm text-muted-foreground ml-1">
          Tout ce qu'il faut savoir pour bien gérer ton activité
        </Text>
      </View>

      {/* Intro card */}
      <View
        className="bg-card rounded-2xl p-4 mb-4 flex-row items-center gap-3 border border-border"
        style={{ shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
      >
        <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: `${Colors.primary}18` }}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">Une question sur ton espace pro ?</Text>
          <Text className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Consulte les FAQs ou contacte directement notre équipe.
          </Text>
        </View>
      </View>

      {/* Category pills */}
      <View className="mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveCategory(cat.id);
                setOpenIndex(null);
              }}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: activeCategory === cat.id ? Colors.primary : Colors.muted }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: activeCategory === cat.id ? Colors.white : Colors.mutedForeground }}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* FAQ items */}
      <View className="gap-3 mb-4">
        {filteredFaqs.map((faq, idx) => {
          const globalIdx = faqs.indexOf(faq);
          const isOpen = openIndex === globalIdx;
          return (
            <View
              key={globalIdx}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setOpenIndex(isOpen ? null : globalIdx);
                }}
                className="bg-card rounded-2xl p-4 border border-border"
                style={{ shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-sm font-semibold text-foreground flex-1">{faq.question}</Text>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={Colors.mutedForeground}
                  />
                </View>
                {isOpen && (
                  <Text className="text-xs text-muted-foreground mt-3 leading-relaxed">
                    {faq.answer}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Contact */}
      <View className="gap-3">
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            Linking.openURL("mailto:pro@blyssapp.fr");
          }}
          className="rounded-2xl p-4 flex-row items-center justify-between"
          style={{ backgroundColor: Colors.primary }}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="mail-outline" size={18} color={Colors.white} />
            <View>
              <Text className="text-sm font-semibold text-white">Écrire au support Pro</Text>
              <Text className="text-xs text-white/80">Réponse sous 24h ouvrées.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.white} />
        </AnimatedPressable>
      </View>
    </ScrollView>
    </Animated.View>
  );
}
