import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, FlatList,
  ActivityIndicator, RefreshControl, Animated,
} from "react-native";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { adminApi, AdminPayment } from "@/lib/api";
import { Colors, withAlpha } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { useScrollToTop } from "@react-navigation/native";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const BG     = ADMIN.bg;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;
const ACCENT = ADMIN.accent;

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
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(Math.min(index, 8) * 30),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const cfg = STATUS_CFG[tx.status];
  const isSucceeded = tx.status === "succeeded";

  return (
    <Animated.View style={{
      backgroundColor: ADMIN.surface, borderRadius: ADMIN.cardRadius, borderWidth: 1,
      borderColor: ADMIN.border, overflow: "hidden", marginBottom: 10,
      opacity, transform: [{ translateY }],
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: cfg ? withAlpha(cfg.color, 0.14) : ADMIN.surfaceHover, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Ionicons name={cfg ? cfg.icon : "card-outline"} size={18} color={cfg ? cfg.color : TEXT3} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT1, flex: 1 }} numberOfLines={1}>{tx.client_name}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: isSucceeded ? Colors.success : TEXT1, letterSpacing: -0.3, marginLeft: 8 }}>
              {Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 11, color: TEXT2 }}>
              {tx.pro_name} · {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </Text>
            {cfg ? (
              <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {(tx.fee != null || isSucceeded) && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2, gap: 12, borderTopWidth: 1, borderTopColor: ADMIN.border }}>
          {tx.fee != null && (
            <Text style={{ fontSize: 11, color: TEXT2 }}>
              Frais : {Number(tx.fee).toFixed(2)} €
            </Text>
          )}
          {tx.net_amount != null && (
            <Text style={{ fontSize: 11, color: TEXT2 }}>
              Net : {Number(tx.net_amount).toFixed(2)} €
            </Text>
          )}
          {isSucceeded && (
            <AnimatedPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onRefund(tx);
              }}
              style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: ADMIN.dangerBg }}
            >
              <Ionicons name="refresh-outline" size={12} color={ADMIN.danger} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: ADMIN.danger }}>Rembourser</Text>
            </AnimatedPressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

export default function AdminPaymentsScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<AdminPayment>>(null);
  useScrollToTop(listRef);
  const qc     = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<TxFilter>("all");
  const [refreshing, setRefreshing]     = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<AdminPayment | null>(null);

  const PAGE_SIZE = 50;
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin-payments"],
    queryFn: ({ pageParam }) => adminApi.getPayments({ limit: PAGE_SIZE, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + ((p.data as AdminPayment[] | undefined)?.length ?? 0), 0);
      const total = lastPage.meta?.total;
      if (total == null || loaded >= total) return undefined;
      return allPages.length + 1;
    },
    staleTime: 2 * 60_000,
  });

  // CA total / CA du mois viennent de l'endpoint d'agrégats, pas d'un reduce
  // sur les transactions chargées — sinon les totaux dépendent de la page en
  // cours et sous-évaluent le vrai chiffre dès qu'il y a plus de paiements
  // que PAGE_SIZE.
  const { data: analyticsData } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => adminApi.getAnalytics(),
    staleTime: 2 * 60_000,
  });
  const revenueAgg = analyticsData?.data?.revenue;

  const refundMut = useMutation({
    mutationFn: (id: number) => adminApi.refundPayment(id),
    onSuccess: () => {
      showToast("Paiement remboursé.", "success");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      setRefundTarget(null);
    },
    onError: () => {
      setRefundTarget(null);
      setPaymentError("Impossible d'effectuer le remboursement.");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const transactions = (data?.pages.flatMap((p) => (p.data as AdminPayment[] | undefined) ?? []) ?? []) as AdminPayment[];
  const totalTransactions = data?.pages[0]?.meta?.total;
  const partiallyLoaded = totalTransactions != null && totalTransactions > transactions.length;

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

  // Net total et "en attente" n'ont pas d'équivalent dans /analytics — calculés
  // sur les transactions chargées, avec un badge "partiel" si tout n'est pas chargé.
  const caTotal  = revenueAgg?.total_revenue ?? succeeded.reduce((s, t) => s + Number(t.amount), 0);
  const caMois   = revenueAgg?.month_revenue ?? thisMonth.reduce((s, t) => s + Number(t.amount), 0);
  const netTotal = succeeded.reduce((s, t) => s + Number(t.net_amount ?? 0), 0);
  const pending  = transactions.filter((t) => t.status === "pending" || t.status === "processing").length;

  const confirmRefund = (tx: AdminPayment) => {
    setPaymentError(null);
    setRefundTarget(tx);
  };

  const handleExportPDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setExporting(true);
    try {
      // L'export est un document comptable — on ne peut pas se contenter des
      // transactions déjà chargées dans la liste (pagination) sous peine de
      // sous-déclarer le CA du mois. On récupère tous les paiements réussis.
      const allSucceeded: AdminPayment[] = [];
      let page = 1;
      while (true) {
        const res = await adminApi.getPayments({ status: "succeeded", limit: 100, page });
        const batch = (res.data as AdminPayment[] | undefined) ?? [];
        allSucceeded.push(...batch);
        const total = res.meta?.total;
        if (batch.length === 0 || total == null || allSucceeded.length >= total) break;
        page += 1;
      }
      const now = new Date();
      const monthTx = allSucceeded.filter((t) => {
        const d = new Date(t.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });

      const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const total = monthTx.reduce((s, t) => s + Number(t.amount), 0).toFixed(2);

      const rows = monthTx.map((tx) => `
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
          h1 { color: #FE5D9D; font-size: 24px; margin-bottom: 4px; }
          .sub { color: #6B7280; font-size: 13px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead { background: #F7F3EF; }
          th { padding: 10px 8px; text-align: left; font-weight: 700; color: #6B7280; text-transform: uppercase; font-size: 10px; letter-spacing: 0.8px; }
          td { padding: 10px 8px; border-bottom: 1px solid #EDE7E0; }
          .total { margin-top: 20px; text-align: right; font-size: 15px; font-weight: 700; color: #FE5D9D; }
          .footer { margin-top: 40px; font-size: 10px; color: #9CA3AF; text-align: center; }
        </style></head><body>
        <h1>Blyss Admin — Transactions</h1>
        <p class="sub">${monthLabel} · ${monthTx.length} transactions</p>
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
      setPaymentError("Impossible de générer le PDF.");
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Ionicons name="cloud-offline-outline" size={40} color={TEXT3} />
        <Text style={{ color: TEXT2, fontSize: 14 }}>Impossible de charger les paiements.</Text>
        <AnimatedPressable onPress={() => void refetch()} style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: ADMIN.surfaceHover }}>
          <Text style={{ color: TEXT1, fontWeight: "600" }}>Réessayer</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Refund confirmation */}
      <ConfirmDialog
        visible={!!refundTarget}
        title="Confirmer le remboursement"
        message={
          refundTarget ? (
            <>
              {"Rembourser "}
              <Text style={{ fontWeight: "700", color: ADMIN.danger }}>
                {Number(refundTarget.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </Text>
              {` à ${refundTarget.client_name} ?\n\nCette action est irréversible.`}
            </>
          ) : null
        }
        confirmLabel="Rembourser"
        danger
        loading={refundMut.isPending}
        onConfirm={() => { if (refundTarget) refundMut.mutate(refundTarget.id); }}
        onClose={() => setRefundTarget(null)}
      />

      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(tx) => String(tx.id)}
        renderItem={({ item, index }) => <TxCard tx={item} index={index} onRefund={confirmRefund} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        ListFooterComponent={isFetchingNextPage ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator size="small" color={ACCENT} />
          </View>
        ) : null}
        ListHeaderComponent={
          <>
            {/* Page title */}
            <Text style={{ fontSize: 26, fontWeight: "700", color: TEXT1, letterSpacing: -0.5, marginBottom: 16 }}>Paiements</Text>
            {paymentError && <View style={{ marginBottom: 12 }}><ErrorMessage message={paymentError} /></View>}

            {/* Hero CA total */}
            <View style={{ borderRadius: ADMIN.cardRadius, padding: 20, marginBottom: 14, backgroundColor: ADMIN.surface, borderWidth: 1, borderColor: ADMIN.border }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: TEXT2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>CA total</Text>
              <Text style={{ fontSize: 40, fontWeight: "700", color: TEXT1, letterSpacing: -1 }}>
                {caTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </Text>
              <View style={{ flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: ADMIN.border }}>
                {[
                  { label: "Ce mois",      value: `${caMois.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €` },
                  { label: partiallyLoaded ? "Net (chargé)" : "Net total", value: `${netTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €` },
                  { label: "Transactions", value: String(totalTransactions ?? transactions.length) },
                ].map(({ label, value }, i) => (
                  <React.Fragment key={label}>
                    {i > 0 && <View style={{ width: 1, backgroundColor: ADMIN.border, marginHorizontal: 14 }} />}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: TEXT2, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>{label}</Text>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1 }}>{value}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* 3 mini-cards */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Ce mois",    value: `${caMois.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`, color: Colors.pro },
                { label: partiallyLoaded ? "Net (chargé)" : "Net total", value: `${netTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €`, color: Colors.success },
                { label: partiallyLoaded ? "Attente (chargé)" : "En attente", value: String(pending), color: Colors.warning },
              ].map(({ label, value, color }) => (
                <View key={label} style={{ flex: 1, backgroundColor: ADMIN.surface, borderRadius: ADMIN.cardRadius, padding: 14, borderWidth: 1, borderColor: ADMIN.border }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: TEXT2, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{label}</Text>
                  <Text style={{ fontSize: 17, fontWeight: "700", color, letterSpacing: -0.3 }}>{value}</Text>
                </View>
              ))}
            </View>

            {/* Section header + search + export */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: ADMIN.surfaceHover, borderRadius: 10, paddingHorizontal: 12, height: 44 }}>
                <Ionicons name="search-outline" size={16} color={TEXT3} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher client ou pro…"
                  placeholderTextColor={TEXT3}
                  style={{ flex: 1, fontSize: 13, color: TEXT1 }}
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <AnimatedIconButton onPress={() => setSearch("")} accessibilityLabel="Effacer la recherche">
                    <Ionicons name="close-circle" size={16} color={TEXT3} />
                  </AnimatedIconButton>
                )}
              </View>
              <Pressable
                onPress={handleExportPDF}
                disabled={exporting || caMois === 0}
                accessibilityLabel="Exporter les transactions en PDF"
                accessibilityRole="button"
                style={({ pressed }) => [{
                  width: 44, height: 44, borderRadius: 10, backgroundColor: ADMIN.surfaceHover,
                  alignItems: "center", justifyContent: "center",
                  opacity: (pressed || exporting || caMois === 0) ? 0.5 : 1,
                }]}
              >
                {exporting
                  ? <ActivityIndicator size="small" color={ACCENT} />
                  : <Ionicons name="share-outline" size={18} color={ACCENT} />}
              </Pressable>
            </View>

            {/* Status filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {TX_FILTERS.map((f) => {
                const cfg    = f !== "all" ? STATUS_CFG[f] : null;
                const active = statusFilter === f;
                const color  = cfg?.color ?? ACCENT;
                return (
                  <AnimatedPressable
                    key={f}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatusFilter(f); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                      backgroundColor: active ? withAlpha(color, 0.16) : ADMIN.surfaceHover }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "600", color: active ? color : TEXT2 }}>
                      {f === "all" ? "Tous" : cfg?.label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>

            {/* Section label */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1 }}>Transactions</Text>
              <Text style={{ fontSize: 11, fontWeight: "600", color: TEXT3 }}>{filtered.length}</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 80 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="card-outline" size={30} color={TEXT3} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 6 }}>Aucune transaction</Text>
            <Text style={{ fontSize: 13, color: TEXT2 }}>Rien à afficher pour ce filtre.</Text>
          </View>
        }
      />
    </View>
  );
}
