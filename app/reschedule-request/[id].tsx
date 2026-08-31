import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { clientApi } from "@/lib/api";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { safeBack } from "@/lib/navigation";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function RescheduleRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useStyles(colors);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reschedule-request", requestId],
    queryFn: async () => {
      const res = await clientApi.getRescheduleRequest(requestId);
      if (!res.success || !res.data) throw new Error(res.error ?? "Proposition introuvable");
      return res.data.request;
    },
    enabled: !Number.isNaN(requestId),
  });

  const finish = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    safeBack(router, "/(client)/bookings");
  };

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await clientApi.acceptRescheduleRequest(requestId);
      if (!res.success) throw new Error(res.error ?? "Impossible d'accepter cette proposition");
      return res;
    },
    onSuccess: () => {
      showToast("Nouveau créneau confirmé", "success");
      finish();
    },
    onError: (e: unknown) => setActionError(e instanceof Error ? e.message : "Une erreur est survenue"),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await clientApi.declineRescheduleRequest(requestId);
      if (!res.success) throw new Error(res.error ?? "Impossible de refuser cette proposition");
      return res;
    },
    onSuccess: () => {
      showToast("Proposition refusée, ton rendez-vous initial est inchangé", "success");
      finish();
    },
    onError: (e: unknown) => setActionError(e instanceof Error ? e.message : "Une erreur est survenue"),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.center}>
        <ErrorMessage message={error instanceof Error ? error.message : "Proposition introuvable"} />
        <Pressable onPress={() => safeBack(router, "/(client)/bookings")} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isPending = data.status === "pending" && new Date(data.expires_at).getTime() > Date.now();
  const busy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <AnimatedIconButton onPress={() => safeBack(router, "/(client)/bookings")} style={styles.headerBackBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </AnimatedIconButton>
        <Text style={styles.headerTitle}>Nouveau créneau proposé</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isPending && (
          <View style={styles.expiredBanner}>
            <Ionicons name="information-circle" size={18} color={colors.mutedForeground} />
            <Text style={styles.expiredBannerText}>
              Cette proposition n'est plus disponible ({data.status === "expired" ? "expirée" : data.status}). Ton rendez-vous initial reste inchangé.
            </Text>
          </View>
        )}

        {data.initiated_via === "phone" && (
          <View style={styles.expiredBanner}>
            <Ionicons name="call-outline" size={18} color={colors.mutedForeground} />
            <Text style={styles.expiredBannerText}>
              Proposée suite à votre échange téléphonique{data.reason ? ` : ${data.reason}` : ""}. Cela ne modifie ton rendez-vous que si tu l'acceptes ici.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Créneau actuel</Text>
          <Text style={styles.cardValue}>{formatDate(data.original_start_datetime)}</Text>
          <Text style={styles.cardValueTime}>{formatTime(data.original_start_datetime)} – {formatTime(data.original_end_datetime)}</Text>
        </View>

        <View style={styles.arrowRow}>
          <Ionicons name="arrow-down" size={22} color={colors.primary} />
        </View>

        <View style={[styles.card, styles.cardHighlight]}>
          <Text style={styles.cardLabel}>Nouveau créneau proposé</Text>
          <Text style={styles.cardValue}>{formatDate(data.proposed_start_datetime)}</Text>
          <Text style={styles.cardValueTime}>{formatTime(data.proposed_start_datetime)} – {formatTime(data.proposed_end_datetime)}</Text>
        </View>

        {actionError && <ErrorMessage message={actionError} />}

        {isPending && (
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={() => { setActionError(null); acceptMutation.mutate(); }}
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
            >
              {acceptMutation.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Accepter le nouveau créneau</Text>}
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => { setActionError(null); declineMutation.mutate(); }}
              style={[styles.secondaryBtn, busy && styles.btnDisabled]}
            >
              {declineMutation.isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryBtnText}>Refuser, garder le créneau actuel</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function useStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    headerBackBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    content: { padding: 20, gap: 16 },
    expiredBanner: { flexDirection: "row", gap: 8, backgroundColor: colors.muted, borderRadius: 12, padding: 12 },
    expiredBannerText: { flex: 1, fontSize: 13, color: colors.mutedForeground },
    card: { backgroundColor: colors.muted, borderRadius: 16, padding: 16 },
    cardHighlight: { backgroundColor: withAlpha(colors.primary, 0.1), borderWidth: 1, borderColor: colors.primary },
    cardLabel: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", marginBottom: 6 },
    cardValue: { fontSize: 16, fontWeight: "700", color: colors.foreground, textTransform: "capitalize" },
    cardValueTime: { fontSize: 14, color: colors.mutedForeground, marginTop: 2 },
    arrowRow: { alignItems: "center" },
    actions: { gap: 10, marginTop: 8 },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
    primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
    secondaryBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
    secondaryBtnText: { color: colors.foreground, fontWeight: "600", fontSize: 15 },
    btnDisabled: { opacity: 0.6 },
  });
}
