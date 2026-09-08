import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl, FlatList,
  Modal, Platform, Share,
} from "react-native";
import { useActionSheet } from "@/components/ui/ActionSheet";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser, AdminMessageReport, REPORT_REASONS } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors, withAlpha } from "@/constants/colors";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { ADMIN } from "@/constants/adminTheme";
import { useScrollToTop } from "@react-navigation/native";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SectionLabel } from "@/components/admin/SectionLabel";
import { ActionGrid } from "@/components/admin/ActionGrid";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/admin/Card";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/admin/Avatar";
import { GrantSubscriptionModal } from "@/components/admin/GrantSubscriptionModal";
import { formatEUR, formatNumberFR, formatPercentFR } from "@/lib/format";

type RoleFilter = "all" | "pro" | "client" | "banned";

const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };

function roleName(user: Pick<AdminUser, "is_admin" | "role">) {
  if (user.is_admin) return "Admin";
  if (user.role === "pro") return "Pro";
  return "Client";
}
function getActivePlan(user: AdminUser): string | null {
  const active = (user.subscription_history ?? []).find((s) => s.status === "active");
  return active ? (PLAN_LABELS[active.plan] ?? active.plan) : null;
}
function joinedDate(user: AdminUser): string | null {
  if (!user.created_at) return null;
  return new Date(user.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}
function reasonLabel(code: string): string {
  return REPORT_REASONS.find((r) => r.code === code)?.label ?? "Autre";
}
function reportOutcome(status: "pending" | "reviewed", outcome: "upheld" | "dismissed" | "abusive" | null): { label: string; tone: "danger" | "warning" | "neutral" } {
  if (status === "pending") return { label: "En attente", tone: "danger" };
  if (outcome === "abusive") return { label: "Abusif", tone: "danger" };
  if (outcome === "dismissed") return { label: "Classé sans suite", tone: "neutral" };
  return { label: "Confirmé", tone: "warning" };
}

const MAX_REPORTS_SHOWN = 3;

// Une ligne de signalement — carte multi-lignes, pas un Row à sous-titre géant.
function ReportRow({ r, dir, showDivider }: {
  r: AdminMessageReport;
  dir: "against" | "made";
  showDivider: boolean;
}) {
  const oc = reportOutcome(r.status, r.outcome);
  const who = dir === "against" ? r.flagged_by_name : r.reported_user_name;
  return (
    <View style={{ padding: 12, borderBottomWidth: showDivider ? 1 : 0, borderBottomColor: ADMIN.border, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ ...ADMIN.type.name, fontSize: 13, color: ADMIN.text, flex: 1 }} numberOfLines={1}>{reasonLabel(r.reason_code)}</Text>
        <StatusBadge label={oc.label} tone={oc.tone} />
      </View>
      <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }} numberOfLines={1}>
        {dir === "against" ? "Par" : "Contre"} {who ?? "—"} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
      </Text>
      {!!r.reason && <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }} numberOfLines={2}>{r.reason}</Text>}
      {!!r.admin_note && <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, fontStyle: "italic" }} numberOfLines={2}>Note : {r.admin_note}</Text>}
    </View>
  );
}

function ReportBlock({ label, items, dir }: { label: string; items: AdminMessageReport[]; dir: "against" | "made" }) {
  const shown = items.slice(0, MAX_REPORTS_SHOWN);
  const rest = items.length - shown.length;
  return (
    <>
      <SectionLabel>{`${label} (${items.length})`}</SectionLabel>
      <Card style={{ padding: 0 }}>
        {shown.map((r, i) => (
          <ReportRow key={r.id} r={r} dir={dir} showDivider={i < shown.length - 1} />
        ))}
      </Card>
      {rest > 0 && (
        <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginTop: 6 }}>
          + {rest} autre{rest > 1 ? "s" : ""} — voir Modération
        </Text>
      )}
    </>
  );
}

// ── Skeleton — same card shape as the real rows, so the layout doesn't jump ──
function UserSkeleton() {
  return (
    <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.md }}>
      <SkeletonBox width="100%" height={72} borderRadius={ADMIN.cardRadius} style={{ marginBottom: ADMIN.space.xl }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{
          flexDirection: "row", alignItems: "center", gap: ADMIN.space.md,
          backgroundColor: ADMIN.surface, borderRadius: ADMIN.cardRadius, borderWidth: 1, borderColor: ADMIN.border,
          padding: ADMIN.space.lg, marginBottom: ADMIN.space.md,
        }}>
          <SkeletonBox width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="55%" height={13} borderRadius={6} />
            <SkeletonBox width="70%" height={10} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── User detail bottom sheet ───────────────────────────────────────────────────
function UserDetailSheet({ user, onGrant, onClose }: { user: AdminUser; onGrant: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"ban" | "delete" | null>(null);

  const { data: fullData, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-user", user.id],
    queryFn:  () => adminApi.getUser(user.id),
    staleTime: 60_000,
  });
  const full    = (fullData?.data as AdminUser | undefined) ?? user;
  const stats   = full.stats;
  const planStr = getActivePlan(full);
  // fullData existe mais success=false → l'endpoint détail a échoué (500, DB…).
  const detailError = fullData && !fullData.success ? (fullData.error ?? "Erreur inconnue") : null;

  const banMut = useMutation({
    mutationFn: () => adminApi.banUser(user.id),
    onSuccess: () => {
      showToast(`${full.first_name} a été banni.`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      setConfirmAction(null);
      onClose();
    },
    onError: () => { setConfirmAction(null); setSheetError("Impossible de bannir cet utilisateur."); },
  });
  const unbanMut = useMutation({
    mutationFn: () => adminApi.unbanUser(user.id),
    onSuccess: () => {
      showToast(`${full.first_name} a été réactivé.`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onClose();
    },
    onError: () => setSheetError("Impossible de réactiver cet utilisateur."),
  });
  const deleteMut = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => {
      showToast(`${full.first_name} a été supprimé.`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmAction(null);
      onClose();
    },
    onError: () => { setConfirmAction(null); setSheetError("Impossible de supprimer cet utilisateur."); },
  });
  const updateRoleMut = useMutation({
    mutationFn: (newRole: "client" | "pro") => adminApi.updateUser(user.id, { role: newRole }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
    },
    onError: () => setSheetError("Impossible de modifier le rôle."),
  });

  const handleShareEmail = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Share.share({ message: full.email });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: ADMIN.overlay }}
          onPress={onClose}
        />
        <View style={{ backgroundColor: ADMIN.surface, borderTopLeftRadius: ADMIN.sheetRadius, borderTopRightRadius: ADMIN.sheetRadius, maxHeight: "92%" }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: ADMIN.sheetHandle, alignSelf: "center", marginTop: ADMIN.space.md }} />
          <ScrollView contentContainerStyle={{ paddingBottom: ADMIN.space.xxl }} showsVerticalScrollIndicator={false}>
            {/* Identity */}
            <View style={{ paddingTop: ADMIN.space.sm, paddingBottom: ADMIN.space.xl, paddingHorizontal: ADMIN.space.xl, alignItems: "center", borderBottomWidth: 1, borderBottomColor: ADMIN.border }}>
              <View style={{ marginBottom: ADMIN.space.md }}>
                <Avatar name={`${full.first_name} ${full.last_name}`} photo={full.profile_photo} size={56} />
              </View>
              <Text style={{ ...ADMIN.type.name, color: ADMIN.text, marginBottom: ADMIN.space.sm }}>{full.first_name} {full.last_name}</Text>
              <View style={{ flexDirection: "row", gap: ADMIN.space.sm, flexWrap: "wrap", justifyContent: "center", marginBottom: ADMIN.space.sm }}>
                <StatusBadge label={full.is_admin ? "Admin" : roleName(full)} tone="neutral" />
                {planStr && <StatusBadge label={planStr} tone="warning" />}
                {full.reports?.is_vigilant && <StatusBadge label={`Vigilance · ${full.reports.reported_count} signalements`} tone="warning" />}
                {full.reports?.is_abusive_reporter && <StatusBadge label={`Reporter à risque · ${full.reports.made_abusive_count} abusifs`} tone="danger" />}
                {!full.is_active && <StatusBadge label="Banni" tone="danger" />}
              </View>
              <AnimatedPressable onPress={handleShareEmail} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="mail-outline" size={13} color={ADMIN.textMuted} />
                <Text style={{ ...ADMIN.type.label, color: ADMIN.textSub }}>{full.email}</Text>
                <Ionicons name="share-outline" size={12} color={ADMIN.textMuted} />
              </AnimatedPressable>
              <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={{ position: "absolute", top: 10, right: 20, width: 32, height: 32, borderRadius: 4, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={ADMIN.textSub} />
              </AnimatedIconButton>
            </View>

            {detailLoading && !fullData && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.lg, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator size="small" color={ADMIN.textMuted} />
                <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub }}>Chargement de la fiche…</Text>
              </View>
            )}
            {detailError && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.lg }}>
                <View style={{ borderWidth: 1, borderColor: ADMIN.dangerBorder, backgroundColor: ADMIN.dangerBg, padding: 12 }}>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.danger, marginBottom: 4 }}>Fiche détaillée indisponible</Text>
                  <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }}>{detailError}</Text>
                </View>
              </View>
            )}

            {/* Activité pro — agrégats métier (avis, résa réalisées, clientèle, abo) */}
            {full.role === "pro" && full.pro_activity && (() => {
              const pa = full.pro_activity;
              const statCard = (label: string, value: string, sub?: string) => (
                <Card style={{ flex: 1 }}>
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 4 }} numberOfLines={1}>{label}</Text>
                  <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{value}</Text>
                  {sub ? <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub, marginTop: 2 }} numberOfLines={1}>{sub}</Text> : null}
                </Card>
              );
              return (
                <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.lg }}>
                  <SectionLabel>Activité pro</SectionLabel>
                  <View style={{ gap: ADMIN.space.md }}>
                    <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                      {statCard("Note", pa.reviews.avg != null ? `${pa.reviews.avg.toFixed(1).replace(".", ",")} ★` : "—", `${formatNumberFR(pa.reviews.count)} avis`)}
                      {statCard("CA ce mois", formatEUR(pa.bookings.gmv_month))}
                    </View>
                    <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                      {statCard("Complétion", formatPercentFR(pa.bookings.completion_rate), `${formatNumberFR(pa.bookings.completed)} terminées`)}
                      {statCard("Annulation", formatPercentFR(pa.bookings.cancellation_rate), `${formatNumberFR(pa.bookings.cancelled)} annulées`)}
                    </View>
                    <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                      {statCard("Clientèle", formatNumberFR(pa.clients.distinct), `${formatNumberFR(pa.clients.recurring)} récurrentes`)}
                      {statCard("CA généré", formatEUR(pa.bookings.gmv_total), `${formatNumberFR(pa.bookings.total)} réservations`)}
                    </View>
                    <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ADMIN.space.md }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...ADMIN.type.name, color: ADMIN.text }} numberOfLines={1}>
                          {pa.subscription
                            ? `Abonnement ${PLAN_LABELS[pa.subscription.plan] ?? pa.subscription.plan}`
                            : "Aucun abonnement"}
                        </Text>
                        {pa.subscription?.start_date && (
                          <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginTop: 3 }} numberOfLines={1}>
                            depuis {new Date(pa.subscription.start_date).toLocaleDateString("fr-FR", { month: "2-digit", year: "numeric" })}
                          </Text>
                        )}
                      </View>
                      {pa.subscription && (
                        <StatusBadge
                          label={pa.subscription.is_granted ? "Offert" : "Payé"}
                          tone={pa.subscription.is_granted ? "warning" : "success"}
                        />
                      )}
                    </Card>
                  </View>
                </View>
              );
            })()}

            {/* Stats génériques — pour un client, ou en repli si le backend ne
                renvoie pas encore pro_activity (déploiement en cours). */}
            {stats && !(full.role === "pro" && full.pro_activity) && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.lg, gap: ADMIN.space.md }}>
                <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 4 }} numberOfLines={1}>Réservations</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{formatNumberFR(stats.total_bookings)}</Text>
                  </Card>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 4 }} numberOfLines={1}>Terminées</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{formatNumberFR(stats.completed)}</Text>
                  </Card>
                </View>
                <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 4 }} numberOfLines={1}>Annulées</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{formatNumberFR(stats.cancelled)}</Text>
                  </Card>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 4 }} numberOfLines={1}>Dépensé</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{formatEUR(stats.total_spent)}</Text>
                  </Card>
                </View>
              </View>
            )}

            {/* Signalements — dans les deux sens, pour décider d'un bannissement
                d'un coup d'œil. Listes plafonnées à 3, le détail est dans Modération. */}
            {(full.reports?.against.length ?? 0) > 0 && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.xl }}>
                <ReportBlock label="Signalements reçus" items={full.reports!.against} dir="against" />
              </View>
            )}
            {(full.reports?.made.length ?? 0) > 0 && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.xl }}>
                <ReportBlock label="Signalements effectués" items={full.reports!.made} dir="made" />
                <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginTop: 6 }}>
                  {`${full.reports?.made_abusive_count ?? 0} abusif(s)`}
                </Text>
              </View>
            )}

            {sheetError && <View style={{ paddingHorizontal: ADMIN.space.xl, marginTop: ADMIN.space.md }}><ErrorMessage message={sheetError} /></View>}

            {/* Actions — icon grid, 3 per row, each wired to a real handler below */}
            <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.xl }}>
              <SectionLabel>Actions</SectionLabel>
              <Card>
                <ActionGrid
                  tiles={[
                    { key: "email", icon: "mail-outline", tone: "neutral", label: "Email", onPress: handleShareEmail },
                    { key: "grant", icon: "gift-outline", tone: "accent", label: "Abonnement", onPress: () => { onClose(); onGrant(); } },
                    ...(!full.is_admin ? [{
                      key: "role", icon: "swap-horizontal-outline" as const, tone: "accent" as const,
                      label: full.role === "pro" ? "→ Client" : "→ Pro",
                      loading: updateRoleMut.isPending,
                      onPress: () => {
                        const newRole = full.role === "pro" ? "client" : "pro";
                        setSheetError(null);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        updateRoleMut.mutate(newRole);
                      },
                    }] : []),
                    full.is_active
                      ? { key: "ban", icon: "ban-outline", tone: "warning", label: "Bannir", onPress: () => { setSheetError(null); setConfirmAction("ban"); } }
                      : { key: "unban", icon: "checkmark-circle-outline", tone: "success", label: "Réactiver", loading: unbanMut.isPending, onPress: () => unbanMut.mutate() },
                    { key: "delete", icon: "trash-outline", tone: "danger", label: "Supprimer", onPress: () => { setSheetError(null); setConfirmAction("delete"); } },
                  ]}
                />
              </Card>
            </View>
          </ScrollView>
        </View>
      </View>

      <ConfirmDialog
        visible={confirmAction === "ban"}
        title="Bannir cet utilisateur ?"
        message={<>{`${full.first_name} ${full.last_name} ne pourra plus se connecter à Blyss tant qu'il n'est pas réactivé.`}</>}
        confirmLabel="Bannir"
        danger
        loading={banMut.isPending}
        onConfirm={() => banMut.mutate()}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        visible={confirmAction === "delete"}
        title="Supprimer définitivement ?"
        message={<>{`${full.first_name} ${full.last_name} et toutes ses données associées seront supprimés. `}<Text style={{ fontWeight: "800", color: ADMIN.danger }}>Cette action est irréversible.</Text></>}
        confirmLabel="Supprimer"
        danger
        loading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setConfirmAction(null)}
      />
    </Modal>
  );
}

// ── User card (with swipe actions) — one bordered card per row, not a hairline list ──
function UserCard({ item, onPress, onLongPress, onBan, onDelete, onGrant }: {
  item:        AdminUser;
  onPress:     () => void;
  onLongPress: () => void;
  onBan:       () => void;
  onDelete:    () => void;
  onGrant:     () => void;
}) {
  const name   = `${item.first_name} ${item.last_name}`;
  const plan   = getActivePlan(item);
  const joined = joinedDate(item);
  const swipeRef = useRef<Swipeable>(null);
  const meta = [plan, joined ? `depuis ${joined}` : null].filter(Boolean).join(" · ") || undefined;

  // Soft tint + colored content — the same tone language as StatusBadge/Card,
  // not a solid-fill strip. A border on the outer edge keeps it legible against
  // the screen background without resorting to a loud block of color.
  const renderRightActions = () => (
    <View style={{ flexDirection: "row", marginBottom: ADMIN.space.md, borderTopRightRadius: ADMIN.cardRadius, borderBottomRightRadius: ADMIN.cardRadius, overflow: "hidden" }}>
      <Pressable onPress={() => { swipeRef.current?.close(); onBan(); }}
        style={{ width: 76, backgroundColor: item.is_active ? ADMIN.warningBg : ADMIN.successBg, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={20} color={item.is_active ? ADMIN.warning : ADMIN.success} />
        <Text style={{ color: item.is_active ? ADMIN.warning : ADMIN.success, fontSize: 11, fontWeight: "700" }}>{item.is_active ? "Bannir" : "Réactiver"}</Text>
      </Pressable>
      <Pressable onPress={() => { swipeRef.current?.close(); onDelete(); }}
        style={{ width: 76, backgroundColor: ADMIN.dangerBg, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name="trash-outline" size={20} color={ADMIN.danger} />
        <Text style={{ color: ADMIN.danger, fontSize: 11, fontWeight: "700" }}>Suppr.</Text>
      </Pressable>
    </View>
  );

  const renderLeftActions = () => (
    <Pressable onPress={() => { swipeRef.current?.close(); onGrant(); }} style={{ width: 86, marginBottom: ADMIN.space.md, borderTopLeftRadius: ADMIN.cardRadius, borderBottomLeftRadius: ADMIN.cardRadius, overflow: "hidden" }}>
      <View style={{ flex: 1, backgroundColor: ADMIN.accentBg, alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name="gift-outline" size={20} color={ADMIN.accent} />
        <Text style={{ color: ADMIN.accent, fontSize: 11, fontWeight: "700" }}>Abonnement</Text>
      </View>
    </Pressable>
  );

  return (
    <Swipeable ref={swipeRef}
      renderRightActions={item.is_admin ? undefined : renderRightActions}
      renderLeftActions={item.is_admin ? undefined : renderLeftActions}
      overshootRight={false} overshootLeft={false} friction={2}>
      <AnimatedPressable onPress={onPress} onLongPress={onLongPress}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.md, marginBottom: ADMIN.space.md, opacity: item.is_active ? 1 : 0.55 }}>
          <Avatar name={name} photo={item.profile_photo} size={44} pro={item.role === "pro"} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ ...ADMIN.type.name, color: ADMIN.text, flex: 1 }} numberOfLines={1}>{name}</Text>
              {item.is_vigilant && <StatusBadge label="Vigilance" tone="warning" />}
              {item.is_abusive_reporter && <StatusBadge label="Reporter à risque" tone="danger" />}
              <StatusBadge label={!item.is_active ? "Banni" : roleName(item)} tone={!item.is_active ? "danger" : "neutral"} />
            </View>
            <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }} numberOfLines={1}>
              #{item.id} · {item.email}{meta ? ` · ${meta}` : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={ADMIN.textMuted} />
        </Card>
      </AnimatedPressable>
    </Swipeable>
  );
}

// ── Banned user row — direct "Réactiver" action, no swipe (mirrors the blocked-clients pattern) ──
function BannedUserCard({ item, onPress, onReactivate, reactivating }: {
  item: AdminUser;
  onPress: () => void;
  onReactivate: () => void;
  reactivating: boolean;
}) {
  const name = `${item.first_name} ${item.last_name}`;

  return (
    <AnimatedPressable onPress={onPress}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.md, marginBottom: ADMIN.space.md }}>
        <Avatar name={name} photo={item.profile_photo} size={44} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ ...ADMIN.type.name, color: ADMIN.text }} numberOfLines={1}>{name}</Text>
          <Text style={{ ...ADMIN.type.label, color: ADMIN.textSub }} numberOfLines={1}>{item.email}</Text>
        </View>
        <AnimatedPressable
          onPress={onReactivate}
          disabled={reactivating}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, backgroundColor: ADMIN.successBg, opacity: reactivating ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: ADMIN.success }}>Réactiver</Text>
        </AnimatedPressable>
      </Card>
    </AnimatedPressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const showActionSheet = useActionSheet();
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget]   = useState<AdminUser | null>(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [usersError, setUsersError]     = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ action: "ban" | "delete"; user: AdminUser } | null>(null);
  const debouncedSearch = useDebounce(search, 380);

  const PAGE_SIZE = 80;
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin-users", debouncedSearch, roleFilter],
    queryFn: ({ pageParam }) => adminApi.getUsers({
      search: debouncedSearch || undefined,
      limit:  PAGE_SIZE,
      page:   pageParam,
      role:   (roleFilter === "all" || roleFilter === "banned") ? undefined : roleFilter,
      banned: roleFilter === "banned" ? true : undefined,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + ((p.data as AdminUser[] | undefined)?.length ?? 0), 0);
      const total = lastPage.meta?.total;
      if (total == null || loaded >= total) return undefined;
      return allPages.length + 1;
    },
  });

  const banMut = useMutation({
    mutationFn: (id: number) => adminApi.banUser(id),
    onSuccess: (_data, id) => {
      const name = users.find((u) => u.id === id)?.first_name ?? "Utilisateur";
      showToast(`${name} a été banni.`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmTarget(null);
    },
    onError: () => { setConfirmTarget(null); setUsersError("Impossible de bannir cet utilisateur."); },
  });
  const unbanMut = useMutation({
    mutationFn: (id: number) => adminApi.unbanUser(id),
    onSuccess: (_data, id) => {
      const name = users.find((u) => u.id === id)?.first_name ?? "Utilisateur";
      showToast(`${name} a été réactivé.`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => setUsersError("Impossible de réactiver cet utilisateur."),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: (_data, id) => {
      const name = users.find((u) => u.id === id)?.first_name ?? "Utilisateur";
      showToast(`${name} a été supprimé.`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmTarget(null);
    },
    onError: () => { setConfirmTarget(null); setUsersError("Impossible de supprimer cet utilisateur."); },
  });

  const users       = (data?.pages.flatMap((p) => (p.data as AdminUser[] | undefined) ?? []) ?? []) as AdminUser[];
  const totalUsers  = data?.pages[0]?.meta?.total;
  const activeCount = users.filter((u) =>  u.is_active).length;
  const bannedCount = users.filter((u) => !u.is_active).length;
  const onRefresh   = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const handleLongPress = useCallback((item: AdminUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    showActionSheet(
      {
        title: `${item.first_name} ${item.last_name}`,
        message: item.email,
        options: ["Annuler", "Voir le profil", "Offrir un abonnement",
          item.is_active ? "Bannir" : "Réactiver", "Supprimer"],
        cancelButtonIndex: 0,
        destructiveButtonIndex: item.is_active ? [3, 4] : [4],
        userInterfaceStyle: "dark",
      },
      (idx) => {
        if      (idx === 1) { setSelectedUser(item); }
        else if (idx === 2) { setGrantTarget(item); }
        else if (idx === 3) {
          setUsersError(null);
          if (item.is_active) setConfirmTarget({ action: "ban", user: item });
          else unbanMut.mutate(item.id); // reactivating is safe — no confirmation needed
        } else if (idx === 4) {
          setUsersError(null);
          setConfirmTarget({ action: "delete", user: item });
        }
      }
    );
  }, [showActionSheet, unbanMut]);

  const FILTERS: { value: RoleFilter; label: string }[] = [
    { value: "all",    label: "Tous" },
    { value: "pro",    label: "Pros" },
    { value: "client", label: "Clients" },
    { value: "banned", label: "Bannis" },
  ];

  const EMPTY: Record<RoleFilter, { title: string; sub: string }> = {
    all:    { title: "Aucun utilisateur",   sub: "Modifiez la recherche pour voir des résultats." },
    pro:    { title: "Aucun pro trouvé",    sub: "Il n'y a pas encore de pros inscrits." },
    client: { title: "Aucun client trouvé", sub: "Aucun client ne correspond à votre recherche." },
    banned: { title: "Aucun banni",         sub: "Aucun utilisateur n'est actuellement banni." },
  };

  const renderItem = useCallback(({ item }: { item: AdminUser }) => {
    if (roleFilter === "banned") {
      return (
        <BannedUserCard
          item={item}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelectedUser(item); }}
          onReactivate={() => unbanMut.mutate(item.id)} // reactivating is safe — no confirmation needed
          reactivating={unbanMut.isPending}
        />
      );
    }
    return (
      <UserCard
        item={item}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelectedUser(item); }}
        onLongPress={() => handleLongPress(item)}
        onBan={() => {
          setUsersError(null);
          if (item.is_active) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
            setConfirmTarget({ action: "ban", user: item });
          } else {
            unbanMut.mutate(item.id); // reactivating is safe — no confirmation needed
          }
        }}
        onDelete={() => { setUsersError(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}); setConfirmTarget({ action: "delete", user: item }); }}
        onGrant={() => setGrantTarget(item)}
      />
    );
  }, [roleFilter, unbanMut, handleLongPress]);

  const msg = EMPTY[roleFilter];

  const listHeader = (
    <View>
      <View style={{ marginHorizontal: -ADMIN.space.xl }}>
        <AdminHeader title="Utilisateurs" />
      </View>

      <View style={{ paddingBottom: ADMIN.space.md }}>
        {/* Segmented tabs — un bloc rose vif pour l'onglet actif */}
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: ADMIN.border, marginBottom: ADMIN.space.md }}>
          {FILTERS.map(({ value, label }, idx) => {
            const active = roleFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{
                  flex: 1, paddingVertical: 10,
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                  backgroundColor: active ? ADMIN.accent : "transparent",
                  borderLeftWidth: idx > 0 ? 1 : 0, borderLeftColor: ADMIN.border,
                }}
              >
                <Text style={{ ...ADMIN.type.label, color: active ? ADMIN.accentInk : ADMIN.textSub }}>{label}</Text>
                {value === "banned" && bannedCount > 0 && (
                  <View style={{ minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: active ? withAlpha(Colors.white, 0.3) : ADMIN.danger, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: Colors.white }}>{bannedCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Search — hidden on the banned tab, mirroring the pattern used for the blocked tab */}
        {roleFilter !== "banned" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: ADMIN.surfaceHover, borderRadius: 4, height: 44, paddingHorizontal: 14 }}>
            <Ionicons name="search-outline" size={16} color={ADMIN.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou email…"
              placeholderTextColor={ADMIN.textMuted}
              style={{ flex: 1, fontSize: 14, color: ADMIN.text }}
              autoCorrect={false} spellCheck={false} returnKeyType="search"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            />
            {Platform.OS !== "ios" && search.length > 0 && (
              <AnimatedIconButton onPress={() => setSearch("")} accessibilityLabel="Effacer la recherche" hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={ADMIN.textMuted} />
              </AnimatedIconButton>
            )}
          </View>
        )}

        {usersError && <View style={{ marginTop: ADMIN.space.md }}><ErrorMessage message={usersError} /></View>}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: ADMIN.bg }}>
      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: ADMIN.space.xl }}>
          {listHeader}
          <UserSkeleton />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, paddingHorizontal: ADMIN.space.xl }}>
          {listHeader}
          <View style={{ alignItems: "center", paddingVertical: 80 }}>
            <Text style={{ ...ADMIN.type.title, color: ADMIN.text, marginBottom: 6 }}>Impossible de charger les utilisateurs</Text>
            <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub, textAlign: "center", paddingHorizontal: 40, marginBottom: 16 }}>
              Vérifie ta connexion et réessaie.
            </Text>
            <AnimatedPressable onPress={onRefresh}>
              <Text style={{ color: ADMIN.accent, fontWeight: "700" }}>Réessayer</Text>
            </AnimatedPressable>
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={users}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingHorizontal: ADMIN.space.xl, paddingBottom: insets.bottom + ADMIN.space.xl }}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          ListFooterComponent={isFetchingNextPage ? (
            <View style={{ paddingVertical: ADMIN.space.lg }}>
              <ActivityIndicator size="small" color={ADMIN.accent} />
            </View>
          ) : null}
          ListHeaderComponent={
            <View>
              {listHeader}
              <Card style={{ flexDirection: "row", marginBottom: ADMIN.space.xl }}>
                {[
                  { label: "Utilisateurs", value: totalUsers ?? users.length },
                  { label: "Actifs",       value: activeCount },
                  { label: "Bannis",       value: bannedCount },
                ].map(({ label, value }, i) => (
                  <React.Fragment key={label}>
                    {i > 0 && <View style={{ width: 1, backgroundColor: ADMIN.border, marginHorizontal: ADMIN.space.sm }} />}
                    <View style={{ flex: 1, alignItems: "center" }}>
                      <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{value}</Text>
                      <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted, marginTop: 2 }} numberOfLines={1}>{label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </Card>
              <SectionLabel trailing={totalUsers != null && totalUsers > users.length ? `${users.length} sur ${totalUsers}` : debouncedSearch ? `${users.length} résultat${users.length !== 1 ? "s" : ""}` : undefined}>
                {debouncedSearch ? "Résultats" : FILTERS.find((f) => f.value === roleFilter)?.label ?? "Tous"}
              </SectionLabel>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN.accent} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <Text style={{ ...ADMIN.type.title, color: ADMIN.text, marginBottom: 6 }}>{msg.title}</Text>
              <Text style={{ ...ADMIN.type.body, color: ADMIN.textSub, textAlign: "center", paddingHorizontal: 40 }}>{msg.sub}</Text>
            </View>
          }
        />
      )}

      {selectedUser && (
        <UserDetailSheet
          user={selectedUser}
          onGrant={() => { setSelectedUser(null); setGrantTarget(selectedUser); }}
          onClose={() => setSelectedUser(null)}
        />
      )}
      {grantTarget && <GrantSubscriptionModal user={grantTarget} onClose={() => setGrantTarget(null)} />}

      <ConfirmDialog
        visible={!!confirmTarget}
        title={confirmTarget?.action === "ban" ? "Bannir cet utilisateur ?" : "Supprimer définitivement ?"}
        message={
          confirmTarget?.action === "ban" ? (
            <>{`${confirmTarget.user.first_name} ${confirmTarget.user.last_name} ne pourra plus se connecter à Blyss tant qu'il n'est pas réactivé.`}</>
          ) : confirmTarget ? (
            <>{`${confirmTarget.user.first_name} ${confirmTarget.user.last_name} et toutes ses données associées seront supprimés. `}<Text style={{ fontWeight: "800", color: ADMIN.danger }}>Cette action est irréversible.</Text></>
          ) : null
        }
        confirmLabel={confirmTarget?.action === "ban" ? "Bannir" : "Supprimer"}
        danger
        loading={confirmTarget?.action === "ban" ? banMut.isPending : deleteMut.isPending}
        onConfirm={() => {
          if (!confirmTarget) return;
          if (confirmTarget.action === "ban") banMut.mutate(confirmTarget.user.id);
          else deleteMut.mutate(confirmTarget.user.id);
        }}
        onClose={() => setConfirmTarget(null)}
      />
    </View>
  );
}
