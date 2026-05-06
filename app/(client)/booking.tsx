import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { specialistsApi, stripePaymentsApi } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Colors } from "@/constants/colors";

export default function BookingScreen() {
  const { proId } = useLocalSearchParams<{ proId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedPrestation, setSelectedPrestation] = useState<Record<string, unknown> | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Record<string, unknown> | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_site">("on_site");

  const { data: proRes, isLoading } = useQuery({
    queryKey: ["specialist", proId],
    queryFn: () => specialistsApi.getSpecialistById(Number(proId)),
    enabled: Boolean(proId),
  });

  const bookMutation = useMutation({
    mutationFn: (data: Parameters<typeof stripePaymentsApi.createReservation>[0]) =>
      stripePaymentsApi.createReservation(data),
    onSuccess: (res) => {
      if (res.success) {
        Alert.alert("Réservation confirmée !", "Votre rendez-vous a été enregistré.", [
          { text: "OK", onPress: () => router.replace("/(client)/my-bookings") },
        ]);
      }
    },
    onError: () => Alert.alert("Erreur", "Impossible de créer la réservation"),
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  const pro = proRes?.data as Record<string, unknown> | undefined;
  const services: Array<Record<string, unknown>> = (pro?.prestations as Array<Record<string, unknown>> | undefined) ?? [];

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
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Réserver
        </Text>
      </View>

      {/* Services */}
      <Text className="text-lg font-semibold text-foreground mb-3">
        Choisir une prestation
      </Text>

      {services.length === 0 ? (
        <Text className="text-muted-foreground text-center py-4">
          Aucune prestation disponible
        </Text>
      ) : (
        <View className="gap-2 mb-6">
          {services.map((svc) => {
            const isSelected = selectedPrestation?.id === svc.id;
            return (
              <Pressable
                key={String(svc.id)}
                onPress={() => setSelectedPrestation(svc)}
                className={[
                  "p-4 rounded-2xl border",
                  isSelected ? "border-primary bg-primary/5 border-2" : "border-border bg-card",
                ].join(" ")}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-foreground flex-1 mr-2">
                    {String(svc.name ?? svc.nom ?? "")}
                  </Text>
                  <Text className="text-base font-bold text-primary">
                    {Number(svc.price ?? svc.prixBase ?? 0).toFixed(2)} €
                  </Text>
                </View>
                <Text className="text-sm text-muted-foreground mt-1">
                  {Number(svc.duration_minutes ?? svc.tempsBloque ?? 60)} min
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Payment method */}
      {selectedPrestation && (
        <>
          <Text className="text-lg font-semibold text-foreground mb-3">
            Mode de paiement
          </Text>
          <View className="flex-row gap-3 mb-6">
            {(["on_site", "online"] as const).map((method) => (
              <Pressable
                key={method}
                onPress={() => setPaymentMethod(method)}
                className={[
                  "flex-1 py-3 rounded-2xl border items-center",
                  paymentMethod === method
                    ? "border-primary border-2 bg-primary/5"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <Ionicons
                  name={method === "on_site" ? "cash-outline" : "card-outline"}
                  size={20}
                  color={paymentMethod === method ? Colors.primary : Colors.mutedForeground}
                />
                <Text
                  className={[
                    "text-sm font-medium mt-1",
                    paymentMethod === method ? "text-primary" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {method === "on_site" ? "Sur place" : "En ligne"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            loading={bookMutation.isPending}
            fullWidth
            size="lg"
            onPress={() => {
              const svc = selectedPrestation!;
              bookMutation.mutate({
                pro_id: Number(proId),
                prestation_id: Number(svc.id),
                start_datetime: new Date().toISOString(),
                end_datetime: new Date().toISOString(),
                price: Number(svc.price ?? svc.prixBase ?? 0),
                payment_method: paymentMethod,
              });
            }}
          >
            Confirmer la réservation
          </Button>
        </>
      )}
    </ScrollView>
  );
}
