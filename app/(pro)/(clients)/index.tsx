import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Animated,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { proApi, nailTechApi } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Avatar } from "@/components/ui/Avatar";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Colors } from "@/constants/colors";
import { TAB_BOTTOM_PADDING } from "@/constants/layout";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { BlockedClient } from "@/lib/api";

type Client = {
  id: number;
  name: string;
  phone?: string | null;
  lastVisit?: string | null;
  totalVisits?: number;
  notes?: string | null;
  avatar?: string | null;
};

const TABS = [
  { key: "clients", label: "Clientes", icon: "people-outline" as const },
  { key: "blocked", label: "Bloquées", icon: "shield-outline" as const },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const NEW_CLIENT_DAYS = 7;

function BlockedClientRow({
  item,
  onUnblock,
  isUnblocking,
}: {
  item: BlockedClient;
  onUnblock: (clientId: number) => void;
  isUnblocking: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: Colors.card, borderRadius: 20, padding: 14,
        marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
      }}
    >
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
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          onUnblock(item.client_id);
        }}
        disabled={isUnblocking}
        style={{
          paddingHorizontal: 12, paddingVertical: 7,
          backgroundColor: `${Colors.success}15`,
          borderRadius: 12, borderWidth: 1, borderColor: `${Colors.success}30`,
          opacity: isUnblocking ? 0.5 : 1,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.success }}>Débloquer</Text>
      </AnimatedPressable>
    </View>
  );
}

export default function ProClientsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<TabKey>("clients");
  const [search, setSearch] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const deferredSearch = useDebounce(search, 250);

  const listRef = useRef(null);
  useScrollToTop(listRef);

  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [contentOpacity]);

  const handleTabChange = useCallback((key: TabKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTab(key);
  }, []);

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["pro-clients"],
    queryFn: () => proApi.getClients(),
    staleTime: 2 * 60_000,
  });

  const { data: blockedData, isLoading: loadingBlocked } = useQuery({
    queryKey: ["blocked-clients"],
    queryFn: () => nailTechApi.getBlockedClients(),
    staleTime: 2 * 60_000,
  });

  const unblockMutation = useMutation({
    mutationFn: (id: number) => nailTechApi.unblockClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blocked-clients"] });
      qc.invalidateQueries({ queryKey: ["pro-clients"] });
    },
    onError: () => setClientError("Impossible de débloquer cette cliente."),
  });

  const clients = (clientsData?.data as Client[] | undefined) ?? [];
  const blocked = (blockedData?.data as BlockedClient[] | undefined) ?? [];

  const filteredClients = useMemo(
    () =>
      deferredSearch
        ? clients.filter((c) =>
            `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(deferredSearch.toLowerCase())
          )
        : clients,
    [clients, deferredSearch]
  );

  const stats = useMemo(() => ({
    total: clients.length,
    totalVisits: clients.reduce((sum, c) => sum + (c.totalVisits ?? 0), 0),
  }), [clients]);

  const clientsContentStyle = useMemo(
    () => ({ paddingHorizontal: 20, paddingBottom: insets.bottom + TAB_BOTTOM_PADDING }),
    [insets.bottom]
  );

  const renderClientItem = useCallback(({ item }: { item: Client }) => (
    <AnimatedPressable
      onPress={() => router.push(`/(pro)/(clients)/client-detail?clientId=${item.id}`)}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: Colors.card, borderRadius: 20, padding: 14,
        marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
      }}
    >
      <Avatar name={item.name} size={46} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
          {item.name}
        </Text>
        {item.phone ? (
          <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{item.phone}</Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 }}>
          {item.totalVisits != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="calendar-outline" size={11} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                {item.totalVisits} visite{item.totalVisits !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
          {item.lastVisit ? (
            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>· {item.lastVisit}</Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.mutedForeground} />
    </AnimatedPressable>
  ), [router]);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top, opacity: contentOpacity }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5, marginBottom: clientError ? 8 : 16 }}>
          Mes clientes
        </Text>
        {clientError && <View style={{ marginBottom: 12 }}><ErrorMessage message={clientError} /></View>}

        {/* Tabs */}
        <View style={{ flexDirection: "row", backgroundColor: Colors.card, borderRadius: 16, padding: 4, gap: 4, marginBottom: 12 }}>
          {TABS.map(({ key, label, icon }) => (
            <Pressable
              key={key}
              onPress={() => handleTabChange(key)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 12,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                backgroundColor: tab === key ? Colors.primary : "transparent",
              }}
            >
              <Ionicons name={icon} size={15} color={tab === key ? Colors.white : Colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: tab === key ? Colors.white : Colors.mutedForeground }}>
                {label}
              </Text>
              {key === "blocked" && blocked.length > 0 && (
                <View style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: tab === key ? "rgba(255,255,255,0.3)" : Colors.destructive,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: Colors.white }}>{blocked.length}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Barre de recherche */}
        {tab === "clients" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cream, paddingHorizontal: 14 }}>
            <Ionicons name="search-outline" size={16} color="#A1A1AA" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou téléphone..."
              placeholderTextColor={Colors.inputPlaceholder}
              style={{ flex: 1, fontSize: 14.5, color: Colors.foreground, padding: 0 }}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => setSearch("")}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
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
            ref={listRef}
            data={filteredClients}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={clientsContentStyle}
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
                    { label: "CLIENTES", value: stats.total },
                    { label: "VISITES", value: stats.totalVisits },
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
                  {deferredSearch ? `${filteredClients.length} résultat${filteredClients.length !== 1 ? "s" : ""}` : "Toutes les clientes"}
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
            renderItem={renderClientItem}
          />
        )
      ) : loadingBlocked ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          ref={listRef}
          data={blocked}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={clientsContentStyle}
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
            <BlockedClientRow
              item={item}
              onUnblock={(clientId) => unblockMutation.mutate(clientId)}
              isUnblocking={unblockMutation.isPending}
            />
          )}
        />
      )}
    </Animated.View>
  );
}
