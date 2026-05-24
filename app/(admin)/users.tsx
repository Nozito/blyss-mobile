import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView, RefreshControl,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Colors } from "@/constants/colors";

type RoleFilter = "all" | "pro" | "client" | "banned";

const PLAN_OPTS = ["start", "serenite", "signature"] as const;
const PLAN_LABELS = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const MONTHS_OPTS = [1, 3, 6, 12];

const AVATAR_PALETTE = [Colors.admin, Colors.pro, Colors.info, Colors.success, Colors.primary, Colors.warning];

function initials(name: string) {
  return name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function roleColor(user: Pick<AdminUser, "is_admin" | "role">) {
  if (user.is_admin) return Colors.admin;
  if (user.role === "pro") return Colors.pro;
  return Colors.client;
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const color = avatarColor(name);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, borderWidth: 1.5, borderColor: `${color}44`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.33, fontWeight: "800", color }}>{initials(name)}</Text>
    </View>
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
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>Offrir un abonnement</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={Colors.mutedForeground} /></Pressable>
          </View>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 20 }}>Pour {user.first_name} {user.last_name}</Text>

          <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p} onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? Colors.admin : Colors.border, backgroundColor: plan === p ? `${Colors.admin}15` : Colors.muted }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? Colors.admin : Colors.mutedForeground }}>{PLAN_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m} onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? Colors.admin : Colors.border, backgroundColor: months === m ? `${Colors.admin}15` : Colors.muted }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? Colors.admin : Colors.mutedForeground }}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => grantMut.mutate()} disabled={grantMut.isPending}
            style={{ height: 52, borderRadius: 16, backgroundColor: Colors.admin, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: grantMut.isPending ? 0.7 : 1 }}>
            {grantMut.isPending
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <><Ionicons name="gift-outline" size={18} color={Colors.white} /><Text style={{ fontSize: 15, fontWeight: "800", color: Colors.white }}>Accorder</Text></>}
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

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" }} onPress={onClose}>
        <ScrollView
          style={{ backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: Colors.border, maxHeight: "88%" }}
          contentContainerStyle={{ padding: 24 }}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <Avatar name={`${full.first_name} ${full.last_name}`} size={54} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground }}>{full.first_name} {full.last_name}</Text>
                <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: `${rc}18` }}>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: rc, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {full.is_admin ? "admin" : full.role}
                  </Text>
                </View>
                {!full.is_active && (
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: `${Colors.destructive}18` }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: Colors.destructive }}>BANNI</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{full.email}</Text>
            </View>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={Colors.mutedForeground} /></Pressable>
          </View>

          {/* Stats row */}
          {stats && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {[
                { label: "RDV",      value: stats.total_bookings, color: Colors.info },
                { label: "Terminés", value: stats.completed,      color: Colors.success },
                { label: "Annulés",  value: stats.cancelled,      color: Colors.destructive },
                { label: "Total",    value: `${Number(stats.total_spent).toFixed(0)}€`, color: Colors.admin },
              ].map(({ label, value, color: c }) => (
                <View key={label} style={{ flex: 1, backgroundColor: Colors.muted, borderRadius: 14, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontSize: 17, fontWeight: "900", color: c }}>{value}</Text>
                  <Text style={{ fontSize: 9, color: Colors.mutedForeground, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Subscription history */}
          {(full.subscription_history ?? []).length > 0 && (
            <View style={{ backgroundColor: Colors.muted, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground, marginBottom: 10 }}>Historique abonnements</Text>
              {(full.subscription_history ?? []).slice(0, 4).map((sub, i) => (
                <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: Colors.border }}>
                  <Text style={{ fontSize: 12, color: Colors.foreground, fontWeight: "600", textTransform: "capitalize" }}>{sub.plan}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{new Date(sub.start_date).toLocaleDateString("fr-FR")}</Text>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: sub.status === "active" ? `${Colors.success}20` : Colors.muted }}>
                      <Text style={{ fontSize: 8, fontWeight: "800", color: sub.status === "active" ? Colors.success : Colors.mutedForeground, textTransform: "uppercase" }}>{sub.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={{ gap: 10, paddingBottom: 20 }}>
            <Pressable onPress={() => { onClose(); onGrant(); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: `${Colors.success}12`, borderWidth: 1, borderColor: `${Colors.success}30` }}>
              <Ionicons name="gift-outline" size={20} color={Colors.success} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.success }}>Offrir un abonnement</Text>
            </Pressable>
            {full.is_active ? (
              <Pressable onPress={() => Alert.alert("Bannir", `Bannir ${full.first_name} ?`, [
                { text: "Annuler", style: "cancel" },
                { text: "Bannir", style: "destructive", onPress: () => banMut.mutate() },
              ])} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: `${Colors.warning}12`, borderWidth: 1, borderColor: `${Colors.warning}30` }}>
                <Ionicons name="ban-outline" size={20} color={Colors.warning} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.warning }}>Bannir</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => unbanMut.mutate()}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: `${Colors.success}12`, borderWidth: 1, borderColor: `${Colors.success}30` }}>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.success }}>Réactiver</Text>
              </Pressable>
            )}
            <Pressable onPress={() => Alert.alert("Supprimer", `Supprimer ${full.first_name} définitivement ?`, [
              { text: "Annuler", style: "cancel" },
              { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate() },
            ])} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: `${Colors.destructive}10`, borderWidth: 1, borderColor: `${Colors.destructive}25` }}>
              <Ionicons name="trash-outline" size={20} color={Colors.destructive} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.destructive }}>Supprimer définitivement</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ item, onPress, onBan }: { item: AdminUser; onPress: () => void; onBan: () => void }) {
  const rc = roleColor(item);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: Colors.card,
        borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13,
        marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
        opacity: pressed ? 0.88 : 1,
        shadowColor: Colors.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
      }]}
    >
      <Avatar name={`${item.first_name} ${item.last_name}`} size={44} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.foreground }}>{item.first_name} {item.last_name}</Text>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${rc}18` }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: rc, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {item.is_admin ? "admin" : item.role}
            </Text>
          </View>
          {!item.is_active && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${Colors.destructive}18` }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: Colors.destructive }}>BANNI</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 11, color: Colors.mutedForeground }} numberOfLines={1}>{item.email}</Text>
      </View>
      {!item.is_admin && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onBan(); }}
          hitSlop={8}
          style={{ width: 32, height: 32, borderRadius: 10,
            backgroundColor: item.is_active ? `${Colors.destructive}12` : `${Colors.success}12`,
            alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={16} color={item.is_active ? Colors.destructive : Colors.success} />
        </Pressable>
      )}
      <Ionicons name="chevron-forward" size={15} color={Colors.mutedForeground} />
    </Pressable>
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

  const users = (data?.data as AdminUser[] | undefined) ?? [];
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const FILTERS: { value: RoleFilter; label: string }[] = [
    { value: "all",    label: "Tous" },
    { value: "pro",    label: "Pros" },
    { value: "client", label: "Clients" },
    { value: "banned", label: "Bannis" },
  ];

  const renderItem = useCallback(({ item }: { item: AdminUser }) => (
    <UserRow
      item={item}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedUser(item);
      }}
      onBan={() => {
        const action = item.is_active ? "Bannir" : "Réactiver";
        Alert.alert(action, `${action} ${item.first_name} ?`, [
          { text: "Annuler", style: "cancel" },
          { text: action, style: item.is_active ? "destructive" : "default", onPress: () => banMut.mutate(item.id) },
        ]);
      }}
    />
  ), [banMut]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Search + filters */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.muted, borderRadius: 16, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 }}>
          <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Nom, email…"
            placeholderTextColor={Colors.mutedForeground}
            style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color={Colors.mutedForeground} /></Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(({ value, label }) => (
            <Pressable key={value}
              onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
              style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
                backgroundColor: roleFilter === value ? Colors.admin : Colors.muted,
                borderColor: roleFilter === value ? Colors.admin : Colors.border }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: roleFilter === value ? Colors.white : Colors.mutedForeground }}>{label}</Text>
            </Pressable>
          ))}
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.muted, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground }}>{users.length} résultats</Text>
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={Colors.admin} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="people-outline" size={44} color={Colors.border} />
              <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginTop: 12 }}>Aucun utilisateur trouvé</Text>
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
