import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

type Category = "reservations" | "paiement" | "compte" | "divers";

interface FAQItem {
  category: Category;
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  { category: "compte", question: "Comment créer un compte Blyss ?", answer: "Depuis l'écran de connexion, appuie sur « Créer un compte » et suis les étapes : email, mot de passe, puis validation." },
  { category: "compte", question: "J'ai oublié mon mot de passe, que faire ?", answer: "Sur l'écran de connexion, appuie sur « Mot de passe oublié ? » puis saisis ton email pour recevoir un lien de réinitialisation." },
  { category: "reservations", question: "Comment réserver une prestation ?", answer: "Choisis une experte nails, sélectionne la prestation souhaitée, puis un créneau disponible. Valide ta réservation pour recevoir une confirmation." },
  { category: "reservations", question: "Où voir mes réservations à venir ?", answer: "Tes rendez-vous à venir sont visibles dans l'onglet « Réservations », accessible depuis la barre de navigation." },
  { category: "reservations", question: "Comment annuler une réservation ?", answer: "Tu peux annuler depuis le détail du rendez-vous, jusqu'à un certain délai avant l'horaire prévu (selon les conditions de l'experte)." },
  { category: "reservations", question: "Comment modifier l'horaire d'un rendez-vous ?", answer: "Si l'experte l'autorise, tu peux modifier l'horaire depuis le détail du rendez-vous. Sinon, contacte directement l'experte." },
  { category: "reservations", question: "Comment laisser un avis après une prestation ?", answer: "Une fois le rendez-vous terminé, tu recevras une notification pour noter l'experte et laisser un commentaire visible sur son profil." },
  { category: "paiement", question: "Quels sont les moyens de paiement acceptés ?", answer: "Selon les expertes, tu peux payer via Blyss (carte bancaire, Apple Pay, etc.) ou sur place. Les options sont indiquées lors de la réservation." },
  { category: "paiement", question: "Quand suis-je débitée ?", answer: "Le débit peut être effectué à la confirmation ou à la fin de la prestation, en fonction des paramètres de l'experte." },
  { category: "paiement", question: "Comment obtenir une facture ?", answer: "Tu peux télécharger ta facture depuis le détail de la réservation, une fois la prestation effectuée." },
  { category: "divers", question: "Comment contacter une experte avant de réserver ?", answer: "Certaines expertes permettent l'échange de messages avant réservation. Un bouton « Contacter » apparaît sur leur profil." },
  { category: "divers", question: "Que faire si la pro ne se présente pas ?", answer: "Signale le rendez-vous depuis l'écran de détail. L'équipe Blyss reviendra vers toi pour t'aider." },
  { category: "divers", question: "Mes données sont-elles protégées ?", answer: "Tes données personnelles et tes informations de paiement sont chiffrées et traitées conformément à la réglementation." },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "reservations", label: "Réservations" },
  { id: "paiement", label: "Paiement" },
  { id: "compte", label: "Compte" },
  { id: "divers", label: "Autres" },
];

export default function ClientHelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState<Category>("reservations");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredFaqs = faqs.filter((f) => f.category === activeCategory);

  return (
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
          Toutes les réponses pour profiter de Blyss sereinement
        </Text>
      </View>

      {/* Intro card */}
      <View
        className="bg-card rounded-2xl p-4 mb-4 flex-row items-center gap-3 border border-border"
        style={{ shadowColor: Colors.black, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
      >
        <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
          <Ionicons name="help-circle-outline" size={16} color={Colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground">Une question sur Blyss ?</Text>
          <Text className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Parcours les questions fréquentes ou contacte le support si tu ne trouves pas ta réponse.
          </Text>
        </View>
      </View>

      {/* Category pills */}
      <View className="mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => { setActiveCategory(cat.id); setOpenIndex(null); }}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: activeCategory === cat.id ? Colors.primary : Colors.muted,
              }}
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
                onPress={() => setOpenIndex(isOpen ? null : globalIdx)}
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
        <Pressable
          onPress={() => Linking.openURL("mailto:contact@blyssapp.fr")}
          className="rounded-2xl p-4 flex-row items-center justify-between"
          style={{ backgroundColor: Colors.primary }}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="mail-outline" size={18} color={Colors.white} />
            <View>
              <Text className="text-sm font-semibold text-white">Écrire au support Blyss</Text>
              <Text className="text-xs text-white/80">Réponse sous 24h ouvrées.</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.white} />
        </Pressable>

        <View className="flex-row gap-2">
          <View
            className="flex-1 bg-card rounded-xl p-3 flex-row items-center gap-2 border border-border"
          >
            <Ionicons name="chatbubble-outline" size={15} color={Colors.primary} />
            <Text className="text-xs text-muted-foreground">Chat in-app (bientôt)</Text>
          </View>
          <View
            className="flex-1 bg-card rounded-xl p-3 flex-row items-center gap-2 border border-border"
          >
            <Ionicons name="shield-outline" size={15} color={Colors.mutedForeground} />
            <Text className="text-xs text-muted-foreground">Centre de confiance</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
