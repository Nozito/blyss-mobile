import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { proApi } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

export default function ProPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [iban, setIban] = useState("");
  const [acceptOnline, setAcceptOnline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pro-payment-settings"],
    queryFn: () => proApi.getPaymentSettings(),
  });

  useEffect(() => {
    const d = (data as any)?.data;
    if (d) {
      setIban(d.iban ?? d.IBAN ?? "");
      setAcceptOnline(d.accept_online ?? Boolean(d.accept_online_payment));
    }
  }, [data]);

  const handleSave = async () => {
    if (iban && iban.length < 14) {
      Alert.alert("Erreur", "L'IBAN saisi semble invalide.");
      return;
    }
    setIsSaving(true);
    try {
      await proApi.updatePaymentSettings({ iban, accept_online: acceptOnline });
      Alert.alert("Succès", "Paramètres de paiement mis à jour !");
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour les paramètres.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center mb-2">
          <AnimatedIconButton
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-muted items-center justify-center mr-3"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <Text className="text-2xl font-bold text-foreground">Paramètres paiement</Text>
        </View>
        <Text className="text-sm text-muted-foreground ml-1">
          Configure ton mode de versement et les paiements en ligne
        </Text>
      </View>

      {/* Stripe status */}
      <View className="mb-4">
        <View
          className="bg-card rounded-2xl p-4 flex-row items-center gap-3 border border-border"
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: `${Colors.primary}18` }}>
            <Ionicons name="card-outline" size={22} color={Colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground">Stripe Connect</Text>
            <Text className="text-xs text-muted-foreground">Accepte les paiements en ligne sécurisés</Text>
          </View>
          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" }}>
            <Text className="text-xs font-bold" style={{ color: "#15803D" }}>Sécurisé</Text>
          </View>
        </View>
      </View>

      {/* IBAN section */}
      <View className="mb-4">
        <View
          className="bg-card rounded-2xl p-5 border border-border"
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Coordonnées bancaires
          </Text>

          <Input
            label="IBAN"
            value={iban}
            onChangeText={setIban}
            placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            leftIcon="business-outline"
            autoCapitalize="characters"
            hint="Tes virements seront effectués automatiquement sous 2 jours ouvrés après chaque paiement reçu."
          />
        </View>
      </View>

      {/* Online payments toggle */}
      <View className="mb-6">
        <View
          className="bg-card rounded-2xl p-5 border border-border"
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Paiements en ligne
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-sm font-semibold text-foreground mb-1">
                Accepter les paiements en ligne
              </Text>
              <Text className="text-xs text-muted-foreground leading-relaxed">
                Tes clientes pourront payer directement lors de la réservation. Zéro impayé.
              </Text>
            </View>
            <Switch
              value={acceptOnline}
              onValueChange={setAcceptOnline}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>

          {acceptOnline && (
            <View
              className="mt-4 p-3 rounded-xl flex-row items-center gap-2"
              style={{ backgroundColor: `${Colors.primary}0D` }}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
              <Text className="text-xs text-muted-foreground flex-1">
                Les paiements en ligne sont activés. Les frais Stripe (1,5% + 0,25€) sont déduits automatiquement.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Info cards */}
      <View className="flex-row gap-3 mb-8">
        <View className="flex-1 bg-card rounded-xl p-3 border border-border items-center gap-1">
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text className="text-xs font-semibold text-foreground text-center">Stripe</Text>
          <Text className="text-xs text-muted-foreground text-center">Sécurisé PCI</Text>
        </View>
        <View className="flex-1 bg-card rounded-xl p-3 border border-border items-center gap-1">
          <Ionicons name="arrow-forward-outline" size={18} color={Colors.success} />
          <Text className="text-xs font-semibold text-foreground text-center">Virement</Text>
          <Text className="text-xs text-muted-foreground text-center">Automatique J+2</Text>
        </View>
        <View className="flex-1 bg-card rounded-xl p-3 border border-border items-center gap-1">
          <Ionicons name="close-circle-outline" size={18} color={Colors.success} />
          <Text className="text-xs font-semibold text-foreground text-center">0 impayé</Text>
          <Text className="text-xs text-muted-foreground text-center">Garanti</Text>
        </View>
      </View>

      {/* Save button */}
      <View>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          className="rounded-2xl h-14 items-center justify-center"
          style={{ backgroundColor: Colors.primary, opacity: isSaving ? 0.7 : 1 }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text className="text-white font-bold text-base">Enregistrer</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
