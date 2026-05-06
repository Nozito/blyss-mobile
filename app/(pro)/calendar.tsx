import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { proApi, nailTechApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

type Booking = {
  id: number;
  status: string;
  start_datetime: string;
  end_datetime?: string;
  client_first_name?: string;
  client_last_name?: string;
  prestation_name?: string;
  price?: number;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; badge: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  pending: { label: "En attente", color: Colors.warning, badge: "warning" },
  confirmed: { label: "Confirmé", color: Colors.success, badge: "success" },
  completed: { label: "Terminé", color: Colors.mutedForeground, badge: "secondary" },
  cancelled: { label: "Annulé", color: Colors.destructive, badge: "destructive" },
  no_show: { label: "Absent", color: Colors.destructive, badge: "destructive" },
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function ProCalendarScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const from = formatDate(selectedDate);
  const to = formatDate(addDays(selectedDate, 1));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pro-calendar", from],
    queryFn: () => proApi.getCalendar({ from, to }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "completed" | "cancelled" }) =>
      proApi.updateReservationStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-calendar"] }),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: number) => nailTechApi.markNoShow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-calendar"] }),
  });

  const bookings = (data?.data as Booking[] | undefined) ?? [];

  // Week strip
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const base = new Date();
    base.setDate(base.getDate() - 3 + i);
    return base;
  });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground tracking-tight mb-4">
          Agenda
        </Text>

        {/* Week strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {weekDays.map((day) => {
              const isSelected = formatDate(day) === formatDate(selectedDate);
              const isToday = formatDate(day) === formatDate(new Date());
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => setSelectedDate(day)}
                  className={[
                    "w-12 h-16 rounded-2xl items-center justify-center",
                    isSelected ? "bg-pro" : "bg-card",
                  ].join(" ")}
                  style={isSelected ? { backgroundColor: Colors.primary } : {}}
                >
                  <Text
                    className={`text-xs font-medium ${isSelected ? "text-white" : "text-muted-foreground"}`}
                  >
                    {day.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 3)}
                  </Text>
                  <Text
                    className={`text-lg font-bold ${isSelected ? "text-white" : isToday ? "text-primary" : "text-foreground"}`}
                  >
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : bookings.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="calendar-outline" size={48} color={Colors.border} />
          <Text className="text-lg font-semibold text-foreground mt-4">
            Aucun rendez-vous
          </Text>
          <Text className="text-muted-foreground mt-1">
            {selectedDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshing={false}
          onRefresh={refetch}
          renderItem={({ item }) => {
            const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            const clientName = `${item.client_first_name ?? ""} ${item.client_last_name ?? ""}`.trim();
            const time = new Date(item.start_datetime).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const isPast = new Date(item.start_datetime) < new Date();

            return (
              <Card elevated className="mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-base font-bold text-primary">{time}</Text>
                      <Badge variant={config.badge} size="sm">{config.label}</Badge>
                    </View>
                    <Text className="text-base font-semibold text-foreground">{clientName}</Text>
                    {item.prestation_name && (
                      <Text className="text-sm text-muted-foreground mt-0.5">{item.prestation_name}</Text>
                    )}
                    {item.price != null && (
                      <Text className="text-sm font-semibold text-primary mt-1">
                        {item.price.toFixed(2)} €
                      </Text>
                    )}
                  </View>

                  {/* Actions */}
                  <View className="flex-row gap-1 ml-2">
                    {item.status === "pending" && (
                      <Pressable
                        onPress={() => updateStatusMutation.mutate({ id: item.id, status: "completed" })}
                        className="p-2 bg-success/10 rounded-xl"
                      >
                        <Ionicons name="checkmark" size={18} color={Colors.success} />
                      </Pressable>
                    )}
                    {(item.status === "pending" || item.status === "confirmed") && isPast && (
                      <Pressable
                        onPress={() =>
                          Alert.alert("No-show", "Marquer cette cliente comme absente ?", [
                            { text: "Non", style: "cancel" },
                            { text: "Oui", style: "destructive", onPress: () => noShowMutation.mutate(item.id) },
                          ])
                        }
                        className="p-2 bg-warning/10 rounded-xl"
                      >
                        <Ionicons name="person-remove-outline" size={18} color={Colors.warning} />
                      </Pressable>
                    )}
                    {(item.status === "pending" || item.status === "confirmed") && !isPast && (
                      <Pressable
                        onPress={() =>
                          Alert.alert("Annuler", "Annuler ce rendez-vous ?", [
                            { text: "Non", style: "cancel" },
                            { text: "Annuler", style: "destructive", onPress: () => updateStatusMutation.mutate({ id: item.id, status: "cancelled" }) },
                          ])
                        }
                        className="p-2 bg-destructive/10 rounded-xl"
                      >
                        <Ionicons name="close" size={18} color={Colors.destructive} />
                      </Pressable>
                    )}
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
