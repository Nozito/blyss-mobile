import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl, Modal, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { safeBack } from "@/lib/navigation";
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
  flags_count: number;
  last_reason: string | null;
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-message-threads", tab],
    queryFn: () => adminApi.getMessageThreads(tab === "flagged" ? { flagged: true } : { deleted: true }),
  });

  const threads: AdminThread[] = ((data?.data as AdminThread[] | undefined) ?? []);

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-message-thread-detail", detailThread?.id],
    queryFn: () => adminApi.getMessageThreadDetail(detailThread!.id),
    enabled: !!detailThread,
  });
  const detailMessages = (detailData?.data?.messages as AdminThreadMessage[] | undefined) ?? [];

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
    mutationFn: (id: number) => adminApi.ignoreMessageFlag(id),
    onSuccess: () => {
      showToast("Signalement ignoré.", "success");
      invalidateBoth();
    },
    onError: () => setActionError("Impossible d'ignorer ce signalement."),
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

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
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

      {isLoading ? (
        <ThreadSkeleton />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 40 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN.accent} />}
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

              {item.last_reason && (
                <View style={{ backgroundColor: ADMIN.surfaceHover, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: ADMIN.border }}>
                  <Text style={{ fontSize: 11, color: TEXT3, marginBottom: 2 }}>Motif du signalement</Text>
                  <Text style={{ fontSize: 13, color: TEXT2, lineHeight: 18 }}>{item.last_reason}</Text>
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
                    onPress={() => { setActionError(null); ignoreMut.mutate(item.id); }}
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
              {detailMessages.map((m) => (
                <View
                  key={m.id}
                  style={{
                    alignSelf: m.sender_role === "pro" ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                    backgroundColor: m.deleted_at ? ADMIN.surfaceHover : (m.sender_role === "pro" ? ADMIN.accentBg : CARD),
                    borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 12,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: TEXT3, marginBottom: 4, textTransform: "uppercase" }}>
                    {m.sender_role === "pro" ? "Pro" : m.sender_role === "client" ? "Cliente" : "Compte supprimé"}
                  </Text>
                  <Text style={{ fontSize: 13, color: m.deleted_at ? TEXT3 : TEXT1, lineHeight: 18, fontStyle: m.deleted_at ? "italic" : "normal" }}>
                    {m.deleted_at ? "Contenu effacé par modération" : (m.body || (m.attachment_url ? "📷 Photo" : ""))}
                  </Text>
                  <Text style={{ fontSize: 10, color: TEXT3, marginTop: 6 }}>
                    {new Date(m.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
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
