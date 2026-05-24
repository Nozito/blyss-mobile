import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, RefreshControl, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { adminApi, AdminPayment } from "@/lib/api";
import { Colors } from "@/constants/colors";

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";




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
      backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1,
      borderColor: A_BORDER, overflow: "hidden", marginBottom: 10,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
      opacity, transform: [{ translateY }],
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
        {/* Icon */}
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: cfg ? `${cfg.color}15` : A_BG, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ionicons name={cfg ? cfg.icon : "card-outline"} size={18} color={cfg ? cfg.color : Colors.mutedForeground} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.foreground, flex: 1 }} numberOfLines={1}>{tx.client_name}</Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: isSucceeded ? Colors.success : Colors.foreground, letterSpacing: -0.5, marginLeft: 8 }}>
              {Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
              {tx.pro_name} · {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </Text>
            {cfg ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${cfg.color}18` }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: cfg.color }}>{cfg.label}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {(tx.fee != null || isSucceeded) && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2, gap: 12 }}>
          {tx.fee != null && (
            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
              Frais : {Number(tx.fee).toFixed(2)} €
            </Text>
          )}
          {tx.net_amount != null && (
            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
              Net : {Number(tx.net_amount).toFixed(2)} €
            </Text>
          )}
          {isSucceeded && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onRefund(tx);
              }}
              style={{ marginLeft: "auto" as any, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: `${Colors.destructive}10`, borderWidth: 1, borderColor: `${Colors.destructive}28` }}
            >
              <Ionicons name="refresh-outline" size={12} color={Colors.destructive} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.destructive }}>Rembourser</Text>
            </Pressable>
          )}
        </View>
      )}
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

  const caTotal  = succeeded.reduce((s, t) => s + Number(t.amount), 0);
  const caMois   = thisMonth.reduce((s, t) => s + Number(t.amount), 0);
  const netTotal = succeeded.reduce((s, t) => s + Number(t.net_amount ?? 0), 0);
  const pending  = transactions.filter((t) => t.status === "pending" || t.status === "processing").length;

  const confirmRefund = (tx: AdminPayment) =>
    Alert.alert(
      "Rembourser",
      `Rembourser ${Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € à ${tx.client_name} ?\n\nCette action est irréversible.`,
      [
        { text: "Annuler",    style: "cancel" },
        { text: "Rembourser", style: "destructive", onPress: () => refundMut.mutate(tx.id) },
      ],
    );

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
      <View style={{ flex: 1, backgroundColor: A_BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.admin} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: A_BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} colors={[Colors.admin]} />}
      >
        {/* Hero CA total */}
        <LinearGradient
          colors={["#EA6000", "#F97316", "#FBAB6A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 20, padding: 20, marginBottom: 14, overflow: "hidden" }}
        >
          <View style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>CA Total</Text>
          <Text style={{ fontSize: 40, fontWeight: "900", color: Colors.white, letterSpacing: -1 }}>
            {caTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{transactions.length} transaction(s) au total</Text>
        </LinearGradient>

        {/* 3 mini-cards */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Ce mois",    value: `${caMois.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`, color: Colors.pro },
            { label: "Net total",  value: `${netTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`, color: Colors.success },
            { label: "En attente", value: String(pending), color: Colors.warning },
          ].map(({ label, value, color }) => (
            <View key={label} style={{ flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: A_BORDER, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{label}</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color, letterSpacing: -0.5 }}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Section header + search + export */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: A_BORDER }}>
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
          <Pressable
            onPress={handleExportPDF}
            disabled={exporting || thisMonth.length === 0}
            style={({ pressed }) => [{
              width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.card,
              borderWidth: 1, borderColor: A_BORDER, alignItems: "center", justifyContent: "center",
              opacity: (pressed || exporting || thisMonth.length === 0) ? 0.5 : 1,
              shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
            }]}
          >
            {exporting
              ? <ActivityIndicator size="small" color={Colors.admin} />
              : <Ionicons name="share-outline" size={18} color={Colors.admin} />}
          </Pressable>
        </View>

        {/* Status filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
          {TX_FILTERS.map((f) => {
            const cfg    = f !== "all" ? STATUS_CFG[f] : null;
            const active = statusFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatusFilter(f); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? (cfg?.color ?? Colors.admin) : Colors.card,
                  borderColor: active ? (cfg?.color ?? Colors.admin) : A_BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? Colors.white : Colors.mutedForeground }}>
                  {f === "all" ? "Tous" : cfg?.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Section label */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: Colors.admin }} />
          <Text style={{ fontSize: 13, fontWeight: "900", color: Colors.foreground }}>Transactions</Text>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: A_BG, borderWidth: 1, borderColor: A_BORDER }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground }}>{filtered.length}</Text>
          </View>
        </View>

        {/* Transactions */}
        {filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 80 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="card-outline" size={32} color={A_BORDER} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>Aucune transaction</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Rien à afficher pour ce filtre.</Text>
          </View>
        ) : (
          filtered.map((tx, i) => (
            <TxCard key={tx.id} tx={tx} index={i} onRefund={confirmRefund} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
