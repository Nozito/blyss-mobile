import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/lib/api";

interface Transaction {
  id: number;
  booking_id: number;
  client_name: string;
  pro_name: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: "success" | "pending" | "failed" | "refunded";
  created_at: string;
}

const STATUS_CONFIG = {
  success: { label: "Réussi", icon: "checkmark-circle-outline" as const, color: "#22C55E", bg: "#F0FDF4" },
  pending: { label: "En attente", icon: "time-outline" as const, color: "#F59E0B", bg: "#FFFBEB" },
  failed: { label: "Échoué", icon: "close-circle-outline" as const, color: "#EF4444", bg: "#FEF2F2" },
  refunded: { label: "Remboursé", icon: "refresh-outline" as const, color: "#3B82F6", bg: "#EFF6FF" },
};

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await adminApi.getPayments?.();
      setTransactions((res?.data || []) as Transaction[]);
    } catch {
      // silently fail — display empty state
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || t.client_name.toLowerCase().includes(q) || t.pro_name.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: transactions.filter((t) => t.status === "success").reduce((s, t) => s + t.amount, 0),
    fees: transactions.filter((t) => t.status === "success").reduce((s, t) => s + t.fee, 0),
    net: transactions.filter((t) => t.status === "success").reduce((s, t) => s + t.net_amount, 0),
    pending: transactions.filter((t) => t.status === "pending").length,
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.admin} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 80,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300).springify()} className="mb-6">
        <Text className="text-2xl font-bold text-foreground">Paiements</Text>
        <Text className="text-sm text-muted-foreground mt-1">{filtered.length} transaction(s)</Text>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.duration(300).delay(60).springify()} className="flex-row flex-wrap gap-3 mb-6">
        {[
          { label: "CA total", value: `${stats.total.toLocaleString("fr-FR")} €`, color: Colors.admin, bg: "#FFF7ED" },
          { label: "Frais", value: `${stats.fees.toLocaleString("fr-FR")} €`, color: "#6B7280", bg: Colors.muted },
          { label: "Net", value: `${stats.net.toLocaleString("fr-FR")} €`, color: "#22C55E", bg: "#F0FDF4" },
          { label: "En attente", value: String(stats.pending), color: "#F59E0B", bg: "#FFFBEB" },
        ].map((stat, i) => (
          <View
            key={i}
            className="flex-1 rounded-2xl p-4 border border-border"
            style={{ backgroundColor: stat.bg, minWidth: "44%" }}
          >
            <Text className="text-xs text-muted-foreground mb-1">{stat.label}</Text>
            <Text className="text-xl font-black" style={{ color: stat.color }}>{stat.value}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Filters */}
      <Animated.View entering={FadeInDown.duration(300).delay(100).springify()} className="mb-4 gap-3">
        <View className="flex-row items-center bg-card rounded-xl px-4 h-11 border border-border gap-3">
          <Ionicons name="search-outline" size={18} color={Colors.mutedForeground} />
          <TextInput
            className="flex-1 text-foreground text-sm"
            placeholder="Rechercher client ou pro..."
            placeholderTextColor={Colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: "all", label: "Tous" },
            { id: "success", label: "Réussis" },
            { id: "pending", label: "En attente" },
            { id: "failed", label: "Échoués" },
            { id: "refunded", label: "Remboursés" },
          ].map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setStatusFilter(f.id)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: statusFilter === f.id ? Colors.admin : Colors.muted }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: statusFilter === f.id ? Colors.white : Colors.mutedForeground }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Transaction list */}
      <View className="gap-3">
        {filtered.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(140).springify()} className="items-center py-12">
            <Ionicons name="card-outline" size={48} color={Colors.border} />
            <Text className="text-muted-foreground mt-3">Aucune transaction trouvée</Text>
          </Animated.View>
        ) : (
          filtered.map((tx, idx) => {
            const cfg = STATUS_CONFIG[tx.status];
            return (
              <Animated.View
                key={tx.id}
                entering={FadeInDown.duration(250).delay(140 + idx * 40).springify()}
                className="bg-card rounded-2xl p-4 border border-border"
                style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-semibold text-foreground">{tx.client_name}</Text>
                    <Text className="text-xs text-muted-foreground">Pro : {tx.pro_name}</Text>
                  </View>
                  <View>
                    <Text className="text-lg font-black text-foreground text-right">
                      {tx.amount.toLocaleString("fr-FR")} €
                    </Text>
                    <View
                      className="flex-row items-center gap-1 px-2 py-1 rounded-lg mt-1"
                      style={{ backgroundColor: cfg.bg }}
                    >
                      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                      <Text className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-4 pt-2 border-t border-border">
                  <Text className="text-xs text-muted-foreground">
                    Frais : {tx.fee?.toLocaleString("fr-FR") ?? "—"} €
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Net : {tx.net_amount?.toLocaleString("fr-FR") ?? "—"} €
                  </Text>
                  <Text className="text-xs text-muted-foreground ml-auto">
                    {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                  </Text>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
