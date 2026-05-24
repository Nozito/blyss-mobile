import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Animated,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
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
  const isSucceeded = tx.status === "succeeded";

  return (
    <Animated.View style={{
      backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1,
      borderColor: cfg ? `${cfg.color}20` : Colors.border, overflow: "hidden", marginBottom: 10,
      shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
      opacity, transform: [{ translateY }],
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.foreground, marginBottom: 2 }}>{tx.client_name}</Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 6 }}>Pro · {tx.pro_name}</Text>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
            {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: isSucceeded ? Colors.success : Colors.foreground, letterSpacing: -0.8 }}>
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

      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 16 }}>
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
          Frais : {tx.fee != null ? `${Number(tx.fee).toFixed(2)} €` : "—"}
        </Text>
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
          Net : {tx.net_amount != null ? `${Number(tx.net_amount).toFixed(2)} €` : "—"}
        </Text>
        {isSucceeded && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onRefund(tx);
            }}
            style={{ marginLeft: "auto" as any, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: `${Colors.destructive}10`, borderWidth: 1, borderColor: `${Colors.destructive}28` }}
          >
            <Ionicons name="refresh-outline" size={12} color={Colors.destructive} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.destructive }}>Rembourser</Text>
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
  const [exporting, setExporting]       = useState(false);

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
    { label: "CA total",    value: `${succeeded.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: Colors.admin },
    { label: "CA ce mois",  value: `${thisMonth.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: Colors.pro },
    { label: "Transactions", value: String(transactions.length), color: Colors.info },
    { label: "En attente",  value: String(transactions.filter((t) => t.status === "pending" || t.status === "processing").length), color: Colors.warning },
    { label: "Net total",   value: `${succeeded.reduce((s, t) => s + Number(t.net_amount ?? 0), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, color: Colors.success },
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

  // Native PDF export — expo-print + expo-sharing
  const handleExportPDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setExporting(true);
    try {
      const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const total = thisMonth.reduce((s, t) => s + Number(t.amount), 0).toFixed(2);

      const rows = thisMonth.map((tx) => `
        <tr>
          <td>${tx.client_name}</td>
          <td>${tx.pro_name}</td>
          <td>${new Date(tx.created_at).toLocaleDateString("fr-FR")}</td>
          <td style="text-align:right;font-weight:700;color:#22C55E">${Number(tx.amount).toFixed(2)} €</td>
          <td>${tx.status}</td>
        </tr>
      `).join("");

      const html = `
        <!DOCTYPE html><html><head><meta charset="utf-8">
        <style>
          body { font-family: -apple-system, Arial, sans-serif; padding: 32px; color: #09090B; }
          h1 { color: #F97316; font-size: 24px; margin-bottom: 4px; }
          .sub { color: #6B7280; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead { background: #F7F3EF; }
          th { padding: 10px 8px; text-align: left; font-weight: 700; color: #6B7280; text-transform: uppercase; font-size: 10px; letter-spacing: 0.8px; }
          td { padding: 10px 8px; border-bottom: 1px solid #EDE7E0; }
          .total { margin-top: 20px; text-align: right; font-size: 15px; font-weight: 700; color: #F97316; }
          .footer { margin-top: 40px; font-size: 10px; color: #9CA3AF; text-align: center; }
        </style></head><body>
        <h1>Blyss Admin — Transactions</h1>
        <p class="sub">${monthLabel} · ${thisMonth.length} transactions</p>
        <table>
          <thead><tr><th>Client</th><th>Pro</th><th>Date</th><th style="text-align:right">Montant</th><th>Statut</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="total">Total : ${total} €</p>
        <p class="footer">Généré par Blyss Admin · ${new Date().toLocaleString("fr-FR")}</p>
        </body></html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Exporter les transactions" });
    } catch {
      Alert.alert("Erreur", "Impossible de générer le PDF.");
    } finally {
      setExporting(false);
    }
  };

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
        {/* KPI strip + export button */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
            {kpis.map((k, i) => (
              <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} index={i} />
            ))}
          </ScrollView>
          <Pressable
            onPress={handleExportPDF}
            disabled={exporting || thisMonth.length === 0}
            style={({ pressed }) => [{
              width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card,
              borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center",
              opacity: (pressed || exporting || thisMonth.length === 0) ? 0.5 : 1,
              shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
            }]}
          >
            {exporting
              ? <ActivityIndicator size="small" color={Colors.admin} />
              : <Ionicons name="share-outline" size={18} color={Colors.admin} />}
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border }}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher client ou pro…"
              placeholderTextColor={Colors.mutedForeground}
              style={{ flex: 1, fontSize: 13, color: Colors.foreground }}
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
            />
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
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? (cfg?.color ?? Colors.admin) : Colors.muted,
                  borderColor: active ? (cfg?.color ?? Colors.admin) : Colors.border }}
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
