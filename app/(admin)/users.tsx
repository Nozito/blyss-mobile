import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, Pressable, TextInput, Alert, StyleSheet,
  ActivityIndicator, Modal, ScrollView, RefreshControl,
  ActionSheetIOS, Platform, Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors } from "@/constants/colors";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

const CARD_BG = "#FFFCFD"; // blanc très légèrement rosé — contraste doux sur #FFEAF1
const BORDER  = Colors.border; // #EDE7E0 — beige chaud

type RoleFilter = "all" | "pro" | "client" | "banned";

// Item discriminé pour FlashList : header de section ou user
type ListItem =
  | { _type: "header"; label: string; count: number; color: string; icon: keyof typeof Ionicons.glyphMap }
  | { _type: "user";   data: AdminUser };

const PLAN_OPTS   = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const MONTHS_OPTS = [1, 3, 6, 12];

const AVATAR_PALETTE: [string, string][] = [
  ["#EA6000", "#F97316"],
  ["#7C3AED", "#8B5CF6"],
  ["#1D4ED8", "#3B82F6"],
  ["#15803D", "#22C55E"],
  ["#BE185D", "#EC4899"],
  ["#B45309", "#F59E0B"],
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function avatarColors(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function roleColor(user: Pick<AdminUser, "is_admin" | "role">) {
  if (user.is_admin) return Colors.admin;
  if (user.role === "pro") return Colors.pro;
  return Colors.primary;
}

function roleName(user: Pick<AdminUser, "is_admin" | "role">) {
  if (user.is_admin) return "Admin";
  if (user.role === "pro") return "Pro";
  return "Client";
}

function getActivePlan(user: AdminUser): string | null {
  const active = ((user as any).subscription_history ?? []).find((s: any) => s.status === "active");
  return active ? (PLAN_LABELS[active.plan] ?? active.plan) : null;
}

function joinedDate(user: AdminUser): string | null {
  const raw = (user as any).created_at;
  if (!raw) return null;
  return new Date(raw).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const [s, e] = avatarColors(name);
  const r = Math.round(size * 0.3);
  return (
    <LinearGradient colors={[s, e]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: r, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: Math.round(size * 0.33) }}>
        {initials(name)}
      </Text>
    </LinearGradient>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, color, icon }: { label: string; count: number; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, marginBottom: 8, marginTop: 6 }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: `${color}16`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: "800", color, textTransform: "uppercase", letterSpacing: 0.6, flex: 1 }}>
        {label}
      </Text>
      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: `${color}14`, borderWidth: 1, borderColor: `${color}28` }}>
        <Text style={{ fontSize: 10, fontWeight: "800", color }}>{count}</Text>
      </View>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function UserSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <SkeletonBox width={46} height={46} borderRadius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="58%" height={13} borderRadius={6} />
            <SkeletonBox width="78%" height={10} borderRadius={5} />
            <SkeletonBox width="36%" height={10} borderRadius={5} />
          </View>
          <SkeletonBox width={46} height={20} borderRadius={10} />
        </View>
      ))}
    </View>
  );
}

// ── Grant modal ───────────────────────────────────────────────────────────────
function GrantModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan]     = useState<typeof PLAN_OPTS[number]>("serenite");
  const [months, setMonths] = useState(1);

  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(user.id, { plan, months }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      Alert.alert("✅ Accordé", `${PLAN_LABELS[plan]} — ${months} mois accordé à ${user.first_name}.`);
      onClose();
    },
    onError: () => Alert.alert("Erreur", "Impossible d'accorder l'abonnement."),
  });

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.bottomSheet, { backgroundColor: Colors.background }]}>
          <View style={styles.handle} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Avatar name={`${user.first_name} ${user.last_name}`} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground }}>Offrir un abonnement</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>pour {user.first_name} {user.last_name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={styles.label}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p} onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? Colors.admin : BORDER,
                  backgroundColor: plan === p ? `${Colors.admin}12` : CARD_BG }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? Colors.admin : Colors.mutedForeground }}>
                  {PLAN_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 28 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m} onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? Colors.admin : BORDER,
                  backgroundColor: months === m ? `${Colors.admin}12` : CARD_BG }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? Colors.admin : Colors.mutedForeground }}>
                  {m}m
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); grantMut.mutate(); }}
            disabled={grantMut.isPending} style={{ opacity: grantMut.isPending ? 0.7 : 1 }}>
            <LinearGradient colors={["#EA6000", "#F97316", "#FBAB6A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}>
              {grantMut.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="gift-outline" size={20} color="#fff" />
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>Accorder l'abonnement</Text></>}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── User detail sheet ─────────────────────────────────────────────────────────
function UserDetailSheet({ user, onGrant, onClose }: { user: AdminUser; onGrant: () => void; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: fullData } = useQuery({
    queryKey: ["admin-user", user.id],
    queryFn:  () => adminApi.getUser(user.id),
    staleTime: 60_000,
  });
  const full    = (fullData?.data as AdminUser | undefined) ?? user;
  const stats   = full.stats;
  const planStr = getActivePlan(full);
  const [ac, ac2] = avatarColors(`${full.first_name} ${full.last_name}`);

  const banMut = useMutation({
    mutationFn: () => adminApi.banUser(user.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onClose();
    },
  });
  const unbanMut = useMutation({
    mutationFn: () => adminApi.unbanUser(user.id),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onClose();
    },
  });
  const deleteMut = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
  });
  const updateRoleMut = useMutation({
    mutationFn: (newRole: "client" | "pro") => adminApi.updateUser(user.id, { role: newRole }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
    },
    onError: () => Alert.alert("Erreur", "Impossible de modifier le rôle."),
  });

  const handleShareEmail = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await Share.share({ message: full.email });
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ScrollView
          style={{ backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%" }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero gradient */}
          <LinearGradient colors={[ac, ac2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 16, paddingBottom: 28, paddingHorizontal: 24, alignItems: "center" }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", marginBottom: 18 }} />
            <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 66, height: 66, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>{initials(`${full.first_name} ${full.last_name}`)}</Text>
            </LinearGradient>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8 }}>{full.first_name} {full.last_name}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)" }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", textTransform: "uppercase" }}>
                  {full.is_admin ? "ADMIN" : full.role}
                </Text>
              </View>
              {planStr && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>⭐ {planStr}</Text>
                </View>
              )}
              {!full.is_active && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(240,58,58,0.5)" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>BANNI</Text>
                </View>
              )}
            </View>
            <Pressable onPress={handleShareEmail} style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.85 }}>
              <Ionicons name="mail-outline" size={13} color="#fff" />
              <Text style={{ fontSize: 12, color: "#fff" }}>{full.email}</Text>
              <Ionicons name="share-outline" size={12} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <Pressable onPress={onClose} style={{ position: "absolute", top: 18, right: 20, width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </LinearGradient>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
            {/* Stats bento */}
            {stats && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([
                  { label: "RDV",      value: stats.total_bookings,                            color: Colors.info },
                  { label: "Terminés", value: stats.completed,                                 color: Colors.success },
                  { label: "Annulés",  value: stats.cancelled,                                 color: Colors.destructive },
                  { label: "Dépensé",  value: `${Number(stats.total_spent ?? 0).toFixed(0)}€`, color: Colors.admin },
                ] as const).map(({ label, value, color: c }) => (
                  <View key={label} style={{ flex: 1, backgroundColor: CARD_BG, borderRadius: 16, padding: 10, alignItems: "center", borderWidth: 1, borderColor: BORDER, shadowColor: c, shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: c }}>{value}</Text>
                    <Text style={{ fontSize: 9, color: Colors.mutedForeground, marginTop: 2, textAlign: "center" }}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Subscription history */}
            {((full as any).subscription_history ?? []).length > 0 && (
              <View style={{ backgroundColor: CARD_BG, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER }}>
                <Text style={styles.label}>Abonnements</Text>
                {((full as any).subscription_history ?? []).slice(0, 4).map((sub: any, i: number) => (
                  <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BORDER }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sub.status === "active" ? Colors.success : BORDER }} />
                      <Text style={{ fontSize: 13, color: Colors.foreground, fontWeight: "600" }}>{PLAN_LABELS[sub.plan] ?? sub.plan}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{new Date(sub.start_date).toLocaleDateString("fr-FR")}</Text>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: sub.status === "active" ? `${Colors.success}18` : Colors.muted }}>
                        <Text style={{ fontSize: 9, fontWeight: "800", textTransform: "uppercase", color: sub.status === "active" ? Colors.success : Colors.mutedForeground }}>{sub.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={{ backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
              {[
                {
                  icon: "mail-outline" as const, color: Colors.info, label: "Partager l'email",
                  onPress: handleShareEmail, trailing: <Ionicons name="share-outline" size={14} color={Colors.mutedForeground} />, show: true,
                },
                {
                  icon: "gift-outline" as const, color: Colors.admin, label: "Offrir un abonnement",
                  onPress: () => { onClose(); onGrant(); }, trailing: <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />, show: true,
                },
              ].filter((a) => a.show).map((action, idx, arr) => (
                <Pressable key={action.label}
                  onPress={action.onPress}
                  style={({ pressed }) => [styles.actionRow, { borderBottomWidth: idx < arr.length - 1 ? 1 : 0, borderBottomColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.actionIcon, { backgroundColor: `${action.color}12` }]}>
                    <Ionicons name={action.icon} size={18} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
                  {action.trailing}
                </Pressable>
              ))}

              {!full.is_admin && (
                <Pressable onPress={() => {
                  const newRole = full.role === "pro" ? "client" : "pro";
                  Alert.alert("Modifier le rôle", `Passer ${full.first_name} en ${newRole} ?`, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Confirmer", onPress: () => updateRoleMut.mutate(newRole) },
                  ]);
                }} style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.actionIcon, { backgroundColor: `${Colors.pro}12` }]}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={Colors.pro} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionLabel, { color: Colors.pro, flex: 0 }]}>Modifier le rôle</Text>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 1 }}>Actuellement : {full.role}</Text>
                  </View>
                  {updateRoleMut.isPending
                    ? <ActivityIndicator size="small" color={Colors.pro} />
                    : <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />}
                </Pressable>
              )}

              {full.is_active ? (
                <Pressable onPress={() => Alert.alert("Bannir", `Bannir ${full.first_name} ?`, [
                  { text: "Annuler", style: "cancel" },
                  { text: "Bannir", style: "destructive", onPress: () => banMut.mutate() },
                ])} style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.actionIcon, { backgroundColor: `${Colors.warning}12` }]}>
                    <Ionicons name="ban-outline" size={18} color={Colors.warning} />
                  </View>
                  <Text style={[styles.actionLabel, { color: Colors.warning }]}>Bannir l'utilisateur</Text>
                  {banMut.isPending && <ActivityIndicator size="small" color={Colors.warning} />}
                </Pressable>
              ) : (
                <Pressable onPress={() => unbanMut.mutate()}
                  style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.actionIcon, { backgroundColor: `${Colors.success}12` }]}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                  </View>
                  <Text style={[styles.actionLabel, { color: Colors.success }]}>Réactiver le compte</Text>
                  {unbanMut.isPending && <ActivityIndicator size="small" color={Colors.success} />}
                </Pressable>
              )}

              <Pressable onPress={() => Alert.alert("Supprimer", `Supprimer ${full.first_name} définitivement ?`, [
                { text: "Annuler", style: "cancel" },
                { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate() },
              ])} style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.actionIcon, { backgroundColor: `${Colors.destructive}10` }]}>
                  <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                </View>
                <Text style={[styles.actionLabel, { color: Colors.destructive }]}>Supprimer définitivement</Text>
                {deleteMut.isPending && <ActivityIndicator size="small" color={Colors.destructive} />}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── User card ─────────────────────────────────────────────────────────────────
function UserCard({ item, onPress, onLongPress, onBan, onDelete, onGrant }: {
  item:        AdminUser;
  onPress:     () => void;
  onLongPress: () => void;
  onBan:       () => void;
  onDelete:    () => void;
  onGrant:     () => void;
}) {
  const rc       = roleColor(item);
  const accentL  = item.is_active ? rc : Colors.destructive;
  const name     = `${item.first_name} ${item.last_name}`;
  const plan     = getActivePlan(item);
  const joined   = joinedDate(item);
  const stats    = (item as any).stats as AdminUser["stats"] | undefined;
  const swipeRef = useRef<Swipeable>(null);

  // Fond de card très légèrement teinté par rôle — renforce la lisibilité en section
  const cardTint = item.is_active
    ? item.is_admin ? `${Colors.admin}05` : item.role === "pro" ? `${Colors.pro}05` : "#FFFCFD"
    : `${Colors.destructive}05`;

  const renderRightActions = () => (
    <View style={{ flexDirection: "row", marginBottom: 10, marginLeft: 6, borderRadius: 16, overflow: "hidden", width: 148 }}>
      <Pressable onPress={() => { swipeRef.current?.close(); onBan(); }}
        style={{ flex: 1, backgroundColor: Colors.warning, alignItems: "center", justifyContent: "center", gap: 3 }}>
        <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={19} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{item.is_active ? "Bannir" : "Réactiver"}</Text>
      </Pressable>
      <Pressable onPress={() => { swipeRef.current?.close(); onDelete(); }}
        style={{ flex: 1, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", gap: 3 }}>
        <Ionicons name="trash-outline" size={19} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Suppr.</Text>
      </Pressable>
    </View>
  );

  const renderLeftActions = () => (
    <Pressable onPress={() => { swipeRef.current?.close(); onGrant(); }}
      style={{ width: 82, marginBottom: 10, marginRight: 6, borderRadius: 16, overflow: "hidden" }}>
      <LinearGradient colors={["#EA6000", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
        <Ionicons name="gift-outline" size={19} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>Abonnement</Text>
      </LinearGradient>
    </Pressable>
  );

  return (
    <Swipeable ref={swipeRef}
      renderRightActions={item.is_admin ? undefined : renderRightActions}
      renderLeftActions={item.is_admin ? undefined : renderLeftActions}
      overshootRight={false} overshootLeft={false} friction={2}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
        style={({ pressed }) => ({
          backgroundColor: cardTint,
          borderRadius: 16,
          marginBottom: 10,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: `${accentL}22`,
          shadowColor: accentL,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: pressed ? 0.16 : 0.08,
          shadowRadius: 10,
          elevation: 3,
          opacity: pressed ? 0.91 : item.is_active ? 1 : 0.58,
        })}
      >
        {/* ── Corps ── */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Barre colorée gauche */}
          <View style={{ width: 3, alignSelf: "stretch", backgroundColor: accentL, opacity: 0.85 }} />

          {/* Avatar */}
          <View style={{ paddingLeft: 13, paddingVertical: 13 }}>
            <Avatar name={name} size={48} />
          </View>

          {/* Infos */}
          <View style={{ flex: 1, paddingLeft: 12, paddingVertical: 13, gap: 4 }}>
            {/* Ligne 1 : nom + badge rôle + banni */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontWeight: "800", fontSize: 14.5, color: Colors.foreground, flex: 1, letterSpacing: -0.2 }} numberOfLines={1}>
                {name}
              </Text>
              {!item.is_active ? (
                <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: `${Colors.destructive}16`, borderWidth: 1, borderColor: `${Colors.destructive}30` }}>
                  <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.destructive, letterSpacing: 0.3 }}>BANNI</Text>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${rc}16`, borderWidth: 1, borderColor: `${rc}28` }}>
                  <Text style={{ fontSize: 9, fontWeight: "900", color: rc, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {roleName(item)}
                  </Text>
                </View>
              )}
            </View>

            {/* Ligne 2 : email */}
            <Text style={{ fontSize: 11.5, color: Colors.mutedForeground, lineHeight: 15 }} numberOfLines={1}>
              {item.email}
            </Text>

            {/* Ligne 3 : plan + date d'inscription */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {plan && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A" }}>
                  <Text style={{ fontSize: 9 }}>⭐</Text>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#92400E" }}>{plan.toUpperCase()}</Text>
                </View>
              )}
              {joined && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Ionicons name="time-outline" size={10} color={Colors.mutedForeground} />
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Depuis {joined}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ paddingRight: 14 }}>
            <Ionicons name="chevron-forward" size={14} color={`${accentL}50`} />
          </View>
        </View>

        {/* ── Métriques (si stats présentes sur l'item) ── */}
        {stats && (
          <>
            <View style={{ height: 1, backgroundColor: `${accentL}18`, marginHorizontal: 14 }} />
            <View style={{ flexDirection: "row", paddingVertical: 8 }}>
              {([
                { icon: "calendar-outline"  as const, value: stats.total_bookings,                            label: "RDV",      color: Colors.info },
                { icon: "checkmark-outline" as const, value: stats.completed,                                 label: "Terminés", color: Colors.success },
                { icon: "close-outline"     as const, value: stats.cancelled,                                 label: "Annulés",  color: Colors.destructive },
                { icon: "card-outline"      as const, value: `${Number(stats.total_spent ?? 0).toFixed(0)}€`, label: "Dépensé",  color: Colors.admin },
              ]).map(({ icon, value, label, color: c }, idx, arr) => (
                <View key={label} style={{ flex: 1, alignItems: "center", borderRightWidth: idx < arr.length - 1 ? 1 : 0, borderRightColor: `${accentL}18` }}>
                  <Ionicons name={icon} size={11} color={c} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: c, marginTop: 2 }}>{value}</Text>
                  <Text style={{ fontSize: 9, color: Colors.mutedForeground, marginTop: 1 }}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Pressable>
    </Swipeable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget]   = useState<AdminUser | null>(null);
  const [refreshing, setRefreshing]     = useState(false);
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
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users       = (data?.data as AdminUser[] | undefined) ?? [];
  const activeCount = users.filter((u) =>  u.is_active).length;
  const bannedCount = users.filter((u) => !u.is_active).length;
  const onRefresh   = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  // Construit la liste plate avec headers de section (uniquement en mode "Tous")
  const listData = useCallback((): ListItem[] => {
    if (roleFilter !== "all" || users.length === 0) {
      return users.map((u) => ({ _type: "user", data: u }));
    }
    const groups: { key: RoleFilter; label: string; color: string; icon: keyof typeof Ionicons.glyphMap; items: AdminUser[] }[] = [
      { key: "all",    label: "Admins",  color: Colors.admin,       icon: "shield-checkmark-outline", items: users.filter((u) => u.is_admin) },
      { key: "pro",    label: "Pros",    color: Colors.pro,          icon: "briefcase-outline",        items: users.filter((u) => !u.is_admin && u.role === "pro" && u.is_active) },
      { key: "client", label: "Clients", color: Colors.primary,      icon: "person-outline",           items: users.filter((u) => !u.is_admin && u.role === "client" && u.is_active) },
      { key: "banned", label: "Bannis",  color: Colors.destructive,  icon: "ban-outline",              items: users.filter((u) => !u.is_admin && !u.is_active) },
    ];
    const result: ListItem[] = [];
    for (const g of groups) {
      if (g.items.length === 0) continue;
      result.push({ _type: "header", label: g.label, count: g.items.length, color: g.color, icon: g.icon });
      g.items.forEach((u) => result.push({ _type: "user", data: u }));
    }
    return result;
  }, [users, roleFilter]);

  const handleLongPress = useCallback((item: AdminUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `${item.first_name} ${item.last_name}`,
          message: item.email,
          options: ["Annuler", "👁  Voir le profil", "🎁  Offrir un abonnement",
            item.is_active ? "⚠️  Bannir" : "✅  Réactiver", "🗑  Supprimer"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: item.is_active ? [3, 4] : [4],
        },
        (idx) => {
          if      (idx === 1) { setSelectedUser(item); }
          else if (idx === 2) { setGrantTarget(item); }
          else if (idx === 3) {
            const action = item.is_active ? "Bannir" : "Réactiver";
            Alert.alert(action, `${action} ${item.first_name} ?`, [
              { text: "Annuler", style: "cancel" },
              { text: action, style: item.is_active ? "destructive" : "default", onPress: () => banMut.mutate(item.id) },
            ]);
          } else if (idx === 4) {
            Alert.alert("Supprimer", `Supprimer ${item.first_name} définitivement ?`, [
              { text: "Annuler", style: "cancel" },
              { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate(item.id) },
            ]);
          }
        }
      );
    } else {
      setSelectedUser(item);
    }
  }, [banMut, deleteMut]);

  const FILTERS: { value: RoleFilter; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { value: "all",    label: "Tous",    icon: "people-outline",    color: Colors.admin },
    { value: "pro",    label: "Pros",    icon: "briefcase-outline", color: Colors.pro },
    { value: "client", label: "Clients", icon: "person-outline",    color: Colors.primary },
    { value: "banned", label: "Bannis",  icon: "ban-outline",       color: Colors.destructive },
  ];

  const EMPTY: Record<RoleFilter, { title: string; sub: string }> = {
    all:    { title: "Aucun utilisateur",   sub: "Modifiez la recherche pour voir des résultats." },
    pro:    { title: "Aucun pro trouvé",    sub: "Il n'y a pas encore de pros inscrits." },
    client: { title: "Aucun client trouvé", sub: "Aucun client ne correspond à votre recherche." },
    banned: { title: "Aucun banni",         sub: "Aucun utilisateur n'est actuellement banni." },
  };

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item._type === "header") {
      return <SectionHeader label={item.label} count={item.count} color={item.color} icon={item.icon} />;
    }
    const u = item.data;
    return (
      <UserCard
        item={u}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelectedUser(u); }}
        onLongPress={() => handleLongPress(u)}
        onBan={() => {
          const action = u.is_active ? "Bannir" : "Réactiver";
          Alert.alert(action, `${action} ${u.first_name} ?`, [
            { text: "Annuler", style: "cancel" },
            { text: action, style: u.is_active ? "destructive" : "default", onPress: () => banMut.mutate(u.id) },
          ]);
        }}
        onDelete={() => Alert.alert("Supprimer", `Supprimer ${u.first_name} définitivement ?`, [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate(u.id) },
        ])}
        onGrant={() => setGrantTarget(u)}
      />
    );
  }, [banMut, deleteMut, handleLongPress]);

  const msg = EMPTY[roleFilter];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <View style={{
          backgroundColor: Colors.background,
          paddingTop: insets.top + 18,
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}>
          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.6 }}>
                Utilisateurs
              </Text>
              {!isLoading && (
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                  {activeCount} actif{activeCount !== 1 ? "s" : ""} · {bannedCount} banni{bannedCount !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            {!isLoading && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 22, backgroundColor: `${Colors.admin}16`, borderWidth: 1, borderColor: `${Colors.admin}32` }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: Colors.admin }}>{users.length}</Text>
              </View>
            )}
          </View>

          {/* Search card */}
          <View style={[styles.card, {
            flexDirection: "row", alignItems: "center", gap: 10,
            paddingHorizontal: 14, height: 46, marginBottom: 12,
            shadowColor: Colors.primary, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
          }]}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou email…"
              placeholderTextColor={Colors.mutedForeground}
              style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
              autoCorrect={false} spellCheck={false} returnKeyType="search"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            />
            {Platform.OS !== "ios" && search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
            {FILTERS.map(({ value, label, icon, color: pillColor }) => {
              const active = roleFilter === value;
              return (
                <Pressable key={value}
                  onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 5,
                    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
                    backgroundColor: active ? `${pillColor}16` : CARD_BG,
                    borderColor: active ? `${pillColor}40` : BORDER,
                  }}>
                  <Ionicons name={icon} size={12} color={active ? pillColor : Colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? pillColor : Colors.mutedForeground }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Mini stats strip */}
          {!isLoading && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Total",   value: users.length,  color: Colors.admin },
                { label: "Actifs",  value: activeCount,   color: Colors.success },
                { label: "Bannis",  value: bannedCount,   color: Colors.destructive },
              ].map(({ label, value, color: c }) => (
                <View key={label} style={{
                  flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                  backgroundColor: `${c}10`, borderRadius: 12, paddingVertical: 8, borderWidth: 1, borderColor: `${c}22`,
                }}>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: c }}>{value}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: c, opacity: 0.8 }}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ══ LIST ════════════════════════════════════════════════════════════ */}
        {isLoading ? (
          <UserSkeleton />
        ) : (
          <FlashList
            data={listData()}
            keyExtractor={(item) => item._type === "header" ? `h-${item.label}` : String(item.data.id)}
            renderItem={renderItem}
            // @ts-ignore — prop valide en runtime
            estimatedItemSize={84}
            contentContainerStyle={{
              backgroundColor: Colors.background,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 72 }}>
                <LinearGradient
                  colors={[`${Colors.primary}24`, `${Colors.primary}08`]}
                  style={{ width: 78, height: 78, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Ionicons name="people-outline" size={34} color={Colors.primary} />
                </LinearGradient>
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground, marginBottom: 6 }}>{msg.title}</Text>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", paddingHorizontal: 40, lineHeight: 20 }}>{msg.sub}</Text>
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
      </View>
    </GestureHandlerRootView>
  );
}

// ── StyleSheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER,
    alignSelf: "center", marginTop: 12, marginBottom: 24,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.muted,
    alignItems: "center", justifyContent: "center",
  },
  label: {
    fontSize: 10, fontWeight: "800", color: Colors.mutedForeground,
    textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  actionLabel: {
    flex: 1, fontSize: 14, fontWeight: "800",
  },
});
