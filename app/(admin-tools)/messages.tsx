import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl, Modal, ScrollView, TextInput, Pressable, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { adminApi, REPORT_REASONS, type AdminMessageReport } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { safeBack } from "@/lib/navigation";
import { resolveMediaUrl } from "@/lib/media";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const BG     = ADMIN.bg;
const CARD   = ADMIN.surface;
const BORDER = ADMIN.border;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;

interface AdminThread {
  id: number;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  client_name: string;
  pro_name: string;
  is_locked: boolean;
  flags_count: number;
  flags_total: number;
  last_reason_code: string | null;
  last_reason: string | null;
}

function reasonLabel(code: string | null): string {
  return REPORT_REASONS.find((r) => r.code === code)?.label ?? "Autre";
}
function reportOutcome(status: "pending" | "reviewed", outcome: "upheld" | "dismissed" | "abusive" | null): { label: string; bg: string; border: string; color: string } {
  if (status === "pending") return { label: "En attente", bg: ADMIN.dangerBg, border: ADMIN.dangerBorder, color: Colors.destructive };
  if (outcome === "abusive") return { label: "Signalement abusif", bg: ADMIN.dangerBg, border: ADMIN.dangerBorder, color: Colors.destructive };
  if (outcome === "dismissed") return { label: "Classé sans suite", bg: ADMIN.surfaceHover, border: ADMIN.border, color: TEXT3 };
  return { label: "Confirmé", bg: ADMIN.warningBg, border: ADMIN.warningBorder, color: ADMIN.warning };
}

interface AdminThreadMessage {
  id: number;
  sender_id: number | null;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
  deleted_at: string | null;
  sender_role: "client" | "pro" | null;
}

type Tab = "flagged" | "deleted";

function ThreadSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SkeletonBox width={40} height={40} borderRadius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width="50%" height={11} borderRadius={5} />
              <SkeletonBox width="70%" height={9} borderRadius={5} />
            </View>
          </View>
          <SkeletonBox width="100%" height={36} borderRadius={10} />
        </View>
      ))}
    </View>
  );
}

export default function AdminMessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("flagged");
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminThread | null>(null);
  const [detailThread, setDetailThread] = useState<AdminThread | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<AdminThread | null>(null);
  const [ignoreOutcome, setIgnoreOutcome] = useState<"dismissed" | "abusive">("dismissed");
  const [ignoreNote, setIgnoreNote] = useState("");

  const PAGE_SIZE = 30;
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin-message-threads", tab],
    queryFn: ({ pageParam }) => adminApi.getMessageThreads({
      ...(tab === "flagged" ? { flagged: true } : { deleted: true }),
      limit: PAGE_SIZE,
      page: pageParam,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + ((p.data as AdminThread[] | undefined)?.length ?? 0), 0);
      const total = lastPage.meta?.total;
      if (total == null || loaded >= total) return undefined;
      return allPages.length + 1;
    },
  });

  const threads: AdminThread[] = (data?.pages.flatMap((p) => (p.data as AdminThread[] | undefined) ?? []) ?? []) as AdminThread[];

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-message-thread-detail", detailThread?.id],
    queryFn: () => adminApi.getMessageThreadDetail(detailThread?.id ?? -1),
    enabled: detailThread != null,
  });
  const detailMessages = (detailData?.data?.messages as AdminThreadMessage[] | undefined) ?? [];
  const detailFlags = (detailData?.data?.flags as AdminMessageReport[] | undefined) ?? [];

  const invalidateBoth = () => {
    void qc.invalidateQueries({ queryKey: ["admin-message-threads", "flagged"] });
    void qc.invalidateQueries({ queryKey: ["admin-message-threads", "deleted"] });
    void qc.invalidateQueries({ queryKey: ["admin-messages-flagged"] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteMessageThread(id),
    onSuccess: () => {
      showToast("Conversation modérée, les deux participants ont été prévenus.", "success");
      invalidateBoth();
      setDeleteTarget(null);
      setDetailThread(null);
    },
    onError: () => { setDeleteTarget(null); setActionError("Impossible de modérer cette conversation."); },
  });

  const ignoreMut = useMutation({
    mutationFn: ({ id, outcome, note }: { id: number; outcome: "dismissed" | "abusive"; note?: string }) =>
      adminApi.ignoreMessageFlag(id, { outcome, note }),
    onSuccess: () => {
      showToast(
        ignoreOutcome === "abusive" ? "Signalement classé comme abusif." : "Signalement classé sans suite.",
        "success"
      );
      invalidateBoth();
      setIgnoreTarget(null);
      setIgnoreOutcome("dismissed");
      setIgnoreNote("");
    },
    onError: () => setActionError("Impossible de traiter ce signalement."),
  });

  const restoreMut = useMutation({
    mutationFn: (id: number) => adminApi.restoreMessageThread(id),
    onSuccess: () => {
      showToast("Conversation restaurée.", "success");
      invalidateBoth();
    },
    onError: () => setActionError("Impossible de restaurer cette conversation."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const listHeader = (
    <View style={{ paddingTop: insets.top, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <AnimatedIconButton
          onPress={() => safeBack(router)}
          accessibilityLabel="Retour"
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={18} color={TEXT1} />
        </AnimatedIconButton>
        <Text style={{ fontSize: 26, fontWeight: "700", color: TEXT1, letterSpacing: -0.6 }}>Messages</Text>
        {!isLoading && threads.length > 0 && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: ADMIN.dangerBg, borderWidth: 1, borderColor: ADMIN.dangerBorder }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.destructive }}>{threads.length}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 12, color: TEXT3, marginBottom: 2 }}>
        Modération sur signalement uniquement — aucune conversation n'est lue par défaut.
      </Text>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {([
          { key: "flagged" as const, label: "Signalées" },
          { key: "deleted" as const, label: "Modérées" },
        ]).map((t) => {
          const active = tab === t.key;
          return (
            <AnimatedPressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                backgroundColor: active ? ADMIN.accent : ADMIN.surfaceHover,
                borderWidth: 1, borderColor: active ? ADMIN.accent : ADMIN.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#fff" : TEXT2 }}>{t.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {actionError && <View style={{ marginTop: 8 }}><ErrorMessage message={actionError} /></View>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          {listHeader}
          <ThreadSkeleton />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          {listHeader}
          <View style={{ alignItems: "center", paddingVertical: 80, gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1 }}>Impossible de charger les conversations</Text>
            <Text style={{ fontSize: 13, color: TEXT2, textAlign: "center", paddingHorizontal: 20 }}>Vérifie ta connexion et réessaie.</Text>
            <AnimatedPressable onPress={onRefresh}>
              <Text style={{ color: ADMIN.accent, fontWeight: "700" }}>Réessayer</Text>
            </AnimatedPressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 40 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN.accent} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          ListFooterComponent={isFetchingNextPage ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={ADMIN.accent} />
            </View>
          ) : null}
          ListHeaderComponent={<View style={{ paddingHorizontal: 4 }}>{listHeader}</View>}
          ListEmptyComponent={
            tab === "flagged" ? (
              <EmptyState
                icon="shield-checkmark-outline"
                title="Aucune conversation signalée"
                description="Tous les signalements ont été traités."
              />
            ) : (
              <EmptyState
                icon="trash-outline"
                title="Aucune conversation modérée"
                description="Les conversations dont le contenu a été effacé apparaîtront ici, restaurables à tout moment."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: ADMIN.dangerBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="chatbubbles-outline" size={17} color={Colors.destructive} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT1 }} numberOfLines={1}>
                    {item.client_name} ↔ {item.pro_name}
                  </Text>
                  <Text style={{ fontSize: 11, color: TEXT3, marginTop: 2 }}>
                    {new Date(item.last_message_at ?? item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </Text>
                </View>
                {tab === "flagged" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: ADMIN.dangerBg, borderWidth: 1, borderColor: ADMIN.dangerBorder }}>
                    <Ionicons name="flag-outline" size={11} color={Colors.destructive} />
                    <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.destructive }}>{item.flags_count}</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: ADMIN.surfaceHover, borderWidth: 1, borderColor: ADMIN.border }}>
                    <Ionicons name="trash-outline" size={11} color={TEXT3} />
                    <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT3 }}>Modérée</Text>
                  </View>
                )}
              </View>

              {item.last_reason_code && (
                <View style={{ backgroundColor: ADMIN.surfaceHover, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: ADMIN.border }}>
                  <Text style={{ fontSize: 11, color: TEXT3, marginBottom: 2 }}>
                    Motif du signalement{item.flags_total > 1 ? ` (${item.flags_total} signalements au total)` : ""}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT2 }}>{reasonLabel(item.last_reason_code)}</Text>
                  {item.last_reason && (
                    <Text style={{ fontSize: 12, color: TEXT3, lineHeight: 17, marginTop: 4 }}>{item.last_reason}</Text>
                  )}
                </View>
              )}

              {item.last_message_preview && (
                <Text style={{ fontSize: 12, color: TEXT3, marginBottom: 12 }} numberOfLines={1}>
                  Dernier message : {item.last_message_preview}
                </Text>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <AnimatedPressable
                  onPress={() => setDetailThread(item)}
                  style={{ flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: ADMIN.borderStrong, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  <Ionicons name="eye-outline" size={13} color={TEXT2} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: TEXT2 }}>Voir la conversation</Text>
                </AnimatedPressable>

                {tab === "flagged" ? (
                  <AnimatedPressable
                    onPress={() => { setActionError(null); setIgnoreOutcome("dismissed"); setIgnoreNote(""); setIgnoreTarget(item); }}
                    disabled={ignoreMut.isPending}
                    style={{ flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: ADMIN.borderStrong, alignItems: "center", justifyContent: "center" }}
                  >
                    {ignoreMut.isPending
                      ? <ActivityIndicator size="small" color={TEXT2} />
                      : <Text style={{ fontSize: 12, fontWeight: "600", color: TEXT2 }}>Ignorer</Text>}
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable
                    onPress={() => { setActionError(null); restoreMut.mutate(item.id); }}
                    disabled={restoreMut.isPending}
                    style={{ flex: 1, height: 38, borderRadius: 11, backgroundColor: ADMIN.accentBg, borderWidth: 1, borderColor: ADMIN.accentBorder, alignItems: "center", justifyContent: "center" }}
                  >
                    {restoreMut.isPending
                      ? <ActivityIndicator size="small" color={ADMIN.accent} />
                      : <Text style={{ fontSize: 12, fontWeight: "700", color: ADMIN.accent }}>Restaurer</Text>}
                  </AnimatedPressable>
                )}
              </View>

              {tab === "flagged" && (
                <AnimatedPressable
                  onPress={() => { setActionError(null); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); setDeleteTarget(item); }}
                  accessibilityLabel="Modérer cette conversation"
                  style={{ marginTop: 8, height: 38, borderRadius: 11, backgroundColor: ADMIN.dangerBg, borderWidth: 1, borderColor: ADMIN.dangerBorder, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  <Ionicons name="trash-outline" size={13} color={Colors.destructive} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.destructive }}>Effacer le contenu</Text>
                </AnimatedPressable>
              )}
            </View>
          )}
        />
      )}

      {/* Détail — lecture de la conversation */}
      <Modal visible={!!detailThread} animationType="slide" onRequestClose={() => setDetailThread(null)}>
        <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <AnimatedIconButton
              onPress={() => setDetailThread(null)}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={18} color={TEXT1} />
            </AnimatedIconButton>
            <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT1 }} numberOfLines={1}>
              {detailThread ? `${detailThread.client_name} ↔ ${detailThread.pro_name}` : ""}
            </Text>
          </View>
          {detailLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={ADMIN.accent} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {detailFlags.length > 0 && (
                <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER, gap: 10, marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT1 }}>Historique des signalements</Text>
                  {detailFlags.map((f) => {
                    const outcomeBadge = reportOutcome(f.status, f.outcome);
                    return (
                    <View key={f.id} style={{ borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT2 }}>{reasonLabel(f.reason_code)}</Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: outcomeBadge.bg, borderWidth: 1, borderColor: outcomeBadge.border }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: outcomeBadge.color }}>
                            {outcomeBadge.label}
                          </Text>
                        </View>
                      </View>
                      {f.reason && <Text style={{ fontSize: 11, color: TEXT3, marginTop: 2, lineHeight: 15 }}>{f.reason}</Text>}
                      {f.admin_note && (
                        <Text style={{ fontSize: 11, color: TEXT2, marginTop: 4, lineHeight: 15, fontStyle: "italic" }}>
                          Note admin : {f.admin_note}
                        </Text>
                      )}
                      <Text style={{ fontSize: 10, color: TEXT3, marginTop: 4 }}>
                        Par {f.flagged_by_name} · {new Date(f.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                    );
                  })}
                </View>
              )}
              {detailMessages.map((m) => {
                const photoUri = !m.deleted_at ? resolveMediaUrl(m.attachment_url) : null;
                return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: m.sender_role === "pro" ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    backgroundColor: m.deleted_at ? ADMIN.surfaceHover : (m.sender_role === "pro" ? ADMIN.accentBg : CARD),
                    borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: photoUri ? 8 : 12, gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT3, textTransform: "uppercase" }}>
                    {m.sender_role === "pro" ? "Pro" : m.sender_role === "client" ? "Cliente" : "Compte supprimé"}
                  </Text>
                  {photoUri && (
                    <Image source={{ uri: photoUri }} style={{ width: 220, height: 220, borderRadius: 10 }} resizeMode="cover" />
                  )}
                  {m.deleted_at ? (
                    <Text style={{ fontSize: 13, color: TEXT3, lineHeight: 18, fontStyle: "italic" }}>Contenu effacé par modération</Text>
                  ) : m.body ? (
                    <Text style={{ fontSize: 13, color: TEXT1, lineHeight: 18 }}>{m.body}</Text>
                  ) : null}
                  <Text style={{ fontSize: 10, color: TEXT3 }}>
                    {new Date(m.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Décision sur un signalement classé sans effacer le contenu — distingue
          "infondé de bonne foi" (n'engage personne) de "abusif" (engage le
          reporter, compte vers son seuil de signalements abusifs). Note
          interne uniquement, jamais montrée aux utilisateurs. */}
      <Modal visible={!!ignoreTarget} transparent animationType="fade" onRequestClose={() => setIgnoreTarget(null)}>
        <View style={{ flex: 1, backgroundColor: ADMIN.overlay, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setIgnoreTarget(null)} />
          <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 20, width: "100%", borderWidth: 1, borderColor: BORDER, gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: TEXT1 }}>Classer ce signalement</Text>
            <Text style={{ fontSize: 13, color: TEXT3, lineHeight: 18 }}>
              {ignoreTarget ? `${ignoreTarget.client_name} ↔ ${ignoreTarget.pro_name}` : ""} — le contenu n'est pas effacé.
            </Text>

            <View style={{ gap: 8 }}>
              {([
                { key: "dismissed" as const, label: "Infondé, bonne foi", desc: "Personne n'est fautif — n'engage ni le reporter ni la personne visée." },
                { key: "abusive" as const, label: "Signalement abusif", desc: "Le signalement était mensonger — compte contre le reporter." },
              ]).map((opt) => {
                const selected = ignoreOutcome === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setIgnoreOutcome(opt.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      flexDirection: "row", alignItems: "flex-start", gap: 10,
                      borderWidth: 1.2, borderColor: selected ? ADMIN.accent : BORDER,
                      backgroundColor: selected ? ADMIN.accentBg : "transparent",
                      borderRadius: 12, padding: 12,
                    }}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={17}
                      color={selected ? ADMIN.accent : TEXT3}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? ADMIN.accent : TEXT1 }}>{opt.label}</Text>
                      <Text style={{ fontSize: 11, color: TEXT3, marginTop: 2, lineHeight: 15 }}>{opt.desc}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={ignoreNote}
              onChangeText={setIgnoreNote}
              placeholder="Note interne (optionnelle) — jamais visible par les utilisateurs"
              placeholderTextColor={TEXT3}
              multiline
              numberOfLines={3}
              style={{
                minHeight: 64, fontSize: 13, color: TEXT1,
                backgroundColor: ADMIN.surfaceHover, borderRadius: 12, padding: 12,
                textAlignVertical: "top",
              }}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <AnimatedPressable
                onPress={() => setIgnoreTarget(null)}
                disabled={ignoreMut.isPending}
                style={{ flex: 1, height: 46, borderRadius: 14, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: TEXT2, fontWeight: "700" }}>Annuler</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { if (ignoreTarget) ignoreMut.mutate({ id: ignoreTarget.id, outcome: ignoreOutcome, note: ignoreNote.trim() || undefined }); }}
                disabled={ignoreMut.isPending}
                style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: ADMIN.accentBg, borderWidth: 1, borderColor: ADMIN.accentBorder, alignItems: "center", justifyContent: "center" }}
              >
                {ignoreMut.isPending
                  ? <ActivityIndicator size="small" color={ADMIN.accent} />
                  : <Text style={{ color: ADMIN.accent, fontWeight: "800" }}>Confirmer</Text>}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Effacer le contenu de cette conversation ?"
        message={
          deleteTarget ? (
            <>{`Les messages entre ${deleteTarget.client_name} et ${deleteTarget.pro_name} seront effacés et les deux participants seront prévenus. Tu pourras restaurer depuis l'onglet "Modérées".`}</>
          ) : null
        }
        confirmLabel="Effacer"
        danger
        loading={deleteMut.isPending}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        onClose={() => setDeleteTarget(null)}
      />
    </View>
  );
}
