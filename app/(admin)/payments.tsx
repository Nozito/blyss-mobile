import React, { useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminPayment } from "@/lib/api";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type TxStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded";
type Transaction = AdminPayment;

const STATUS_CFG: Record<TxStatus, { label: string; color: string; bg: string; icon: string }> = {
  succeeded:  { label: "Réussi",     color: "#4ADE80", bg: "rgba(74,222,128,0.12)",  icon: "checkmark-circle-outline" },
  processing: { label: "En cours",   color: "#A78BFA", bg: "rgba(167,139,250,0.12)", icon: "reload-outline" },
  pending:    { label: "En attente", color: "#FBBF24", bg: "rgba(251,191,36,0.12)",   icon: "time-outline" },
  failed:     { label: "Échoué",     color: "#F87171", bg: "rgba(248,113,113,0.12)",  icon: "close-circle-outline" },
  refunded:   { label: "Remboursé",  color: "#38BDF8", bg: "rgba(56,189,248,0.12)",   icon: "refresh-outline" },
};

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => adminApi.getPayments(),
    staleTime: 2 * 60_000,
  });

  const refundMut = useMutation({
    mutationFn: (id: number) => adminApi.refundPayment(id),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      Alert.alert("✅", "Remboursement initié.");
    },
    onError: () => Alert.alert("Erreur", "Impossible d'effectuer le remboursement."),
  });

  const transactions = (data?.data as Transaction[] | undefined) ?? [];

  const filtered = transactions.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.client_name.toLowerCase().includes(q) || t.pro_name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const successful = transactions.filter((t) => t.status === "succeeded");
  const kpis = {
    total: successful.reduce((s, t) => s + Number(t.amount), 0),
    fees:  successful.reduce((s, t) => s + Number(t.fee ?? 0), 0),
    net:   successful.reduce((s, t) => s + Number(t.net_amount ?? 0), 0),
    pending: transactions.filter((t) => t.status === "pending" || t.status === "processing").length,
  };

  const confirmRefund = (tx: Transaction) =>
    Alert.alert("Rembourser", `Rembourser ${tx.amount.toLocaleString("fr-FR")} € à ${tx.client_name} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Rembourser", style: "destructive", onPress: () => refundMut.mutate(tx.id) },
    ]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>Paiements</Text>
      <Text style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{filtered.length} transaction(s)</Text>

      {/* KPI row */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        {[
          { label: "CA total", value: `${kpis.total.toLocaleString("fr-FR")} €`, color: ACCENT },
          { label: "Frais",    value: `${kpis.fees.toLocaleString("fr-FR")} €`,  color: MUTED },
          { label: "Net",      value: `${kpis.net.toLocaleString("fr-FR")} €`,   color: "#4ADE80" },
          { label: "En attente", value: String(kpis.pending),                    color: "#FBBF24" },
        ].map((k) => (
          <View key={k.label} style={{ width: "47%", backgroundColor: CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{k.label}</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: k.color as string }}>{k.value}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: BORDER, marginBottom: 12 }}>
        <Ionicons name="search-outline" size={16} color={MUTED} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Rechercher client ou pro…"
          placeholderTextColor={MUTED}
          style={{ flex: 1, fontSize: 13, color: TEXT }}
        />
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
        {(["all", "succeeded", "pending", "failed", "refunded"] as const).map((f) => {
          const cfg = f !== "all" ? STATUS_CFG[f] : null;
          const active = statusFilter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setStatusFilter(f)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                backgroundColor: active ? (cfg?.color ?? ACCENT) : CARD,
                borderColor: active ? (cfg?.color ?? ACCENT) : BORDER }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#000" : MUTED }}>
                {f === "all" ? "Tous" : cfg?.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Transactions */}
      {filtered.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <Ionicons name="card-outline" size={48} color="rgba(255,255,255,0.08)" />
          <Text style={{ fontSize: 14, color: MUTED, marginTop: 12 }}>Aucune transaction</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {filtered.map((tx) => {
            const cfg = STATUS_CFG[tx.status];
            return (
              <View key={tx.id} style={{ backgroundColor: CARD, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: `${cfg.color}20` }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>{tx.client_name}</Text>
                    <Text style={{ fontSize: 11, color: MUTED }}>Pro : {tx.pro_name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: TEXT }}>{tx.amount.toLocaleString("fr-FR")} €</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: cfg.bg }}>
                      <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                      <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER }}>
                  <Text style={{ fontSize: 11, color: MUTED }}>Frais: {tx.fee?.toLocaleString("fr-FR") ?? "—"} €</Text>
                  <Text style={{ fontSize: 11, color: MUTED }}>Net: {tx.net_amount?.toLocaleString("fr-FR") ?? "—"} €</Text>
                  <Text style={{ fontSize: 11, color: MUTED, marginLeft: "auto" as any }}>
                    {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                  </Text>
                </View>

                {tx.status === "succeeded" && (
                  <Pressable
                    onPress={() => confirmRefund(tx)}
                    style={{ marginTop: 10, height: 34, borderRadius: 10, backgroundColor: "rgba(56,189,248,0.10)", borderWidth: 1, borderColor: "rgba(56,189,248,0.25)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                  >
                    <Ionicons name="refresh-outline" size={13} color="#38BDF8" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#38BDF8" }}>Rembourser</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
