import React from "react";
import { View, Text, FlatList, Pressable, Alert, Switch } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { useRouter } from "expo-router";
import { proApi } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

type Service = {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  active?: boolean;
};

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pro-services"],
    queryFn: () => proApi.getServices(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      proApi.updateService(id, { active }),
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ["pro-services"] });
      const prev = qc.getQueryData(["pro-services"]);
      qc.setQueryData(["pro-services"], (old: any) => ({
        ...old,
        data: ((old?.data ?? []) as Service[]).map((s) =>
          s.id === id ? { ...s, active } : s
        ),
      }));
      return { prev };
    },
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      qc.setQueryData(["pro-services"], ctx?.prev);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => proApi.duplicateService(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-services"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => proApi.deleteService(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-services"] }),
  });

  const services = (data?.data as Service[] | undefined) ?? [];
  const activeCount = services.filter((s) => s.active !== false).length;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
      }}>
        <AnimatedIconButton
          onPress={() => router.back()}
          style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </AnimatedIconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
            Prestations
          </Text>
          <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
            {activeCount} active{activeCount !== 1 ? "s" : ""} sur {services.length}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(pro)/(profile)/service-form")}
          style={{
            width: 40, height: 40, borderRadius: 14,
            backgroundColor: Colors.primary,
            alignItems: "center", justifyContent: "center",
            shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshing={false}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 64, gap: 12 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: `${Colors.primary}15`,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="sparkles-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground }}>
                Aucune prestation
              </Text>
              <Text style={{ fontSize: 14, color: Colors.mutedForeground, textAlign: "center" }}>
                Crée ta première prestation{"\n"}pour qu'elles apparaissent ici
              </Text>
              <Pressable
                onPress={() => router.push("/(pro)/(profile)/service-form")}
                style={{
                  marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
                  backgroundColor: Colors.primary, borderRadius: 16,
                  flexDirection: "row", alignItems: "center", gap: 8,
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Créer une prestation</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const inactive = item.active === false;
            return (
              <View style={{
                backgroundColor: Colors.card, borderRadius: 20, marginBottom: 12,
                borderWidth: 1,
                borderColor: inactive ? Colors.border : `${Colors.primary}25`,
                overflow: "hidden",
              }}>
                {/* Ligne principale */}
                <View style={{ padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 14,
                    backgroundColor: inactive ? Colors.muted : `${Colors.primary}15`,
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Ionicons
                      name="sparkles-outline"
                      size={22}
                      color={inactive ? Colors.mutedForeground : Colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, flex: 1 }} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {inactive && <Badge variant="secondary" size="sm">Inactif</Badge>}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.primary }}>
                        {(typeof item.price === "number" ? item.price : parseFloat(String(item.price ?? "0"))).toFixed(2)} €
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="time-outline" size={13} color={Colors.mutedForeground} />
                        <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                          {item.duration_minutes} min
                        </Text>
                      </View>
                    </View>
                    {item.description ? (
                      <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 4 }} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Barre d'actions */}
                <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.border, alignItems: "center" }}>
                  {/* Toggle actif */}
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}>
                    <Ionicons
                      name={inactive ? "pause-circle-outline" : "checkmark-circle-outline"}
                      size={15}
                      color={inactive ? Colors.mutedForeground : Colors.success}
                    />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: inactive ? Colors.mutedForeground : Colors.success }}>
                      {inactive ? "Inactive" : "Active"}
                    </Text>
                    <Switch
                      value={!inactive}
                      onValueChange={(val) => toggleMutation.mutate({ id: item.id, active: val })}
                      trackColor={{ false: "#E5E7EB", true: Colors.primary }}
                      thumbColor="#fff"
                      style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                    />
                  </View>

                  {/* Dupliquer */}
                  <Pressable
                    onPress={() => duplicateMutation.mutate(item.id)}
                    style={{ padding: 12, borderLeftWidth: 1, borderLeftColor: Colors.border }}
                  >
                    <Ionicons name="copy-outline" size={18} color={Colors.mutedForeground} />
                  </Pressable>

                  {/* Modifier */}
                  <Pressable
                    onPress={() => router.push(`/(pro)/(profile)/service-form?id=${item.id}`)}
                    style={{ padding: 12, borderLeftWidth: 1, borderLeftColor: Colors.border }}
                  >
                    <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                  </Pressable>

                  {/* Supprimer */}
                  <Pressable
                    onPress={() =>
                      Alert.alert("Supprimer", `Supprimer "${item.name}" ?`, [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: () => deleteMutation.mutate(item.id),
                        },
                      ])
                    }
                    style={{ padding: 12, borderLeftWidth: 1, borderLeftColor: Colors.border }}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
