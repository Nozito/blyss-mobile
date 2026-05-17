import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { proApi, nailTechApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";
import type { BlockedClient } from "@/lib/api";

type Client = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  profile_photo?: string | null;
  bookings_count?: number;
  total_spent?: number;
  created_at?: string;
};

const TABS = [
  { key: "clients", label: "Clientes", icon: "people-outline" as const },
  { key: "blocked", label: "Bloquées", icon: "shield-outline" as const },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const NEW_CLIENT_DAYS = 7;

export default function ProClientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("clients");
  const [search, setSearch] = useState("");

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["pro-clients"],
    queryFn: () => proApi.getClients(),
  });

  const { data: blockedData, isLoading: loadingBlocked } = useQuery({
    queryKey: ["blocked-clients"],
    queryFn: () => nailTechApi.getBlockedClients(),
  });

  const unblockMutation = useMutation({
    mutationFn: (id: number) => nailTechApi.unblockClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-clients"] }),
  });

  const clients = (clientsData?.data as Client[] | undefined) ?? [];
  const blocked = (blockedData?.data as BlockedClient[] | undefined) ?? [];

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const filteredClients = clients.filter((c) =>
    search
      ? `${c.first_name} ${c.last_name} ${c.email} ${c.phone_number ?? ""}`.toLowerCase().includes(search.toLowerCase())
      : true
  );

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total: clients.length,
    thisWeek: clients.filter((c) => c.created_at && new Date(c.created_at) >= weekStart).length,
    thisMonth: clients.filter((c) => c.created_at && new Date(c.created_at) >= monthStart).length,
  };

  const isNewClient = (c: Client) =>
    !!c.created_at &&
    Date.now() - new Date(c.created_at).getTime() < NEW_CLIENT_DAYS * 24 * 3600 * 1000;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5, marginBottom: 16 }}>
          Mes clientes
        </Text>

        {/* Tabs */}
        <View style={{ flexDirection: "row", backgroundColor: Colors.card, borderRadius: 16, padding: 4, gap: 4, marginBottom: 12 }}>
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
              {key === "blocked" && blocked.length > 0 && (
                <View style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: tab === key ? "rgba(255,255,255,0.3)" : Colors.destructive,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{blocked.length}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Barre de recherche */}
        {tab === "clients" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: "#E4E0DC", backgroundColor: "#F8F5F2", paddingHorizontal: 14 }}>
            <Ionicons name="search-outline" size={16} color="#A1A1AA" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou téléphone..."
              placeholderTextColor="#C0BAB5"
              style={{ flex: 1, fontSize: 14.5, color: "#09090B", padding: 0 }}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color="#A1A1AA" />
              </Pressable>
            )}
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
                <View style={{
                  flexDirection: "row", backgroundColor: Colors.card,
                  borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
                  marginBottom: 20, overflow: "hidden",
                }}>
                  {[
                    { label: "TOTAL", value: stats.total },
                    { label: "SEMAINE", value: stats.thisWeek },
                    { label: "MOIS", value: stats.thisMonth },
                  ].map(({ label, value }, i) => (
                    <View key={label} style={{
                      flex: 1, alignItems: "center", paddingVertical: 16,
                      borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: Colors.border,
                    }}>
                      <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground }}>{value}</Text>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, marginTop: 2, letterSpacing: 0.5 }}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 12 }}>
                  {search ? `${filteredClients.length} résultat${filteredClients.length !== 1 ? "s" : ""}` : "Toutes les clientes"}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={{ backgroundColor: Colors.card, borderRadius: 16, padding: 40, alignItems: "center", gap: 8 }}>
                <Ionicons name="people-outline" size={40} color={Colors.border} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>
                  {search ? "Aucun résultat" : "Aucune cliente"}
                </Text>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                  {search ? "Essaie un autre terme de recherche" : "Tes clientes apparaîtront ici"}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const photoUri = item.profile_photo
                ? item.profile_photo.startsWith("http")
                  ? item.profile_photo
                  : `${API_URL}${item.profile_photo}`
                : undefined;
              const isNew = isNewClient(item);

              return (
                <Pressable
                  onPress={() => router.push(`/(pro)/client-detail?clientId=${item.id}`)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    backgroundColor: Colors.card, borderRadius: 20, padding: 14,
                    marginBottom: 8, borderWidth: 1,
                    borderColor: isNew ? `${Colors.primary}30` : Colors.border,
                  }}
                >
                  <View style={{ position: "relative" }}>
                    <Avatar uri={photoUri} name={`${item.first_name} ${item.last_name}`} size={46} />
                    {isNew && (
                      <View style={{
                        position: "absolute", top: -4, right: -4,
                        backgroundColor: Colors.success, borderRadius: 8,
                        paddingHorizontal: 5, paddingVertical: 1,
                      }}>
                        <Text style={{ fontSize: 8, fontWeight: "800", color: "#fff" }}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{item.email}</Text>
                    {(item.bookings_count != null || item.total_spent != null) && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 }}>
                        {item.bookings_count != null && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Ionicons name="calendar-outline" size={11} color={Colors.mutedForeground} />
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                              {item.bookings_count} rdv
                            </Text>
                          </View>
                        )}
                        {item.total_spent != null && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Ionicons name="trending-up-outline" size={11} color={Colors.mutedForeground} />
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                              {item.total_spent.toFixed(0)} €
                            </Text>
                          </View>
                        )}
                      </View>
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
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
              <Ionicons name="shield-checkmark-outline" size={48} color={Colors.border} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>
                Aucune cliente bloquée
              </Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
                Ta liste de blocage est vide
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 12,
              backgroundColor: Colors.card, borderRadius: 20, padding: 14,
              marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
            }}>
              <Avatar name={`${item.first_name} ${item.last_name}`} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{item.email}</Text>
                {item.reason && (
                  <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2 }}>
                    {item.reason}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => unblockMutation.mutate(item.client_id)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 7,
                  backgroundColor: `${Colors.success}15`,
                  borderRadius: 12, borderWidth: 1, borderColor: `${Colors.success}30`,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.success }}>Débloquer</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
