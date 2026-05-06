import React from "react";
import { View, Text, FlatList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adminApi } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

type Booking = {
  id: number;
  status: string;
  start_datetime: string;
  price: number;
  client_name?: string;
  pro_name?: string;
};

export default function AdminBookingsScreen() {
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => adminApi.getBookings({ limit: 50 }),
  });

  const bookings = (data?.data as Booking[] | undefined) ?? [];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-4 pb-4">
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Réservations
        </Text>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="bg-card rounded-2xl p-4 mb-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-semibold text-foreground">
                  #{item.id}
                </Text>
                <Badge
                  variant={
                    item.status === "confirmed"
                      ? "success"
                      : item.status === "cancelled"
                      ? "destructive"
                      : "warning"
                  }
                  size="sm"
                >
                  {item.status}
                </Badge>
              </View>
              <Text className="text-sm text-muted-foreground">
                {new Date(item.start_datetime).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              {item.client_name && (
                <Text className="text-sm text-foreground mt-1">
                  Cliente : {item.client_name}
                </Text>
              )}
              {item.pro_name && (
                <Text className="text-sm text-foreground">
                  Pro : {item.pro_name}
                </Text>
              )}
              <Text className="text-sm font-bold text-primary mt-1">
                {typeof item.price === "number"
                  ? item.price.toFixed(2)
                  : parseFloat(String(item.price ?? "0")).toFixed(2)} €
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
