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

const BG     = "#0B0E14";
const CARD   = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT   = "#F8FAFC";
const MUTED  = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type TxStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";

const STATUS_CFG: Record<TxStatus, { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  succeeded:  { label: "Réussi",     color: "#4ADE80", bg: "rgba(74,222,128,0.12)",  icon: "checkmark-circle-outline" },
  processing: { label: "En cours",   color: "#A78BFA", bg: "rgba(167,139,250,0.12)", icon: "reload-outline" },
  pending:    { label: "En attente", color: "#FBBF24", bg: "rgba(251,191,36,0.12)",  icon: "time-outline" },
  failed:     { label: "Échoué",     color: "#F87171", bg: "rgba(248,113,113,0.12)", icon: "close-circle-outline" },
  refunded:   { label: "Remboursé",  color: "#38BDF8", bg: "rgba(56,189,248,0.12)",  icon: "refresh-outline" },
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
      backgroundColor: CARD, borderRadius: 18, padding: 16,
      borderWidth: 1, borderColor: `${color}20`, marginRight: 12, minWidth: 140,
      opacity, transform: [{ translateX }],
    }}>
      <Text style={{ fontSize: 11, color: MUTED, marginBottom: 6, fontWeight: "600" }}>{label}</Text>
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
      backgroundColor: CARD, borderRadius: 18, borderWidth: 1,
      borderColor: cfg ? `${cfg.color}20` : BORDER, overflow: "hidden", marginBottom: 10,
      opacity, transform: [{ translateY }],
    }}>
      {/* Main row */}
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: TEXT, marginBottom: 2 }}>{tx.client_name}</Text>
          <Text style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Pro · {tx.pro_name}</Text>
          <Text style={{ fontSize: 11, color: MUTED }}>
            {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.8 }}>
            {Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </Text>
          {cfg ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: cfg.bg }}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <Text style={{ fontSize: 10, fontWeight: "800", color: cfg.color }}>{cfg.label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer row */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 16 }}>
        <Text style={{ fontSize: 11, color: MUTED }}>
          Frais : {tx.fee != null ? `${Number(tx.fee).toFixed(2)} €` : "—"}
        </Text>
        <Text style={{ fontSize: 11, color: MUTED }}>
          Net : {tx.net_amount != null ? `${Number(tx.net_amount).toFixed(2)} €` : "—"}
        </Text>
        {tx.status === "succeeded" && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRefund(tx);
            }}
            style={{ marginLeft: "auto" as any, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(56,189,248,0.10)", borderWidth: 1, borderColor: "rgba(56,189,248,0.22)" }}
          >
            <Ionicons name="refresh-outline" size={12} color="#38BDF8" />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#38BDF8" }}>Rembourser</Text>
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
    { label: "CA total",    value: `${succeeded.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: ACCENT },
    { label: "CA ce mois",  value: `${thisMonth.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: "#A78BFA" },
    { label: "Transactions", value: String(transactions.length), color: "#38BDF8" },
    { label: "En attente",  value: String(transactions.filter((t) => t.status === "pending" || t.status === "processing").length), color: "#FBBF24" },
    { label: "Net total",   value: `${succeeded.reduce((s, t) => s + Number(t.net_amount ?? 0), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: "#4ADE80" },
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
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        {/* KPI strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          {kpis.map((k, i) => (
            <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} index={i} />
          ))}
        </ScrollView>

        {/* Search */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: BORDER }}>
            <Ionicons name="search-outline" size={16} color={MUTED} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher client ou pro…" placeholderTextColor={MUTED} style={{ flex: 1, fontSize: 13, color: TEXT }} />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={MUTED} />
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
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: active ? (cfg?.color ?? ACCENT) : CARD, borderColor: active ? (cfg?.color ?? ACCENT) : BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : MUTED }}>
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
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="card-outline" size={32} color="rgba(255,255,255,0.15)" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 6 }}>Aucune transaction</Text>
              <Text style={{ fontSize: 13, color: MUTED }}>Rien à afficher pour ce filtre.</Text>
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
