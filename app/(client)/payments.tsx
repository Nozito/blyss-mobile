import React from "react";
import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { paymentMethodsApi, type SavedCard } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Colors } from "@/constants/colors";

const BRAND_ICONS: Record<string, string> = {
  visa: "💳",
  mastercard: "💳",
  amex: "💳",
};

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentMethodsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => paymentMethodsApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });

  const cards = (data?.data as SavedCard[] | undefined) ?? [];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-4">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </Pressable>
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Moyens de paiement
        </Text>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Ionicons name="card-outline" size={48} color={Colors.border} />
              <Text className="text-lg font-semibold text-foreground mt-4">
                Aucune carte enregistrée
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card elevated className="mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <Text style={{ fontSize: 28 }}>{BRAND_ICONS[item.brand] ?? "💳"}</Text>
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-semibold text-foreground capitalize">
                        {item.brand} •••• {item.last4}
                      </Text>
                      {item.is_default && (
                        <Badge variant="default" size="sm">Par défaut</Badge>
                      )}
                    </View>
                    <Text className="text-sm text-muted-foreground">
                      {item.cardholder_name} — expire {item.exp_month}/{item.exp_year}
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  {!item.is_default && (
                    <Pressable
                      onPress={() => setDefaultMutation.mutate(item.id)}
                      className="p-2"
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.primary} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() =>
                      Alert.alert("Supprimer", "Supprimer cette carte ?", [
                        { text: "Non", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: () => deleteMutation.mutate(item.id),
                        },
                      ])
                    }
                    className="p-2"
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.destructive} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

