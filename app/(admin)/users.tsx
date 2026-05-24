import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView, RefreshControl,
  ActionSheetIOS, Platform,
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

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";

type RoleFilter = "all" | "pro" | "client" | "banned";

const PLAN_OPTS = ["start", "serenite", "signature"] as const;
const PLAN_LABELS = { start: "Start", serenite: "Sérénité", signature: "Signature" };
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

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const [start, end] = avatarColors(name);
  return (
    <LinearGradient
      colors={[start, end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: 12,
        alignItems: "center", justifyContent: "center",
        shadowColor: start, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: Math.round(size * 0.32) }}>{initials(name)}</Text>
    </LinearGradient>
  );
}

// ── Grant modal ───────────────────────────────────────────────────────────────
function GrantModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<typeof PLAN_OPTS[number]>("serenite");
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
      <Pressable style={{ flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" }} onPress={onClose}>
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingBottom: 36, borderTopWidth: 1, borderColor: A_BORDER }}>
          <View style={{ alignItems: "center", paddingTop: 12, marginBottom: 24 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: A_BORDER }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Avatar name={`${user.first_name} ${user.last_name}`} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>Offrir un abonnement</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>pour {user.first_name} {user.last_name}</Text>
            </View>
            <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: A_BG, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={Colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 22 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p}
                onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? Colors.admin : A_BORDER, backgroundColor: plan === p ? `${Colors.admin}12` : A_BG }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? Colors.admin : Colors.mutedForeground }}>{PLAN_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 28 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m}
                onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? Colors.admin : A_BORDER, backgroundColor: months === m ? `${Colors.admin}12` : A_BG }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? Colors.admin : Colors.mutedForeground }}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => grantMut.mutate()} disabled={grantMut.isPending} style={{ opacity: grantMut.isPending ? 0.7 : 1 }}>
            <LinearGradient
              colors={["#EA6000", "#F97316", "#FBAB6A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
            >
              {grantMut.isPending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <><Ionicons name="gift-outline" size={20} color={Colors.white} /><Text style={{ fontSize: 16, fontWeight: "800", color: Colors.white }}>Accorder l'abonnement</Text></>}
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
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
  const full = (fullData?.data as AdminUser | undefined) ?? user;
  const stats = full.stats;
  const rc = roleColor(full);
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

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" }} onPress={onClose}>
        <ScrollView
          style={{ backgroundColor: A_BG, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "90%" }}
          contentContainerStyle={{ paddingBottom: 36 }}
          onStartShouldSetResponder={() => true}
        >
          {/* Hero gradient */}
          <LinearGradient
            colors={[ac, ac2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 20, paddingBottom: 28, paddingHorizontal: 24, alignItems: "center" }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", marginBottom: 20 }} />
            <LinearGradient
              colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0.15)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}
            >
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>{initials(`${full.first_name} ${full.last_name}`)}</Text>
            </LinearGradient>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 4 }}>{full.first_name} {full.last_name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)" }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>{full.is_admin ? "ADMIN" : full.role?.toUpperCase()}</Text>
              </View>
              {!full.is_active && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(240,58,58,0.4)" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>BANNI</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 6 }}>{full.email}</Text>
            <Pressable onPress={onClose} style={{ position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </LinearGradient>

          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Bento stats */}
            {stats && (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "RDV",      value: stats.total_bookings, color: Colors.info },
                  { label: "Terminés", value: stats.completed,      color: Colors.success },
                  { label: "Annulés",  value: stats.cancelled,      color: Colors.destructive },
                  { label: "Total €",  value: `${Number(stats.total_spent).toFixed(0)}€`, color: Colors.admin },
                ].map(({ label, value, color: c }) => (
                  <View key={label} style={{ flex: 1, backgroundColor: A_BG, borderRadius: 14, padding: 10, alignItems: "center", borderWidth: 1, borderColor: A_BORDER }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: c }}>{value}</Text>
                    <Text style={{ fontSize: 9, color: Colors.mutedForeground, marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Subscription history */}
            {(full.subscription_history ?? []).length > 0 && (
              <View style={{ backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: A_BORDER, marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.foreground, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Abonnements</Text>
                {(full.subscription_history ?? []).slice(0, 4).map((sub, i) => (
                  <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: A_BORDER }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sub.status === "active" ? Colors.success : Colors.mutedForeground }} />
                      <Text style={{ fontSize: 13, color: Colors.foreground, fontWeight: "600", textTransform: "capitalize" }}>{sub.plan}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{new Date(sub.start_date).toLocaleDateString("fr-FR")}</Text>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: sub.status === "active" ? `${Colors.success}20` : A_BG }}>
                        <Text style={{ fontSize: 8, fontWeight: "800", color: sub.status === "active" ? Colors.success : Colors.mutedForeground, textTransform: "uppercase" }}>{sub.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={{ backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: A_BORDER, overflow: "hidden", marginBottom: 10 }}>
              {/* Offrir abonnement */}
              <Pressable onPress={() => { onClose(); onGrant(); }}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: A_BORDER, opacity: pressed ? 0.7 : 1 }]}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.admin}14`, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="gift-outline" size={18} color={Colors.admin} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: Colors.admin }}>Offrir un abonnement</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />
              </Pressable>

              {/* Modifier le rôle */}
              {!full.is_admin && (
                <Pressable onPress={() => {
                  const newRole = full.role === "pro" ? "client" : "pro";
                  Alert.alert("Modifier le rôle", `Passer ${full.first_name} en ${newRole} ?`, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Confirmer", onPress: () => updateRoleMut.mutate(newRole) },
                  ]);
                }}
                  style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: A_BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.pro}14`, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="swap-horizontal-outline" size={18} color={Colors.pro} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.pro }}>Modifier le rôle</Text>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>Actuellement : {full.role}</Text>
                  </View>
                  {updateRoleMut.isPending && <ActivityIndicator size="small" color={Colors.pro} />}
                </Pressable>
              )}

              {/* Ban/Réactiver */}
              {full.is_active ? (
                <Pressable onPress={() => Alert.alert("Bannir", `Bannir ${full.first_name} ?`, [
                  { text: "Annuler", style: "cancel" },
                  { text: "Bannir", style: "destructive", onPress: () => banMut.mutate() },
                ])} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: A_BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.warning}14`, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="ban-outline" size={18} color={Colors.warning} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: Colors.warning }}>Bannir l'utilisateur</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => unbanMut.mutate()}
                  style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: A_BORDER, opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.success}14`, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: Colors.success }}>Réactiver le compte</Text>
                </Pressable>
              )}

              {/* Supprimer */}
              <Pressable onPress={() => Alert.alert("Supprimer", `Supprimer ${full.first_name} définitivement ?`, [
                { text: "Annuler", style: "cancel" },
                { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate() },
              ])} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, opacity: pressed ? 0.7 : 1 }]}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.destructive}10`, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "800", color: Colors.destructive }}>Supprimer définitivement</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

// ── Swipeable user card ───────────────────────────────────────────────────────
function UserCard({
  item, onPress, onLongPress, onBan, onDelete, onGrant,
}: {
  item: AdminUser;
  onPress: () => void;
  onLongPress: () => void;
  onBan: () => void;
  onDelete: () => void;
  onGrant: () => void;
}) {
  const rc   = roleColor(item);
  const name = `${item.first_name} ${item.last_name}`;
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={{ flexDirection: "row", width: 160, marginBottom: 10, borderRadius: 16, overflow: "hidden" }}>
      <Pressable
        onPress={() => { swipeRef.current?.close(); onBan(); }}
        style={{ width: 80, backgroundColor: Colors.warning, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>
          {item.is_active ? "Bannir" : "Réactiver"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => { swipeRef.current?.close(); onDelete(); }}
        style={{ width: 80, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>Suppr.</Text>
      </Pressable>
    </View>
  );

  const renderLeftActions = () => (
    <Pressable
      onPress={() => { swipeRef.current?.close(); onGrant(); }}
      style={{ width: 100, marginBottom: 10, borderRadius: 16, overflow: "hidden" }}
    >
      <LinearGradient
        colors={["#EA6000", "#F97316"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="gift-outline" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>Abo</Text>
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
        delayLongPress={350}
        style={({ pressed }) => [{
          backgroundColor: Colors.card,
          borderRadius: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: A_BORDER,
          shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
          paddingHorizontal: 14, paddingVertical: 13,
          flexDirection: "row", alignItems: "center", gap: 12,
          opacity: pressed ? 0.9 : 1,
        }]}
      >
        {/* Avatar 44×44 */}
        <Avatar name={name} size={44} />

        {/* Info */}
        <View style={{ flex: 1 }}>
          {/* Ligne 1 : nom + badges */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <Text style={{ fontWeight: "800", fontSize: 14, color: Colors.foreground, flex: 1 }} numberOfLines={1}>
              {name}
            </Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: `${rc}14` }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: rc, textTransform: "uppercase" }}>
                {roleName(item)}
              </Text>
            </View>
            {!item.is_active && (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: `${Colors.destructive}14` }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: Colors.destructive }}>BANNI</Text>
              </View>
            )}
          </View>

          {/* Ligne 2 : email + date */}
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }} numberOfLines={1}>
            {item.email}
            {(item as any).created_at
              ? ` · depuis ${new Date((item as any).created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}`
              : ""}
          </Text>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={13} color={Colors.mutedForeground} />
      </Pressable>
    </Swipeable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const debouncedSearch = useDebounce(search, 380);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", debouncedSearch, roleFilter],
    queryFn: () => adminApi.getUsers({
      search: debouncedSearch || undefined,
      limit: 80,
      role: (roleFilter === "all" || roleFilter === "banned") ? undefined : roleFilter,
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

  const users = (data?.data as AdminUser[] | undefined) ?? [];
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const handleLongPress = useCallback((item: AdminUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});

    if (Platform.OS === "ios") {
      const options = [
        "Annuler",
        "👁  Voir le profil",
        "🎁  Offrir un abonnement",
        item.is_active ? "⚠️  Bannir" : "✅  Réactiver",
        "🗑  Supprimer",
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `${item.first_name} ${item.last_name}`,
          message: item.email,
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: item.is_active ? [3, 4] : [4],
        },
        (idx) => {
          if (idx === 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setSelectedUser(item);
          } else if (idx === 2) {
            setGrantTarget(item);
          } else if (idx === 3) {
            const action = item.is_active ? "Bannir" : "Réactiver";
            Alert.alert(action, `${action} ${item.first_name} ?`, [
              { text: "Annuler", style: "cancel" },
              { text: action, style: item.is_active ? "destructive" : "default",
                onPress: () => banMut.mutate(item.id) },
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

  const FILTERS: { value: RoleFilter; label: string }[] = [
    { value: "all",    label: "Tous" },
    { value: "pro",    label: "Pros" },
    { value: "client", label: "Clients" },
    { value: "banned", label: "Bannis" },
  ];

  const renderItem = useCallback(({ item }: { item: AdminUser }) => (
    <UserCard
      item={item}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedUser(item);
      }}
      onLongPress={() => handleLongPress(item)}
      onBan={() => {
        const action = item.is_active ? "Bannir" : "Réactiver";
        Alert.alert(action, `${action} ${item.first_name} ?`, [
          { text: "Annuler", style: "cancel" },
          { text: action, style: item.is_active ? "destructive" : "default",
            onPress: () => banMut.mutate(item.id) },
        ]);
      }}
      onDelete={() => {
        Alert.alert("Supprimer", `Supprimer ${item.first_name} définitivement ?`, [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate(item.id) },
        ]);
      }}
      onGrant={() => setGrantTarget(item)}
    />
  ), [banMut, deleteMut, handleLongPress]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: A_BG }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: A_BORDER }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: Colors.admin }} />
              <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>Utilisateurs</Text>
            </View>
            {!isLoading && (
              <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: A_BG, borderWidth: 1, borderColor: A_BORDER }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.mutedForeground }}>{users.length}</Text>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: A_BG, borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: A_BORDER, marginBottom: 12 }}>
            <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Nom, email…"
              placeholderTextColor={Colors.mutedForeground}
              style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="search"
              clearButtonMode={Platform.OS === "ios" ? "while-editing" : "never"}
            />
            {Platform.OS !== "ios" && search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={Colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Filter pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTERS.map(({ value, label }) => (
              <Pressable key={value}
                onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
                  backgroundColor: roleFilter === value ? `${Colors.admin}14` : A_BG,
                  borderColor: roleFilter === value ? `${Colors.admin}40` : A_BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: roleFilter === value ? Colors.admin : Colors.mutedForeground }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={Colors.admin} />
          </View>
        ) : (
          <FlashList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            estimatedItemSize={88}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 90 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Ionicons name="people-outline" size={32} color={A_BORDER} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>Aucun utilisateur trouvé</Text>
                <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Modifie les filtres ou la recherche.</Text>
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
