import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type UserRole = "all" | "pro" | "client";
type AdminUser = {
  id: number; first_name: string; last_name: string; email: string;
  role: "client" | "pro"; is_active: boolean; is_admin: boolean;
  created_at: string; profile_photo?: string | null; pro_status?: string | null;
};

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

  const grantMutation = useMutation({
    mutationFn: () => adminApi.grantSubscription(user.id, { plan, months }),
    onSuccess: () => {
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
          <Text style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>
            Pour {user.first_name} {user.last_name}
          </Text>

          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPlan(p)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? ACCENT : BORDER,
                  backgroundColor: plan === p ? "rgba(249,115,22,0.12)" : CARD }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? ACCENT : MUTED }}>{PLAN_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMonths(m)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? ACCENT : BORDER,
                  backgroundColor: months === m ? "rgba(249,115,22,0.12)" : CARD }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? ACCENT : MUTED }}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => grantMutation.mutate()}
            disabled={grantMutation.isPending}
            style={{ height: 52, borderRadius: 16, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: grantMutation.isPending ? 0.7 : 1 }}
          >
            {grantMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="gift-outline" size={18} color="#fff" /><Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Accorder</Text></>}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── User action sheet ─────────────────────────────────────────────────────────
function UserActions({ user, onGrant, onClose }: { user: AdminUser; onGrant: () => void; onClose: () => void }) {
  const qc = useQueryClient();

  const deactivateMut = useMutation({
    mutationFn: () => adminApi.deactivateUser(user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); onClose(); },
  });
  const reactivateMut = useMutation({
    mutationFn: () => adminApi.reactivateUser(user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); onClose(); },
  });
  const deleteMut = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); onClose(); },
    onError: () => Alert.alert("Erreur", "Suppression impossible."),
  });

  const confirmDelete = () =>
    Alert.alert("Supprimer", `Supprimer ${user.first_name} définitivement ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate() },
    ]);

  const actions = [
    { icon: "gift-outline" as const, label: "Offrir un abonnement", color: "#4ADE80", onPress: () => { onClose(); onGrant(); } },
    user.is_active
      ? { icon: "ban-outline" as const, label: "Bannir", color: "#FBBF24", onPress: () => deactivateMut.mutate() }
      : { icon: "checkmark-circle-outline" as const, label: "Réactiver", color: "#4ADE80", onPress: () => reactivateMut.mutate() },
    { icon: "trash-outline" as const, label: "Supprimer", color: "#F87171", onPress: confirmDelete },
  ];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
        <View style={{ backgroundColor: "#131720", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: BORDER }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <Avatar name={`${user.first_name} ${user.last_name}`} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: TEXT }}>{user.first_name} {user.last_name}</Text>
              <Text style={{ fontSize: 12, color: MUTED }}>{user.email}</Text>
            </View>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: `${a.color}12`, borderWidth: 1, borderColor: `${a.color}25` }}
              >
                <Ionicons name={a.icon} size={20} color={a.color} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: a.color }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [grantTarget, setGrantTarget] = useState<AdminUser | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch, roleFilter],
    queryFn: () => adminApi.getUsers({ search: debouncedSearch || undefined, limit: 80, role: roleFilter !== "all" ? roleFilter : undefined }),
  });

  const users = (data?.data as AdminUser[] | undefined) ?? [];

  const renderItem = useCallback(({ item }: { item: AdminUser }) => {
    const roleColor = item.is_admin ? ROLE_COLORS.admin : ROLE_COLORS[item.role];
    return (
      <Pressable
        onPress={() => setSelectedUser(item)}
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
        <Ionicons name="ellipsis-horizontal" size={18} color={MUTED} />
      </Pressable>
    );
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.5, marginBottom: 16 }}>Utilisateurs</Text>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 16, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: BORDER, marginBottom: 12 }}>
          <Ionicons name="search-outline" size={16} color={MUTED} />
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Rechercher…"
            placeholderTextColor={MUTED}
            style={{ flex: 1, fontSize: 14, color: TEXT }}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color={MUTED} /></Pressable>
          )}
        </View>

        {/* Role filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(["all", "pro", "client"] as UserRole[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRoleFilter(r)}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                backgroundColor: roleFilter === r ? ACCENT : CARD,
                borderColor: roleFilter === r ? ACCENT : BORDER }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: roleFilter === r ? "#fff" : MUTED }}>
                {r === "all" ? "Tous" : r === "pro" ? "Pros" : "Clients"}
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
        <UserActions
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
