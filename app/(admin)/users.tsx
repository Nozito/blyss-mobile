import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet,
  ActivityIndicator, ScrollView, RefreshControl, FlatList,
  Modal, ActionSheetIOS, Platform, Animated, Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { SymbolView } from "expo-symbols";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors } from "@/constants/colors";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { ADMIN } from "@/constants/adminTheme";
import { useScrollToTop } from "@react-navigation/native";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

// ── Dark design tokens ────────────────────────────────────────────────────────
const BG      = ADMIN.bg;
const CARD_BG = ADMIN.surface;
const BORDER  = ADMIN.border;
const TEXT1   = ADMIN.text;
const TEXT2   = ADMIN.textSub;
const TEXT3   = ADMIN.textMuted;

// ── Types & constants (unchanged logic) ───────────────────────────────────────
type RoleFilter = "all" | "pro" | "client" | "banned";

type ListItem =
  | { _type: "header"; label: string; count: number; color: string; icon: keyof typeof Ionicons.glyphMap }
  | { _type: "user";   data: AdminUser };

const PLAN_OPTS   = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const MONTHS_OPTS = [1, 3, 6, 12];

const AVATAR_PALETTE: [string, string][] = [
  ["#EA6000", Colors.admin],
  [Colors.pro, Colors.pro],
  [Colors.infoText, Colors.info],
  [Colors.successTextDark, Colors.success],
  ["#BE185D", "#EC4899"],
  [Colors.warningTextDark, Colors.warning],
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
  const active = (user.subscription_history ?? []).find((s) => s.status === "active");
  return active ? (PLAN_LABELS[active.plan] ?? active.plan) : null;
}
function joinedDate(user: AdminUser): string | null {
  if (!user.created_at) return null;
  return new Date(user.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 52 }: { name: string; size?: number }) {
  const [s, e] = avatarColors(name);
  const r = Math.round(size * 0.35);
  return (
    <LinearGradient colors={[s, e]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: r, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: Colors.white, fontWeight: "900", fontSize: Math.round(size * 0.33) }}>
        {initials(name)}
      </Text>
    </LinearGradient>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, color, icon }: { label: string; count: number; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)" }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: "800", color, textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>
        {label}
      </Text>
      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: `${color}18`, borderWidth: 1, borderColor: `${color}30` }}>
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
          <SkeletonBox width={52} height={52} borderRadius={18} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="55%" height={13} borderRadius={6} />
            <SkeletonBox width="75%" height={10} borderRadius={5} />
            <SkeletonBox width="35%" height={10} borderRadius={5} />
          </View>
          <SkeletonBox width={32} height={32} borderRadius={8} />
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
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" }}
          onPress={onClose}
        />
        <View style={{
          backgroundColor: "#111118",
          borderTopLeftRadius: 32, borderTopRightRadius: 32,
          paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12,
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 20 }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Avatar name={`${user.first_name} ${user.last_name}`} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: TEXT1 }}>Offrir un abonnement</Text>
              <Text style={{ fontSize: 13, color: TEXT2 }}>pour {user.first_name} {user.last_name}</Text>
            </View>
            <AnimatedIconButton onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={TEXT2} />
            </AnimatedIconButton>
          </View>

          <Text style={styles.label}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PLAN_OPTS.map((p) => (
              <AnimatedPressable key={p}
                onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? `${Colors.admin}50` : "rgba(255,255,255,0.12)",
                  backgroundColor: plan === p ? `${Colors.admin}22` : "rgba(255,255,255,0.07)",
                }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? Colors.admin : TEXT2 }}>
                  {PLAN_LABELS[p]}
                </Text>
              </AnimatedPressable>
            ))}
          </View>

          <Text style={styles.label}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 28 }}>
            {MONTHS_OPTS.map((m) => (
              <AnimatedPressable key={m}
                onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? `${Colors.admin}50` : "rgba(255,255,255,0.12)",
                  backgroundColor: months === m ? `${Colors.admin}22` : "rgba(255,255,255,0.07)",
                }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? Colors.admin : TEXT2 }}>{m}m</Text>
              </AnimatedPressable>
            ))}
          </View>

          {grantError && <View style={{ marginBottom: 12 }}><ErrorMessage message={grantError} /></View>}

          <AnimatedPressable
            onPress={() => { setGrantError(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); grantMut.mutate(); }}
            disabled={grantMut.isPending} style={{ opacity: grantMut.isPending ? 0.7 : 1 }}>
            <LinearGradient colors={["#EA6000", Colors.admin, "#FBAB6A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}>
              {grantMut.isPending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <><Ionicons name="gift-outline" size={20} color={Colors.white} />
                    <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.white }}>Accorder l'abonnement</Text></>}
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

// ── User detail bottom sheet ───────────────────────────────────────────────────
function UserDetailSheet({ user, onGrant, onClose }: { user: AdminUser; onGrant: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const [sheetError, setSheetError] = useState<string | null>(null);

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
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" }}
          onPress={onClose}
        />
        <View style={{ backgroundColor: "#111118", borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 12 }} />
          <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {/* Hero gradient */}
            <LinearGradient colors={[ac, ac2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingTop: 8, paddingBottom: 28, paddingHorizontal: 24, alignItems: "center" }}>
              <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: 66, height: 66, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}>
                <Text style={{ fontSize: 24, fontWeight: "900", color: Colors.white }}>{initials(`${full.first_name} ${full.last_name}`)}</Text>
              </LinearGradient>
              <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.white, marginBottom: 8 }}>{full.first_name} {full.last_name}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.white, textTransform: "uppercase" }}>{full.is_admin ? "ADMIN" : full.role}</Text>
                </View>
                {planStr && (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.white }}>⭐ {planStr}</Text>
                  </View>
                )}
                {!full.is_active && (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(240,58,58,0.4)" }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.white }}>BANNI</Text>
                  </View>
                )}
              </View>
              <AnimatedPressable onPress={handleShareEmail} style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.85 }}>
                <Ionicons name="mail-outline" size={13} color={Colors.white} />
                <Text style={{ fontSize: 12, color: Colors.white }}>{full.email}</Text>
                <Ionicons name="share-outline" size={12} color="rgba(255,255,255,0.7)" />
              </AnimatedPressable>
              <AnimatedIconButton onPress={onClose} style={{ position: "absolute", top: 10, right: 20, width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={Colors.white} />
              </AnimatedIconButton>
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
                    <View key={label} style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: c }}>{value}</Text>
                      <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, textAlign: "center" }}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Subscription history */}
              {(full.subscription_history ?? []).length > 0 && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                  <Text style={styles.label}>Abonnements</Text>
                  {(full.subscription_history ?? []).slice(0, 4).map((sub, i) => (
                    <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.07)" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sub.status === "active" ? Colors.success : "rgba(255,255,255,0.2)" }} />
                        <Text style={{ fontSize: 13, color: TEXT1, fontWeight: "600" }}>{PLAN_LABELS[sub.plan] ?? sub.plan}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 11, color: TEXT2 }}>{new Date(sub.start_date).toLocaleDateString("fr-FR")}</Text>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: sub.status === "active" ? `${Colors.success}18` : "rgba(255,255,255,0.06)" }}>
                          <Text style={{ fontSize: 9, fontWeight: "800", textTransform: "uppercase", color: sub.status === "active" ? Colors.success : TEXT2 }}>{sub.status}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {sheetError && <View style={{ marginBottom: 4 }}><ErrorMessage message={sheetError} /></View>}

              {/* Actions */}
              <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                {[
                  { icon: "mail-outline" as const,  color: Colors.info,  label: "Partager l'email",    onPress: handleShareEmail, trailing: <Ionicons name="share-outline" size={14} color={TEXT3} />, show: true },
                  { icon: "gift-outline" as const,  color: Colors.admin, label: "Offrir un abonnement", onPress: () => { onClose(); onGrant(); }, trailing: <Ionicons name="chevron-forward" size={14} color={TEXT3} />, show: true },
                ].filter((a) => a.show).map((action, idx, arr) => (
                  <Pressable key={action.label}
                    onPress={action.onPress}
                    style={({ pressed }) => [styles.actionRow, { borderBottomWidth: idx < arr.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[styles.actionIcon, { backgroundColor: `${action.color}18` }]}>
                      <Ionicons name={action.icon} size={18} color={action.color} />
                    </View>
                    <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
                    {action.trailing}
                  </Pressable>
                ))}

                {!full.is_admin && (
                  <Pressable onPress={() => {
                    const newRole = full.role === "pro" ? "client" : "pro";
                    setSheetError(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    updateRoleMut.mutate(newRole);
                  }} style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[styles.actionIcon, { backgroundColor: `${Colors.pro}18` }]}>
                      <Ionicons name="swap-horizontal-outline" size={18} color={Colors.pro} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionLabel, { color: Colors.pro, flex: 0 }]}>Modifier le rôle</Text>
                      <Text style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>Actuellement : {full.role}</Text>
                    </View>
                    {updateRoleMut.isPending
                      ? <ActivityIndicator size="small" color={Colors.pro} />
                      : <Ionicons name="chevron-forward" size={14} color={TEXT3} />}
                  </Pressable>
                )}

                {full.is_active ? (
                  <Pressable onPress={() => { setSheetError(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); banMut.mutate(); }}
                    style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[styles.actionIcon, { backgroundColor: `${Colors.warning}18` }]}>
                      <Ionicons name="ban-outline" size={18} color={Colors.warning} />
                    </View>
                    <Text style={[styles.actionLabel, { color: Colors.warning }]}>Bannir l'utilisateur</Text>
                    {banMut.isPending && <ActivityIndicator size="small" color={Colors.warning} />}
                  </Pressable>
                ) : (
                  <Pressable onPress={() => unbanMut.mutate()}
                    style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 }]}>
                    <View style={[styles.actionIcon, { backgroundColor: `${Colors.success}18` }]}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                    </View>
                    <Text style={[styles.actionLabel, { color: Colors.success }]}>Réactiver le compte</Text>
                    {unbanMut.isPending && <ActivityIndicator size="small" color={Colors.success} />}
                  </Pressable>
                )}

                <Pressable onPress={() => { setSheetError(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); deleteMut.mutate(); }}
                  style={({ pressed }) => [styles.actionRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 }]}>
                  <View style={[styles.actionIcon, { backgroundColor: `${Colors.destructive}14` }]}>
                    <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                  </View>
                  <Text style={[styles.actionLabel, { color: Colors.destructive }]}>Supprimer définitivement</Text>
                  {deleteMut.isPending && <ActivityIndicator size="small" color={Colors.destructive} />}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
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
  const scale    = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 20, stiffness: 200 }).start();

  const renderRightActions = () => (
    <View style={{ flexDirection: "row", marginBottom: 10, marginLeft: 6, overflow: "hidden", borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }}>
      <Pressable onPress={() => { swipeRef.current?.close(); onBan(); }}
        style={{ width: 80, backgroundColor: "rgba(245,158,11,0.85)", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={22} color={Colors.white} />
        <Text style={{ color: Colors.white, fontSize: 11, fontWeight: "700" }}>{item.is_active ? "Bannir" : "Réactiver"}</Text>
      </Pressable>
      <Pressable onPress={() => { swipeRef.current?.close(); onDelete(); }}
        style={{ width: 80, backgroundColor: "rgba(240,58,58,0.85)", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Ionicons name="trash-outline" size={22} color={Colors.white} />
        <Text style={{ color: Colors.white, fontSize: 11, fontWeight: "700" }}>Suppr.</Text>
      </Pressable>
    </View>
  );

  const renderLeftActions = () => (
    <View style={{ width: 86, marginBottom: 10, marginRight: 6, overflow: "hidden", borderTopRightRadius: 18, borderBottomRightRadius: 18 }}>
      <Pressable onPress={() => { swipeRef.current?.close(); onGrant(); }} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: Colors.admin, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <Ionicons name="gift-outline" size={22} color={Colors.white} />
          <Text style={{ color: Colors.white, fontSize: 11, fontWeight: "700" }}>Abonnement</Text>
        </View>
      </Pressable>
    </View>
  );

  return (
    <Swipeable ref={swipeRef}
      renderRightActions={item.is_admin ? undefined : renderRightActions}
      renderLeftActions={item.is_admin ? undefined : renderLeftActions}
      overshootRight={false} overshootLeft={false} friction={2}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          delayLongPress={380}
          style={{
            backgroundColor: CARD_BG,
            borderRadius: 20,
            marginBottom: 10,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: BORDER,
            shadowColor: Colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 4,
            opacity: item.is_active ? 1 : 0.55,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Left color bar */}
            <View style={{ width: 4, alignSelf: "stretch", backgroundColor: accentL, opacity: 0.9, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />

            {/* Avatar */}
            <View style={{ paddingLeft: 13, paddingVertical: 14 }}>
              <Avatar name={name} size={52} />
            </View>

            {/* Info */}
            <View style={{ flex: 1, paddingLeft: 12, paddingVertical: 14, gap: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontWeight: "800", fontSize: 15, color: TEXT1, flex: 1, letterSpacing: -0.3 }} numberOfLines={1}>{name}</Text>
                {!item.is_active ? (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(240,58,58,0.2)", borderWidth: 1, borderColor: "rgba(240,58,58,0.4)" }}>
                    <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.destructiveLight, letterSpacing: 0.3 }}>BANNI</Text>
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${rc}20`, borderWidth: 1, borderColor: `${rc}40` }}>
                    <Text style={{ fontSize: 9, fontWeight: "900", color: rc, textTransform: "uppercase", letterSpacing: 0.4 }}>{roleName(item)}</Text>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 16 }} numberOfLines={1}>{item.email}</Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {plan && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(251,191,36,0.3)" }}>
                    <Text style={{ fontSize: 9 }}>⭐</Text>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: "#FBBF24" }}>{plan.toUpperCase()}</Text>
                  </View>
                )}
                {joined && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Ionicons name="time-outline" size={10} color={TEXT3} />
                    <Text style={{ fontSize: 10, color: TEXT3 }}>Depuis {joined}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Chevron pill */}
            <View style={{ paddingRight: 12 }}>
              <View style={{ padding: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8 }}>
                {Platform.OS === "ios"
                  ? <SymbolView name="chevron.right" size={12} tintColor="rgba(255,255,255,0.25)" />
                  : <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.25)" />}
              </View>
            </View>
          </View>

          {/* Stats footer */}
          {stats && (
            <>
              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 14 }} />
              <View style={{ flexDirection: "row", paddingVertical: 9 }}>
                {([
                  { icon: "calendar-outline"  as const, value: stats.total_bookings,                            label: "RDV",      color: Colors.info },
                  { icon: "checkmark-outline" as const, value: stats.completed,                                 label: "Terminés", color: Colors.success },
                  { icon: "close-outline"     as const, value: stats.cancelled,                                 label: "Annulés",  color: Colors.destructive },
                  { icon: "card-outline"      as const, value: `${Number(stats.total_spent ?? 0).toFixed(0)}€`, label: "Dépensé",  color: Colors.admin },
                ]).map(({ icon, value, label, color: c }, idx, arr) => (
                  <View key={label} style={{ flex: 1, alignItems: "center", borderRightWidth: idx < arr.length - 1 ? 1 : 0, borderRightColor: "rgba(255,255,255,0.06)" }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: c }}>{value}</Text>
                    <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const qc = useQueryClient();
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState<RoleFilter>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget]   = useState<AdminUser | null>(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [usersError, setUsersError]     = useState<string | null>(null);
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
    onError: () => setUsersError("Impossible de bannir cet utilisateur."),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteUser(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => setUsersError("Impossible de supprimer cet utilisateur."),
  });

  const users       = (data?.data as AdminUser[] | undefined) ?? [];
  const activeCount = users.filter((u) =>  u.is_active).length;
  const bannedCount = users.filter((u) => !u.is_active).length;
  const onRefresh   = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const listData = useMemo((): ListItem[] => {
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
            setUsersError(null);
            banMut.mutate(item.id);
          } else if (idx === 4) {
            setUsersError(null);
            deleteMut.mutate(item.id);
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
        onBan={() => { setUsersError(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); banMut.mutate(u.id); }}
        onDelete={() => { setUsersError(null); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); deleteMut.mutate(u.id); }}
        onGrant={() => setGrantTarget(u)}
      />
    );
  }, [banMut, deleteMut, handleLongPress]);

  const msg = EMPTY[roleFilter];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: "rgba(10,10,15,0.85)", overflow: "hidden" }}>
          <BlurView tint="dark" intensity={60} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 32, fontWeight: "900", color: TEXT1, letterSpacing: -1 }}>Utilisateurs</Text>
              {!isLoading && (
                <Text style={{ fontSize: 12, color: TEXT2, marginTop: 3 }}>
                  {activeCount} actif{activeCount !== 1 ? "s" : ""} · {bannedCount} banni{bannedCount !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            {!isLoading && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(249,115,22,0.2)", borderWidth: 1, borderColor: "rgba(249,115,22,0.4)" }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.admin }}>{users.length}</Text>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", height: 50, paddingHorizontal: 16, marginBottom: 14 }}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher par nom ou email…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={{ flex: 1, fontSize: 14, color: TEXT1 }}
              autoCorrect={false} spellCheck={false} returnKeyType="search"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            />
            {Platform.OS !== "ios" && search.length > 0 && (
              <AnimatedIconButton onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
              </AnimatedIconButton>
            )}
          </View>

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
            {FILTERS.map(({ value, label, icon, color: pillColor }) => {
              const active = roleFilter === value;
              return (
                <AnimatedPressable key={value}
                  onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
                    backgroundColor: active ? `${pillColor}28` : "rgba(255,255,255,0.06)",
                    borderColor:     active ? `${pillColor}55` : "rgba(255,255,255,0.10)",
                  }}>
                  <Ionicons name={icon} size={12} color={active ? pillColor : TEXT2} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? pillColor : TEXT2 }}>{label}</Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>

          {usersError && <View style={{ marginBottom: 8 }}><ErrorMessage message={usersError} /></View>}

          {/* Mini stats strip */}
          {!isLoading && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Total",   value: users.length,  color: Colors.admin },
                { label: "Actifs",  value: activeCount,   color: Colors.success },
                { label: "Bannis",  value: bannedCount,   color: Colors.destructive },
              ].map(({ label, value, color: c }) => (
                <View key={label} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: c }}>{value}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: c, opacity: 0.7 }}>{label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ══ LIST ════════════════════════════════════════════════════════════ */}
        {isLoading ? (
          <UserSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={listData}
            keyExtractor={(item) => item._type === "header" ? `h-${item.label}` : String(item.data.id)}
            renderItem={renderItem}
            contentContainerStyle={{ backgroundColor: BG, paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={7}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <LinearGradient
                  colors={["rgba(249,115,22,0.15)", "rgba(249,115,22,0.04)"]}
                  style={{ width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <Ionicons name="people-outline" size={36} color={Colors.admin} />
                </LinearGradient>
                <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT1, marginBottom: 6 }}>{msg.title}</Text>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textAlign: "center", paddingHorizontal: 40, lineHeight: 20 }}>{msg.sub}</Text>
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
  );
}

// ── StyleSheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  label: {
    fontSize: 10, fontWeight: "800",
    color: "rgba(255,255,255,0.4)",
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
