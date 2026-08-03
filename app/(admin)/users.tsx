import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl, FlatList,
  Modal, Platform, Share,
} from "react-native";
import { Image } from "expo-image";
import { useActionSheet } from "@/components/ui/ActionSheet";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
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
import { Row } from "@/components/admin/Row";
import { ActionGrid, type ActionTileData } from "@/components/admin/ActionGrid";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/admin/Card";
import { useToast } from "@/components/ui/Toast";
import { resolveMediaUrl } from "@/lib/media";

type RoleFilter = "all" | "pro" | "client" | "banned";

const PLAN_OPTS   = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const MONTHS_OPTS = [1, 3, 6, 12];

function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
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

// ── Avatar — real photo when available, plain initial circle otherwise ───────
function Avatar({ name, photo, size = 36 }: { name: string; photo?: string | null; size?: number }) {
  const uri = resolveMediaUrl(photo);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: ADMIN.surfaceHover,
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={{ color: ADMIN.textSub, fontWeight: "700", fontSize: Math.round(size * 0.36) }}>
          {initials(name)}
        </Text>
      )}
    </View>
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

// ── Grant bottom sheet ────────────────────────────────────────────────────────
function GrantModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan]       = useState<typeof PLAN_OPTS[number]>("serenite");
  const [months, setMonths]   = useState(1);
  const [grantError, setGrantError] = useState<string | null>(null);

  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(user.id, { plan, months }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onClose();
    },
    onError: () => setGrantError("Impossible d'accorder l'abonnement."),
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: ADMIN.overlay }}
          onPress={onClose}
        />
        <View style={{
          backgroundColor: ADMIN.surface,
          borderTopLeftRadius: ADMIN.sheetRadius, borderTopRightRadius: ADMIN.sheetRadius,
          paddingHorizontal: ADMIN.space.xl, paddingBottom: ADMIN.space.xxl, paddingTop: ADMIN.space.md,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: ADMIN.sheetHandle, alignSelf: "center", marginBottom: ADMIN.space.xl }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.md, marginBottom: ADMIN.space.xl }}>
            <Avatar name={`${user.first_name} ${user.last_name}`} photo={user.profile_photo} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...ADMIN.type.title, color: ADMIN.text }}>Offrir un abonnement</Text>
              <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }}>pour {user.first_name} {user.last_name}</Text>
            </View>
            <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={ADMIN.textSub} />
            </AnimatedIconButton>
          </View>

          <Text style={styles.label}>Plan</Text>
          <View style={{ flexDirection: "row", backgroundColor: ADMIN.surfaceHover, borderRadius: 12, padding: 4, gap: 4, marginBottom: ADMIN.space.xl }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p}
                onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center",
                  backgroundColor: plan === p ? ADMIN.accent : "transparent",
                }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: plan === p ? Colors.white : ADMIN.textSub }}>
                  {PLAN_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Durée</Text>
          <View style={{ flexDirection: "row", backgroundColor: ADMIN.surfaceHover, borderRadius: 12, padding: 4, gap: 4, marginBottom: ADMIN.space.xxl }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m}
                onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center",
                  backgroundColor: months === m ? ADMIN.accent : "transparent",
                }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: months === m ? Colors.white : ADMIN.textSub }}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          {grantError && <View style={{ marginBottom: ADMIN.space.md }}><ErrorMessage message={grantError} /></View>}

          <AnimatedPressable
            onPress={() => { setGrantError(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); grantMut.mutate(); }}
            disabled={grantMut.isPending}
            style={{
              height: 50, borderRadius: 14, backgroundColor: ADMIN.accent,
              alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
              opacity: grantMut.isPending ? 0.7 : 1,
            }}>
            {grantMut.isPending
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.white }}>Accorder l'abonnement</Text>}
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

// ── User detail bottom sheet ───────────────────────────────────────────────────
function UserDetailSheet({ user, onGrant, onClose }: { user: AdminUser; onGrant: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"ban" | "delete" | null>(null);

  const { data: fullData } = useQuery({
    queryKey: ["admin-user", user.id],
    queryFn:  () => adminApi.getUser(user.id),
    staleTime: 60_000,
  });
  const full    = (fullData?.data as AdminUser | undefined) ?? user;
  const stats   = full.stats;
  const planStr = getActivePlan(full);

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
              <Text style={{ ...ADMIN.type.title, fontSize: 18, color: ADMIN.text, marginBottom: ADMIN.space.sm }}>{full.first_name} {full.last_name}</Text>
              <View style={{ flexDirection: "row", gap: ADMIN.space.sm, flexWrap: "wrap", justifyContent: "center", marginBottom: ADMIN.space.sm }}>
                <StatusBadge label={full.is_admin ? "Admin" : roleName(full)} tone="neutral" />
                {planStr && <StatusBadge label={planStr} tone="warning" />}
                {!full.is_active && <StatusBadge label="Banni" tone="danger" />}
              </View>
              <AnimatedPressable onPress={handleShareEmail} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="mail-outline" size={13} color={ADMIN.textMuted} />
                <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }}>{full.email}</Text>
                <Ionicons name="share-outline" size={12} color={ADMIN.textMuted} />
              </AnimatedPressable>
              <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={{ position: "absolute", top: 10, right: 20, width: 32, height: 32, borderRadius: 10, backgroundColor: ADMIN.surfaceHover, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={ADMIN.textSub} />
              </AnimatedIconButton>
            </View>

            {/* Stats — two rows of stat cards, same shape as the dashboard's "Deux faits" */}
            {stats && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.lg, gap: ADMIN.space.md }}>
                <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }} numberOfLines={1}>Réservations</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{stats.total_bookings}</Text>
                  </Card>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }} numberOfLines={1}>Terminées</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{stats.completed}</Text>
                  </Card>
                </View>
                <View style={{ flexDirection: "row", gap: ADMIN.space.md }}>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }} numberOfLines={1}>Annulées</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{stats.cancelled}</Text>
                  </Card>
                  <Card style={{ flex: 1 }}>
                    <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }} numberOfLines={1}>Dépensé</Text>
                    <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{Number(stats.total_spent ?? 0).toFixed(0)} €</Text>
                  </Card>
                </View>
              </View>
            )}

            {/* Subscription history — one card, rows inside */}
            {(full.subscription_history ?? []).length > 0 && (
              <View style={{ paddingHorizontal: ADMIN.space.xl, paddingTop: ADMIN.space.xl }}>
                <SectionLabel>Abonnements</SectionLabel>
                <Card style={{ padding: 0 }}>
                  {(full.subscription_history ?? []).slice(0, 4).map((sub, i, arr) => (
                    <Row
                      key={sub.id}
                      title={PLAN_LABELS[sub.plan] ?? sub.plan}
                      subtitle={new Date(sub.start_date).toLocaleDateString("fr-FR")}
                      trailing={<StatusBadge label={sub.status === "active" ? "Actif" : sub.status} tone={sub.status === "active" ? "success" : "neutral"} />}
                      showDivider={i < arr.length - 1}
                    />
                  ))}
                </Card>
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
          <Avatar name={name} photo={item.profile_photo} size={44} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ ...ADMIN.type.title, fontSize: 15, color: ADMIN.text, flex: 1 }} numberOfLines={1}>{name}</Text>
              <StatusBadge label={!item.is_active ? "Banni" : roleName(item)} tone={!item.is_active ? "danger" : "neutral"} />
            </View>
            <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }} numberOfLines={1}>{item.email}</Text>
            {meta && <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted }}>{meta}</Text>}
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
        <Avatar name={name} size={44} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ ...ADMIN.type.title, fontSize: 15, color: ADMIN.text }} numberOfLines={1}>{name}</Text>
          <Text style={{ ...ADMIN.type.caption, color: ADMIN.textSub }} numberOfLines={1}>{item.email}</Text>
        </View>
        <AnimatedPressable
          onPress={onReactivate}
          disabled={reactivating}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: ADMIN.successBg, opacity: reactivating ? 0.5 : 1 }}
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", debouncedSearch, roleFilter],
    queryFn:  () => adminApi.getUsers({
      search: debouncedSearch || undefined,
      limit:  80,
      role:   (roleFilter === "all" || roleFilter === "banned") ? undefined : roleFilter,
      banned: roleFilter === "banned" ? true : undefined,
    }),
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

  const users       = (data?.data as AdminUser[] | undefined) ?? [];
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

  return (
    <View style={{ flex: 1, backgroundColor: ADMIN.bg }}>
      <AdminHeader title="Utilisateurs" />

      <View style={{ paddingHorizontal: ADMIN.space.xl, paddingBottom: ADMIN.space.md }}>
        {/* Segmented tabs — one control, not a scrolling row of pills */}
        <View style={{ flexDirection: "row", backgroundColor: ADMIN.surfaceHover, borderRadius: 12, padding: 4, gap: 4, marginBottom: ADMIN.space.md }}>
          {FILTERS.map(({ value, label }) => {
            const active = roleFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 9,
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                  backgroundColor: active ? ADMIN.accent : "transparent",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: active ? Colors.white : ADMIN.textSub }}>{label}</Text>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: ADMIN.surfaceHover, borderRadius: 12, height: 44, paddingHorizontal: 14 }}>
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

      {isLoading ? (
        <UserSkeleton />
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
          ListHeaderComponent={
            <View>
              <Card style={{ flexDirection: "row", marginBottom: ADMIN.space.xl }}>
                {[
                  { label: "Utilisateurs", value: users.length },
                  { label: "Actifs",       value: activeCount },
                  { label: "Bannis",       value: bannedCount },
                ].map(({ label, value }, i) => (
                  <React.Fragment key={label}>
                    {i > 0 && <View style={{ width: 1, backgroundColor: ADMIN.border, marginHorizontal: ADMIN.space.sm }} />}
                    <View style={{ flex: 1, alignItems: "center" }}>
                      <Text style={{ ...ADMIN.type.display, fontSize: 22, color: ADMIN.text }} numberOfLines={1}>{value}</Text>
                      <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }} numberOfLines={1}>{label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </Card>
              <SectionLabel trailing={debouncedSearch ? `${users.length} résultat${users.length !== 1 ? "s" : ""}` : undefined}>
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
      {grantTarget && <GrantModal user={grantTarget} onClose={() => setGrantTarget(null)} />}

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

const styles = StyleSheet.create({
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: ADMIN.surfaceHover,
    alignItems: "center", justifyContent: "center",
  },
  label: {
    fontSize: 10, fontWeight: "700",
    color: ADMIN.textMuted,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
  },
});
