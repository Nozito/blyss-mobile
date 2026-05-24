import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type RoleFilter = "all" | "pro" | "client" | "banned";

const ROLE_COLORS = { pro: "#A78BFA", client: "#38BDF8", admin: ACCENT };
const PLAN_OPTS = ["start", "serenite", "signature"] as const;
const PLAN_LABELS = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const MONTHS_OPTS = [1, 3, 6, 12];

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "rgba(249,115,22,0.2)", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.35, fontWeight: "800", color: ACCENT }}>{initials}</Text>
    </View>
  );
}

// ── Grant subscription modal ──────────────────────────────────────────────────
function GrantModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<typeof PLAN_OPTS[number]>("start");
  const [months, setMonths] = useState(1);

  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(user.id, { plan, months }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      Alert.alert("✅ Accordé", `Abonnement ${PLAN_LABELS[plan]} (${months} mois) accordé à ${user.first_name}.`);
      onClose();
    },
    onError: () => Alert.alert("Erreur", "Impossible d'accorder l'abonnement."),
  });

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={{ backgroundColor: "#131720", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: BORDER }} onPress={() => {}}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: TEXT }}>Offrir un abonnement</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></Pressable>
          </View>
          <Text style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Pour {user.first_name} {user.last_name}</Text>

          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p} onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? ACCENT : BORDER, backgroundColor: plan === p ? "rgba(249,115,22,0.12)" : CARD }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? ACCENT : MUTED }}>{PLAN_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m} onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? ACCENT : BORDER, backgroundColor: months === m ? "rgba(249,115,22,0.12)" : CARD }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? ACCENT : MUTED }}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => grantMut.mutate()} disabled={grantMut.isPending}
            style={{ height: 52, borderRadius: 16, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: grantMut.isPending ? 0.7 : 1 }}>
            {grantMut.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="gift-outline" size={18} color="#fff" /><Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Accorder</Text></>}
          </Pressable>
        </Pressable>
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
  const fullUser = (fullData?.data as AdminUser | undefined) ?? user;

  const banMut = useMutation({
    mutationFn: () => adminApi.banUser(user.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onClose();
    },
    onError: () => Alert.alert("Erreur", "Impossible de bannir."),
  });
  const unbanMut = useMutation({
    mutationFn: () => adminApi.unbanUser(user.id),
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", user.id] });
      onClose();
    },
    onError: () => Alert.alert("Erreur", "Impossible de réactiver."),
  });
  const deleteMut = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: () => Alert.alert("Erreur", "Suppression impossible."),
  });

  const confirmBan = () => Alert.alert("Bannir", `Bannir ${user.first_name} ?`, [
    { text: "Annuler", style: "cancel" },
    { text: "Bannir", style: "destructive", onPress: () => banMut.mutate() },
  ]);

  const confirmDelete = () => Alert.alert("Supprimer", `Supprimer définitivement ${user.first_name} ?`, [
    { text: "Annuler", style: "cancel" },
    { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate() },
  ]);

  const roleColor = fullUser.is_admin ? ROLE_COLORS.admin : ROLE_COLORS[fullUser.role];
  const stats = fullUser.stats;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
        <ScrollView
          style={{ backgroundColor: "#131720", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: BORDER }}
          contentContainerStyle={{ padding: 24 }}
          onStartShouldSetResponder={() => true}
        >
          {/* User header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <Avatar name={`${fullUser.first_name} ${fullUser.last_name}`} size={54} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: TEXT }}>{fullUser.first_name} {fullUser.last_name}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: `${roleColor}20` }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: roleColor, textTransform: "uppercase" }}>
                    {fullUser.is_admin ? "admin" : fullUser.role}
                  </Text>
                </View>
                {!fullUser.is_active && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(248,113,113,0.15)" }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: "#F87171" }}>BANNI</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{fullUser.email}</Text>
            </View>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></Pressable>
          </View>

          {/* Stats */}
          {stats && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              {[
                { label: "RDV", value: stats.total_bookings, color: "#38BDF8" },
                { label: "Terminés", value: stats.completed, color: "#4ADE80" },
                { label: "Annulés", value: stats.cancelled, color: "#F87171" },
                { label: "Dépensé", value: `${Number(stats.total_spent).toFixed(0)}€`, color: ACCENT },
              ].map(({ label, value, color }) => (
                <View key={label} style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 10, alignItems: "center", borderWidth: 1, borderColor: BORDER }}>
                  <Text style={{ fontSize: 16, fontWeight: "900", color }}>{value}</Text>
                  <Text style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Infos */}
          <View style={{ gap: 8, marginBottom: 20 }}>
            {[
              { icon: "call-outline" as const, value: fullUser.phone_number },
              { icon: "location-outline" as const, value: fullUser.city },
              { icon: "calendar-outline" as const, value: fullUser.created_at ? `Inscrit le ${new Date(fullUser.created_at).toLocaleDateString("fr-FR")}` : null },
            ].filter((r) => r.value).map(({ icon, value }) => (
              <View key={icon} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name={icon} size={14} color={MUTED} />
                <Text style={{ fontSize: 12, color: MUTED }}>{value}</Text>
              </View>
            ))}
          </View>

          {/* Subscription history */}
          {(fullUser.subscription_history ?? []).length > 0 && (
            <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: TEXT, marginBottom: 10 }}>Historique abonnements</Text>
              {(fullUser.subscription_history ?? []).slice(0, 3).map((sub) => (
                <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: BORDER }}>
                  <Text style={{ fontSize: 12, color: TEXT, fontWeight: "600", textTransform: "capitalize" }}>{sub.plan}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 11, color: MUTED }}>{new Date(sub.start_date).toLocaleDateString("fr-FR")}</Text>
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: sub.status === "active" ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)" }}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: sub.status === "active" ? "#4ADE80" : MUTED, textTransform: "uppercase" }}>{sub.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={{ gap: 10, paddingBottom: 24 }}>
            <Pressable onPress={() => { onClose(); onGrant(); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: "rgba(74,222,128,0.12)", borderWidth: 1, borderColor: "rgba(74,222,128,0.25)" }}>
              <Ionicons name="gift-outline" size={20} color="#4ADE80" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#4ADE80" }}>Offrir un abonnement</Text>
            </Pressable>

            {fullUser.is_active
              ? (
                <Pressable onPress={confirmBan}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: "rgba(251,191,36,0.12)", borderWidth: 1, borderColor: "rgba(251,191,36,0.25)" }}>
                  <Ionicons name="ban-outline" size={20} color="#FBBF24" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#FBBF24" }}>Bannir</Text>
                </Pressable>
              )
              : (
                <Pressable onPress={() => unbanMut.mutate()}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: "rgba(74,222,128,0.12)", borderWidth: 1, borderColor: "rgba(74,222,128,0.25)" }}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#4ADE80" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#4ADE80" }}>Réactiver</Text>
                </Pressable>
              )
            }

            <Pressable onPress={confirmDelete}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: "rgba(248,113,113,0.10)", borderWidth: 1, borderColor: "rgba(248,113,113,0.2)" }}>
              <Ionicons name="trash-outline" size={20} color="#F87171" />
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#F87171" }}>Supprimer définitivement</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch, roleFilter],
    queryFn: () => adminApi.getUsers({
      search: debouncedSearch || undefined,
      limit: 80,
      role: (roleFilter === "all" || roleFilter === "banned") ? undefined : roleFilter,
      banned: roleFilter === "banned" ? true : undefined,
    }),
  });

  const users = (data?.data as AdminUser[] | undefined) ?? [];

  const FILTERS: { value: RoleFilter; label: string }[] = [
    { value: "all",    label: "Tous" },
    { value: "pro",    label: "Pros" },
    { value: "client", label: "Clients" },
    { value: "banned", label: "Bannis" },
  ];

  const renderItem = useCallback(({ item }: { item: AdminUser }) => {
    const roleColor = item.is_admin ? ROLE_COLORS.admin : ROLE_COLORS[item.role];
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setSelectedUser(item);
        }}
        style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: CARD, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1, borderColor: BORDER }}
      >
        <Avatar name={`${item.first_name} ${item.last_name}`} size={46} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT }}>
              {item.first_name} {item.last_name}
            </Text>
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: `${roleColor}20` }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: roleColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {item.is_admin ? "admin" : item.role}
              </Text>
            </View>
            {!item.is_active && (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: "rgba(248,113,113,0.15)" }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#F87171" }}>BANNI</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }} numberOfLines={1}>{item.email}</Text>
          {item.role === "pro" && item.pro_status && (
            <Text style={{ fontSize: 11, color: item.pro_status === "active" ? "#4ADE80" : MUTED, marginTop: 1 }}>
              Abo: {item.pro_status}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={MUTED} />
      </Pressable>
    );
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>Utilisateurs</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{users.length} résultats</Text>
        </View>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: BORDER, marginBottom: 12 }}>
          <Ionicons name="search-outline" size={16} color={MUTED} />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Rechercher par nom ou email…"
            placeholderTextColor={MUTED}
            style={{ flex: 1, fontSize: 14, color: TEXT }}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color={MUTED} /></Pressable>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(({ value, label }) => (
            <Pressable
              key={value}
              onPress={() => {
                setRoleFilter(value);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                backgroundColor: roleFilter === value ? ACCENT : CARD,
                borderColor: roleFilter === value ? ACCENT : BORDER }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: roleFilter === value ? "#fff" : MUTED }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.08)" />
              <Text style={{ fontSize: 14, color: MUTED, marginTop: 12 }}>Aucun utilisateur trouvé</Text>
            </View>
          }
        />
      )}

      {selectedUser && (
        <UserDetailSheet
          user={selectedUser}
          onGrant={() => setGrantTarget(selectedUser)}
          onClose={() => setSelectedUser(null)}
        />
      )}
      {grantTarget && (
        <GrantModal user={grantTarget} onClose={() => setGrantTarget(null)} />
      )}
    </View>
  );
}
