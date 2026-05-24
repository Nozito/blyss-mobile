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

const BORDER = Colors.border; // #EDE7E0 — warm beige, cohérent avec Blyss

type RoleFilter = "all" | "pro" | "client" | "banned";

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

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const [s, e] = avatarColors(name);
  return (
    <LinearGradient
      colors={[s, e]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: Math.round(size * 0.33) }}>{initials(name)}</Text>
    </LinearGradient>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function UserSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          backgroundColor: Colors.card, borderRadius: 18, padding: 14,
          borderWidth: 1, borderColor: BORDER,
          shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
        }}>
          <SkeletonBox width={44} height={44} borderRadius={13} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="60%" height={13} borderRadius={6} />
            <SkeletonBox width="80%" height={10} borderRadius={5} />
            <SkeletonBox width="38%" height={10} borderRadius={5} />
          </View>
          <SkeletonBox width={48} height={20} borderRadius={10} />
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
        <View style={[styles.sheet, { backgroundColor: Colors.background }]}>
          <View style={styles.handle} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Avatar name={`${user.first_name} ${user.last_name}`} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>Offrir un abonnement</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>pour {user.first_name} {user.last_name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 22 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p}
                onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? Colors.admin : BORDER,
                  backgroundColor: plan === p ? `${Colors.admin}12` : Colors.card }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? Colors.admin : Colors.mutedForeground }}>
                  {PLAN_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 28 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m}
                onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? Colors.admin : BORDER,
                  backgroundColor: months === m ? `${Colors.admin}12` : Colors.card }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? Colors.admin : Colors.mutedForeground }}>
                  {m}m
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); grantMut.mutate(); }}
            disabled={grantMut.isPending}
            style={{ opacity: grantMut.isPending ? 0.7 : 1 }}
          >
            <LinearGradient
              colors={["#EA6000", "#F97316", "#FBAB6A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
            >
              {grantMut.isPending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <><Ionicons name="gift-outline" size={20} color={Colors.white} />
                    <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.white }}>Accorder l'abonnement</Text></>}
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
    queryFn: () => adminApi.getUser(user.id),
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
          {/* Hero */}
          <LinearGradient
            colors={[ac, ac2]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 16, paddingBottom: 28, paddingHorizontal: 24, alignItems: "center" }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", marginBottom: 18 }} />
            <LinearGradient
              colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.12)"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}
            >
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>{initials(`${full.first_name} ${full.last_name}`)}</Text>
            </LinearGradient>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8 }}>{full.first_name} {full.last_name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)" }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", textTransform: "uppercase" }}>{full.is_admin ? "ADMIN" : full.role}</Text>
              </View>
              {planStr && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>⭐ {planStr}</Text>
                </View>
              )}
              {!full.is_active && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(240,58,58,0.45)" }}>
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

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            {/* Stats bento */}
            {stats && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { label: "RDV",      value: stats.total_bookings,                            color: Colors.info },
                  { label: "Terminés", value: stats.completed,                                 color: Colors.success },
                  { label: "Annulés",  value: stats.cancelled,                                 color: Colors.destructive },
                  { label: "Dépensé",  value: `${Number(stats.total_spent ?? 0).toFixed(0)}€`, color: Colors.admin },
                ].map(({ label, value, color: c }) => (
                  <View key={label} style={{ flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 10, alignItems: "center", borderWidth: 1, borderColor: BORDER, shadowColor: c, shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: c }}>{value}</Text>
                    <Text style={{ fontSize: 9, color: Colors.mutedForeground, marginTop: 2, textAlign: "center" }}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Subscription history */}
            {((full as any).subscription_history ?? []).length > 0 && (
              <View style={{ backgroundColor: Colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER }}>
                <Text style={styles.sectionLabel}>Abonnements</Text>
                {((full as any).subscription_history ?? []).slice(0, 4).map((sub: any, i: number) => (
                  <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BORDER }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sub.status === "active" ? Colors.success : BORDER }} />
                      <Text style={{ fontSize: 13, color: Colors.foreground, fontWeight: "600" }}>{PLAN_LABELS[sub.plan] ?? sub.plan}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{new Date(sub.start_date).toLocaleDateString("fr-FR")}</Text>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: sub.status === "active" ? `${Colors.success}18` : Colors.muted }}>
                        <Text style={{ fontSize: 9, fontWeight: "800", color: sub.status === "active" ? Colors.success : Colors.mutedForeground, textTransform: "uppercase" }}>
                          {sub.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={{ backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
              <Pressable onPress={handleShareEmail}
                style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.actionIcon, { backgroundColor: `${Colors.info}12` }]}>
                  <Ionicons name="mail-outline" size={18} color={Colors.info} />
                </View>
                <Text style={[styles.actionLabel, { color: Colors.info }]}>Partager l'email</Text>
                <Ionicons name="share-outline" size={14} color={Colors.mutedForeground} />
              </Pressable>

              <Pressable onPress={() => { onClose(); onGrant(); }}
                style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.actionIcon, { backgroundColor: `${Colors.admin}12` }]}>
                  <Ionicons name="gift-outline" size={18} color={Colors.admin} />
                </View>
                <Text style={[styles.actionLabel, { color: Colors.admin }]}>Offrir un abonnement</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />
              </Pressable>

              {!full.is_admin && (
                <Pressable onPress={() => {
                  const newRole = full.role === "pro" ? "client" : "pro";
                  Alert.alert("Modifier le rôle", `Passer ${full.first_name} en ${newRole} ?`, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Confirmer", onPress: () => updateRoleMut.mutate(newRole) },
                  ]);
                }} style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
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
                ])} style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.actionIcon, { backgroundColor: `${Colors.warning}12` }]}>
                    <Ionicons name="ban-outline" size={18} color={Colors.warning} />
                  </View>
                  <Text style={[styles.actionLabel, { color: Colors.warning }]}>Bannir l'utilisateur</Text>
                  {banMut.isPending && <ActivityIndicator size="small" color={Colors.warning} />}
                </Pressable>
              ) : (
                <Pressable onPress={() => unbanMut.mutate()}
                  style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: BORDER, opacity: pressed ? 0.7 : 1 }]}>
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
              ])} style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.7 : 1 }]}>
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
function UserCard({
  item, onPress, onLongPress, onBan, onDelete, onGrant,
}: {
  item: AdminUser;
  onPress:     () => void;
  onLongPress: () => void;
  onBan:       () => void;
  onDelete:    () => void;
  onGrant:     () => void;
}) {
  const rc      = roleColor(item);
  const name    = `${item.first_name} ${item.last_name}`;
  const plan    = getActivePlan(item);
  const joined  = joinedDate(item);
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={{ flexDirection: "row", marginBottom: 10, marginLeft: 6, borderRadius: 18, overflow: "hidden", width: 152 }}>
      <Pressable
        onPress={() => { swipeRef.current?.close(); onBan(); }}
        style={{ flex: 1, backgroundColor: Colors.warning, alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{item.is_active ? "Bannir" : "Réactiver"}</Text>
      </Pressable>
      <Pressable
        onPress={() => { swipeRef.current?.close(); onDelete(); }}
        style={{ flex: 1, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Suppr.</Text>
      </Pressable>
    </View>
  );

  const renderLeftActions = () => (
    <Pressable
      onPress={() => { swipeRef.current?.close(); onGrant(); }}
      style={{ width: 88, marginBottom: 10, marginRight: 6, borderRadius: 18, overflow: "hidden" }}
    >
      <LinearGradient
        colors={["#EA6000", "#F97316"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        <Ionicons name="gift-outline" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Abonnement</Text>
      </LinearGradient>
    </Pressable>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={item.is_admin ? undefined : renderRightActions}
      renderLeftActions={item.is_admin ? undefined : renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
        style={({ pressed }) => ({
          backgroundColor: Colors.card,
          borderRadius: 18,
          marginBottom: 10,
          borderWidth: 1,
          borderLeftWidth: 3,
          borderColor: BORDER,
          borderLeftColor: item.is_active ? rc : Colors.destructive,
          shadowColor: item.is_active ? rc : Colors.destructive,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: pressed ? 0.14 : 0.07,
          shadowRadius: 8,
          elevation: 2,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.88 : item.is_active ? 1 : 0.68,
        })}
      >
        <Avatar name={name} size={44} />

        <View style={{ flex: 1, gap: 2 }}>
          {/* Row 1: name + role badge */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, color: Colors.foreground, flex: 1 }} numberOfLines={1}>
              {name}
            </Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: `${rc}18`, borderWidth: 1, borderColor: `${rc}28` }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: rc, textTransform: "uppercase", letterSpacing: 0.5 }}>{roleName(item)}</Text>
            </View>
            {!item.is_active && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: `${Colors.destructive}14` }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: Colors.destructive }}>BANNI</Text>
              </View>
            )}
          </View>

          {/* Row 2: email */}
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }} numberOfLines={1}>{item.email}</Text>

          {/* Row 3: plan badge OR joined date */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            {plan ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A" }}>
                <Text style={{ fontSize: 9 }}>⭐</Text>
                <Text style={{ fontSize: 9, fontWeight: "800", color: "#92400E" }}>{plan.toUpperCase()}</Text>
              </View>
            ) : joined ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="time-outline" size={10} color={Colors.mutedForeground} />
                <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>Depuis {joined}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={13} color={BORDER} />
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
    queryFn: () => adminApi.getUsers({
      search: debouncedSearch || undefined,
      limit: 80,
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

  const handleLongPress = useCallback((item: AdminUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `${item.first_name} ${item.last_name}`,
          message: item.email,
          options: ["Annuler", "👁  Voir le profil", "🎁  Offrir un abonnement", item.is_active ? "⚠️  Bannir" : "✅  Réactiver", "🗑  Supprimer"],
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

  const FILTERS: { value: RoleFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: "all",    label: "Tous",    icon: "people-outline" },
    { value: "pro",    label: "Pros",    icon: "briefcase-outline" },
    { value: "client", label: "Clients", icon: "person-outline" },
    { value: "banned", label: "Bannis",  icon: "ban-outline" },
  ];

  const emptyMessage: Record<RoleFilter, { title: string; sub: string }> = {
    all:    { title: "Aucun utilisateur",   sub: "Modifiez la recherche pour voir des résultats." },
    pro:    { title: "Aucun pro trouvé",    sub: "Il n'y a pas encore de pros inscrits." },
    client: { title: "Aucun client trouvé", sub: "Aucun client ne correspond à votre recherche." },
    banned: { title: "Aucun banni",         sub: "Aucun utilisateur n'est actuellement banni." },
  };

  const renderItem = useCallback(({ item }: { item: AdminUser }) => (
    <UserCard
      item={item}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setSelectedUser(item); }}
      onLongPress={() => handleLongPress(item)}
      onBan={() => {
        const action = item.is_active ? "Bannir" : "Réactiver";
        Alert.alert(action, `${action} ${item.first_name} ?`, [
          { text: "Annuler", style: "cancel" },
          { text: action, style: item.is_active ? "destructive" : "default", onPress: () => banMut.mutate(item.id) },
        ]);
      }}
      onDelete={() => Alert.alert("Supprimer", `Supprimer ${item.first_name} définitivement ?`, [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate(item.id) },
      ])}
      onGrant={() => setGrantTarget(item)}
    />
  ), [banMut, deleteMut, handleLongPress]);

  const msg = emptyMessage[roleFilter];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>

        {/* ── Header ── */}
        <LinearGradient
          colors={["#FFEAF1", "#FFF2F7", "#FFEAF1"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 18,
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: BORDER,
          }}
        >
          {/* Title + counter */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.8 }}>
                Utilisateurs
              </Text>
              {!isLoading && users.length > 0 && (
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 3 }}>
                  {activeCount} actif{activeCount !== 1 ? "s" : ""} · {bannedCount} banni{bannedCount !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            {!isLoading && (
              <View style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: `${Colors.admin}14`, borderWidth: 1, borderColor: `${Colors.admin}30`,
              }}>
                <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.admin }}>{users.length}</Text>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: Colors.card, borderRadius: 16,
            paddingHorizontal: 14, height: 48,
            borderWidth: 1, borderColor: BORDER,
            marginBottom: 14,
            shadowColor: Colors.primary, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
          }}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou email…"
              placeholderTextColor={Colors.mutedForeground}
              style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            />
            {Platform.OS !== "ios" && search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTERS.map(({ value, label, icon }) => {
              const active = roleFilter === value;
              const pillColor = value === "pro" ? Colors.pro : value === "banned" ? Colors.destructive : Colors.admin;
              return (
                <Pressable key={value}
                  onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 5,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                    backgroundColor: active ? `${pillColor}14` : Colors.card,
                    borderColor: active ? `${pillColor}40` : BORDER,
                    shadowColor: active ? pillColor : "transparent",
                    shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: active ? 2 : 0,
                  }}>
                  <Ionicons name={icon} size={13} color={active ? pillColor : Colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? pillColor : Colors.mutedForeground }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </LinearGradient>

        {/* ── List ── */}
        {isLoading ? (
          <UserSkeleton />
        ) : (
          <FlashList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            // @ts-ignore — estimatedItemSize est valide en runtime
            estimatedItemSize={82}
            contentContainerStyle={{
              backgroundColor: Colors.background,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />
            }
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <LinearGradient
                  colors={[`${Colors.primary}22`, `${Colors.primary}08`]}
                  style={{ width: 80, height: 80, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 16 }}
                >
                  <Ionicons name="people-outline" size={34} color={Colors.primary} />
                </LinearGradient>
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.foreground, marginBottom: 6 }}>{msg.title}</Text>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", paddingHorizontal: 32, lineHeight: 20 }}>{msg.sub}</Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
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
  sectionLabel: {
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
