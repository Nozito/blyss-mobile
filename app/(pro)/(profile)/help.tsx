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
import { Shadows } from "@/constants/shadows";
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
  { category: "paiement", question: "Comment activer les paiements en ligne ?", answer: "Depuis Profil > Encaissements, connecte ton compte Stripe pour accepter les paiements en ligne lors des réservations." },
  { category: "paiement", question: "Quand reçois-je mes virements ?", answer: "Les virements sont effectués automatiquement sous 2 jours ouvrés après chaque paiement reçu, sur le compte bancaire renseigné dans Stripe." },
  { category: "paiement", question: "Comment voir mes revenus ?", answer: "L'onglet Finance affiche ton chiffre d'affaires, les paiements reçus et un graphique hebdomadaire de ton activité." },
  { category: "compte", question: "Comment modifier mon profil public ?", answer: "Depuis l'onglet Profil > Profil public, tu peux modifier ton nom d'activité, ta bio, ta ville et tes conditions de réservation." },
  { category: "compte", question: "Comment gérer mon abonnement ?", answer: "Depuis l'onglet Profil > Abonnement, tu peux voir ton plan actuel, le modifier ou l'annuler." },
  { category: "compte", question: "Comment supprimer mon compte ?", answer: "Depuis Profil > Mes données personnelles, tu peux demander la suppression définitive de ton compte." },
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
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <AnimatedIconButton
          onPress={() => safeBack(router)}
          accessibilityLabel="Retour"
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </AnimatedIconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground }}>Aide & support</Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>Tout pour bien gérer ton activité</Text>
        </View>
      </View>

      {/* Intro card */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: Colors.white, borderRadius: 20, padding: 16,
        marginBottom: 16, ...Shadows.card,
      }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${Colors.primary}18`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>Une question sur ton espace pro ?</Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2, lineHeight: 15 }}>
            Consulte les FAQs ou contacte directement notre équipe.
          </Text>
        </View>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setActiveCategory(cat.id);
                setOpenIndex(null);
              }}
              style={{
                paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
                backgroundColor: active ? Colors.primary : Colors.white,
                borderWidth: 1, borderColor: active ? Colors.primary : Colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? Colors.white : Colors.mutedForeground }}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* FAQ items */}
      <View style={{ gap: 10, marginBottom: 16 }}>
        {filteredFaqs.map((faq) => {
          const globalIdx = faqs.indexOf(faq);
          const isOpen = openIndex === globalIdx;
          return (
            <Pressable
              key={globalIdx}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setOpenIndex(isOpen ? null : globalIdx);
              }}
              style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground, flex: 1 }}>{faq.question}</Text>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={Colors.mutedForeground} />
              </View>
              {isOpen && (
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 10, lineHeight: 18 }}>
                  {faq.answer}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Contact */}
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          Linking.openURL("mailto:pro@blyssapp.fr");
        }}
        style={{
          borderRadius: 16, padding: 16, flexDirection: "row",
          alignItems: "center", justifyContent: "space-between",
          backgroundColor: Colors.primary,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons name="mail-outline" size={18} color={Colors.white} />
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.white }}>Écrire au support Pro</Text>
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 1 }}>Réponse sous 24h ouvrées.</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.white} />
      </AnimatedPressable>
    </ScrollView>
    </Animated.View>
  );
}
