import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { proApi, nailTechApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";
import type { ClientNote, BlockedClient } from "@/lib/api";

type Client = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  profile_photo?: string | null;
  bookings_count?: number;
  total_spent?: number;
};

const TABS = [
  { key: "clients", label: "Clientes", icon: "people-outline" as const },
  { key: "blocked", label: "Bloquées", icon: "shield-outline" as const },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ProClientsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("clients");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["pro-clients"],
    queryFn: () => proApi.getClients(),
  });

  const { data: blockedData, isLoading: loadingBlocked } = useQuery({
    queryKey: ["blocked-clients"],
    queryFn: () => nailTechApi.getBlockedClients(),
  });

  const { data: notesData } = useQuery({
    queryKey: ["client-notes", selectedClient?.id],
    queryFn: () => nailTechApi.getClientNotes(selectedClient!.id),
    enabled: selectedClient != null,
  });

  const blockMutation = useMutation({
    mutationFn: (id: number) => nailTechApi.blockClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-clients"] });
      qc.invalidateQueries({ queryKey: ["blocked-clients"] });
      setSelectedClient(null);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (id: number) => nailTechApi.unblockClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-clients"] }),
  });

  const clients = (clientsData?.data as Client[] | undefined) ?? [];
  const blocked = (blockedData?.data as BlockedClient[] | undefined) ?? [];
  const notes = notesData?.data as ClientNote | undefined;

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const filteredClients = clients.filter((c) =>
    search
      ? `${c.first_name} ${c.last_name} ${c.email} ${c.phone_number ?? ""}`.toLowerCase().includes(search.toLowerCase())
      : true
  );

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const stats = {
    total: clients.length,
    thisWeek: clients.filter((c) => new Date((c as any).created_at) >= weekStart).length,
    thisMonth: clients.filter((c) => new Date((c as any).created_at) >= monthStart).length,
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground tracking-tight mb-4">
          Mes clientes
        </Text>

        {/* Tabs */}
        <View className="flex-row bg-card rounded-2xl p-1 gap-1 mb-3">
          {TABS.map(({ key, label, icon }) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 12,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: tab === key ? Colors.primary : "transparent",
              }}
            >
              <Ionicons name={icon} size={15} color={tab === key ? "#fff" : Colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: tab === key ? "#fff" : Colors.mutedForeground }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "clients" && (
          <View className="flex-row items-center gap-2 bg-card border border-border rounded-2xl px-4 h-11">
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou téléphone..."
              placeholderTextColor={Colors.mutedForeground}
              className="flex-1 text-sm text-foreground"
              autoCorrect={false}
            />
          </View>
        )}
      </View>

      {tab === "clients" ? (
        loadingClients ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            data={filteredClients}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* Stats */}
                <View style={{ flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 20 }}>
                  {[
                    { label: "TOTAL",   value: stats.total },
                    { label: "SEMAINE", value: stats.thisWeek },
                    { label: "MOIS",    value: stats.thisMonth },
                  ].map(({ label, value }, i) => (
                    <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 16, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: "#F0F0F0" }}>
                      <Text style={{ fontSize: 26, fontWeight: "800", color: "#111" }}>{value ?? 0}</Text>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF", marginTop: 2, letterSpacing: 0.5 }}>{label}</Text>
                    </View>
                  ))}
                </View>
                {/* Titre section */}
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 12 }}>
                  Toutes les clientes
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 40, alignItems: "center", gap: 8 }}>
                <Ionicons name="people-outline" size={40} color="#D1D5DB" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>Aucune cliente</Text>
                <Text style={{ fontSize: 13, color: "#9CA3AF" }}>Tes clientes apparaîtront ici</Text>
              </View>
            }
            renderItem={({ item }) => {
              const photoUri = item.profile_photo
                ? item.profile_photo.startsWith("http")
                  ? item.profile_photo
                  : `${API_URL}${item.profile_photo}`
                : undefined;

              return (
                <Pressable
                  onPress={() => setSelectedClient(item)}
                  className="flex-row items-center gap-3 bg-card rounded-2xl p-4 mb-2"
                >
                  <Avatar
                    uri={photoUri}
                    name={`${item.first_name} ${item.last_name}`}
                    size={44}
                  />
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">{item.email}</Text>
                    {item.bookings_count != null && (
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        {item.bookings_count} rdv · {(item.total_spent ?? 0).toFixed(0)} €
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
                </Pressable>
              );
            }}
          />
        )
      ) : loadingBlocked ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Ionicons name="ban-outline" size={48} color={Colors.border} />
              <Text className="text-foreground font-semibold text-lg mt-4">Aucune cliente bloquée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 bg-card rounded-2xl p-4 mb-2">
              <Avatar
                name={`${item.first_name} ${item.last_name}`}
                size={44}
              />
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  {item.first_name} {item.last_name}
                </Text>
                <Text className="text-sm text-muted-foreground">{item.email}</Text>
                {item.reason && (
                  <Text className="text-xs text-muted-foreground mt-0.5">{item.reason}</Text>
                )}
              </View>
              <Pressable
                onPress={() => unblockMutation.mutate(item.client_id)}
                className="px-3 py-1.5 bg-success/10 rounded-xl"
              >
                <Text className="text-xs font-medium text-success">Débloquer</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Client detail modal */}
      <Modal
        visible={selectedClient != null}
        onClose={() => setSelectedClient(null)}
        title={selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : ""}
        bottomSheet
      >
        {selectedClient && (
          <View className="gap-4">
            {notes && (
              <View className="gap-2">
                {notes.allergies && (
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground mb-0.5">ALLERGIES</Text>
                    <Text className="text-sm text-foreground">{notes.allergies}</Text>
                  </View>
                )}
                {notes.preferred_shape && (
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground mb-0.5">FORME PRÉFÉRÉE</Text>
                    <Text className="text-sm text-foreground">{notes.preferred_shape}</Text>
                  </View>
                )}
                {notes.preferred_style && (
                  <View>
                    <Text className="text-xs font-semibold text-muted-foreground mb-0.5">STYLE PRÉFÉRÉ</Text>
                    <Text className="text-sm text-foreground">{notes.preferred_style}</Text>
                  </View>
                )}
                {notes.patch_test_done && (
                  <Badge variant="success" size="sm">Test patch effectué</Badge>
                )}
              </View>
            )}

            <Button
              variant="destructive"
              fullWidth
              onPress={() =>
                Alert.alert("Bloquer", `Bloquer ${selectedClient.first_name} ?`, [
                  { text: "Non", style: "cancel" },
                  {
                    text: "Bloquer",
                    style: "destructive",
                    onPress: () => blockMutation.mutate(selectedClient.id),
                  },
                ])
              }
            >
              Bloquer cette cliente
            </Button>
          </View>
        )}
      </Modal>
    </View>
  );
}
