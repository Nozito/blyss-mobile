import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Animated,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminPayment } from "@/lib/api";
import { Colors } from "@/constants/colors";

type TxStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

const STATUS_CFG: Record<TxStatus, { label: string; color: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  succeeded:  { label: "Réussi",     color: Colors.success,     icon: "checkmark-circle-outline" },
  processing: { label: "En cours",   color: Colors.pro,         icon: "reload-outline" },
  pending:    { label: "En attente", color: Colors.warning,     icon: "time-outline" },
  failed:     { label: "Échoué",     color: Colors.destructive, icon: "close-circle-outline" },
  refunded:   { label: "Remboursé",  color: Colors.info,        icon: "refresh-outline" },
};

const TX_FILTERS = ["all", "succeeded", "pending", "failed", "refunded"] as const;
type TxFilter = typeof TX_FILTERS[number];

function KpiCard({ label, value, color, index }: { label: string; value: string; color: string; index: number }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 70),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      backgroundColor: Colors.card, borderRadius: 18, padding: 16,
      borderWidth: 1, borderColor: `${color}25`, marginRight: 12, minWidth: 140,
      shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
      opacity, transform: [{ translateX }],
    }}>
      <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 6, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "900", color, letterSpacing: -0.5 }}>{value}</Text>
    </Animated.View>
  );
}

function TxCard({
  tx, index, onRefund,
}: {
  tx: AdminPayment; index: number; onRefund: (tx: AdminPayment) => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 40),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const cfg = STATUS_CFG[tx.status];

  return (
    <Animated.View style={{
      backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1,
      borderColor: cfg ? `${cfg.color}20` : Colors.border, overflow: "hidden", marginBottom: 10,
      shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
      opacity, transform: [{ translateY }],
    }}>
      {/* Main row */}
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.foreground, marginBottom: 2 }}>{tx.client_name}</Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 6 }}>Pro · {tx.pro_name}</Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
            {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.8 }}>
            {Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </Text>
          {cfg ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${cfg.color}18` }}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={{ fontSize: 10, fontWeight: "800", color: cfg.color }}>{cfg.label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer row */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 16 }}>
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
          Frais : {tx.fee != null ? `${Number(tx.fee).toFixed(2)} €` : "—"}
        </Text>
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
          Net : {tx.net_amount != null ? `${Number(tx.net_amount).toFixed(2)} €` : "—"}
        </Text>
        {tx.status === "succeeded" && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRefund(tx);
            }}
            style={{ marginLeft: "auto" as any, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: `${Colors.info}12`, borderWidth: 1, borderColor: `${Colors.info}30` }}
          >
            <Ionicons name="refresh-outline" size={12} color={Colors.info} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.info }}>Rembourser</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<TxFilter>("all");
  const [refreshing, setRefreshing]     = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-payments"],
    queryFn:  () => adminApi.getPayments(),
    staleTime: 2 * 60_000,
  });

  const refundMut = useMutation({
    mutationFn: (id: number) => adminApi.refundPayment(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      Alert.alert("Remboursé", "Le remboursement a été initié.");
    },
    onError: () => Alert.alert("Erreur", "Impossible d'effectuer le remboursement."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const transactions = (data?.data as AdminPayment[] | undefined) ?? [];

  const filtered = transactions.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.client_name.toLowerCase().includes(q) || t.pro_name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const succeeded = transactions.filter((t) => t.status === "succeeded");
  const thisMonth = succeeded.filter((t) => {
    const d = new Date(t.created_at), now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const kpis = [
    { label: "CA total",     value: `${succeeded.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: Colors.admin },
    { label: "CA ce mois",   value: `${thisMonth.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: Colors.pro },
    { label: "Transactions",  value: String(transactions.length), color: Colors.info },
    { label: "En attente",   value: String(transactions.filter((t) => t.status === "pending" || t.status === "processing").length), color: Colors.warning },
    { label: "Net total",    value: `${succeeded.reduce((s, t) => s + Number(t.net_amount ?? 0), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: Colors.success },
  ];

  const confirmRefund = (tx: AdminPayment) =>
    Alert.alert(
      "Rembourser",
      `Rembourser ${Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € à ${tx.client_name} ?\n\nCette action est irréversible.`,
      [
        { text: "Annuler",    style: "cancel" },
        { text: "Rembourser", style: "destructive", onPress: () => refundMut.mutate(tx.id) },
      ],
    );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.admin} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} colors={[Colors.admin]} />}
      >
        {/* KPI strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          {kpis.map((k, i) => (
            <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} index={i} />
          ))}
        </ScrollView>

        {/* Search */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border }}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher client ou pro…" placeholderTextColor={Colors.mutedForeground} style={{ flex: 1, fontSize: 13, color: Colors.foreground }} />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={Colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Status filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 20 }}>
          {TX_FILTERS.map((f) => {
            const cfg    = f !== "all" ? STATUS_CFG[f] : null;
            const active = statusFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatusFilter(f); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: active ? (cfg?.color ?? Colors.admin) : Colors.muted, borderColor: active ? (cfg?.color ?? Colors.admin) : Colors.border }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? Colors.white : Colors.mutedForeground }}>
                  {f === "all" ? "Tous" : cfg?.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Transactions */}
        <View style={{ paddingHorizontal: 20 }}>
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="card-outline" size={32} color={Colors.border} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>Aucune transaction</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Rien à afficher pour ce filtre.</Text>
            </View>
          ) : (
            filtered.map((tx, i) => (
              <TxCard key={tx.id} tx={tx} index={i} onRefund={confirmRefund} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
