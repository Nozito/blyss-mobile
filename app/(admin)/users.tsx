import React, { useState, useCallback } from "react";
import {
  View, Text, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView, RefreshControl,
  ActionSheetIOS, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const [start, end] = avatarColors(name);
  const br = Math.round(size * 0.28);
  return (
    <LinearGradient
      colors={[start, end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: br,
        alignItems: "center", justifyContent: "center",
        shadowColor: start, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: Math.round(size * 0.29) }}>{initials(name)}</Text>
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
        <View style={{ backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 32, borderTopWidth: 1, borderColor: A_BORDER }}>
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, marginBottom: 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: A_BORDER }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>Offrir un abonnement</Text>
            <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: A_BG, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={Colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginBottom: 24 }}>Pour {user.first_name} {user.last_name}</Text>

          <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Plan</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {PLAN_OPTS.map((p) => (
              <Pressable key={p}
                onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: plan === p ? Colors.admin : A_BORDER, backgroundColor: plan === p ? `${Colors.admin}15` : A_BG }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: plan === p ? Colors.admin : Colors.mutedForeground }}>{PLAN_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Durée</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 28 }}>
            {MONTHS_OPTS.map((m) => (
              <Pressable key={m}
                onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                  borderColor: months === m ? Colors.admin : A_BORDER, backgroundColor: months === m ? `${Colors.admin}15` : A_BG }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: months === m ? Colors.admin : Colors.mutedForeground }}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => grantMut.mutate()} disabled={grantMut.isPending} style={{ opacity: grantMut.isPending ? 0.7 : 1 }}>
            <LinearGradient
              colors={["#EA6000", "#F97316", "#FBAB6A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
            >
              {grantMut.isPending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <><Ionicons name="gift-outline" size={18} color={Colors.white} /><Text style={{ fontSize: 15, fontWeight: "800", color: Colors.white }}>Accorder</Text></>}
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
          style={{ backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: A_BORDER, maxHeight: "88%" }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12, marginBottom: 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: A_BORDER }} />
          </View>

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
            <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: A_BG, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={Colors.mutedForeground} />
            </Pressable>
          </View>

          {stats && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {[
                { label: "RDV",      value: stats.total_bookings, color: Colors.info },
                { label: "Terminés", value: stats.completed,      color: Colors.success },
                { label: "Annulés",  value: stats.cancelled,      color: Colors.destructive },
                { label: "Total",    value: `${Number(stats.total_spent).toFixed(0)}€`, color: Colors.admin },
              ].map(({ label, value, color: c }) => (
                <View key={label} style={{ flex: 1, backgroundColor: A_BG, borderRadius: 14, padding: 10, alignItems: "center", borderWidth: 1, borderColor: A_BORDER }}>
                  <Text style={{ fontSize: 17, fontWeight: "900", color: c }}>{value}</Text>
                  <Text style={{ fontSize: 9, color: Colors.mutedForeground, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {(full.subscription_history ?? []).length > 0 && (
            <View style={{ backgroundColor: A_BG, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: A_BORDER, marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground, marginBottom: 10 }}>Historique abonnements</Text>
              {(full.subscription_history ?? []).slice(0, 4).map((sub, i) => (
                <View key={sub.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: A_BORDER }}>
                  <Text style={{ fontSize: 12, color: Colors.foreground, fontWeight: "600", textTransform: "capitalize" }}>{sub.plan}</Text>
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

          <View style={{ gap: 10, paddingBottom: 20 }}>
            <Pressable onPress={() => { onClose(); onGrant(); }} style={{ overflow: "hidden", borderRadius: 16 }}>
              <LinearGradient
                colors={["#EA6000", "#F97316", "#FBAB6A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}
              >
                <Ionicons name="gift-outline" size={20} color={Colors.white} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Offrir un abonnement</Text>
              </LinearGradient>
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
function UserRow({
  item, onPress, onLongPress, onBan,
}: {
  item: AdminUser;
  onPress: () => void;
  onLongPress: () => void;
  onBan: () => void;
}) {
  const rc = roleColor(item);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [{
        borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
        flexDirection: "row", alignItems: "center", gap: 14,
        marginBottom: 10, opacity: pressed ? 0.85 : 1,
      }]}
    >
      <Avatar name={`${item.first_name} ${item.last_name}`} size={48} />

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontWeight: "700", fontSize: 14, color: Colors.foreground, flex: 1 }} numberOfLines={1}>
            {item.first_name} {item.last_name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: `${rc}18` }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: rc, textTransform: "uppercase" }}>
                {item.is_admin ? "admin" : item.role}
              </Text>
            </View>
            {!item.is_active && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: `${Colors.destructive}18` }}>
                <Text style={{ fontSize: 9, fontWeight: "700", color: Colors.destructive }}>BANNI</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 8, fontWeight: "500" }} numberOfLines={1}>
          {item.email}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
            {(item as any).created_at
              ? `Inscrit le ${new Date((item as any).created_at).toLocaleDateString("fr-FR")}`
              : item.role}
          </Text>
          {!item.is_admin && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onBan(); }}
              hitSlop={10}
              style={{
                width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center",
                backgroundColor: item.is_active ? `${Colors.destructive}10` : `${Colors.success}10`,
                borderWidth: 1, borderColor: item.is_active ? `${Colors.destructive}20` : `${Colors.success}20`,
              }}
            >
              <Ionicons name={item.is_active ? "ban-outline" : "checkmark-circle-outline"} size={15} color={item.is_active ? Colors.destructive : Colors.success} />
            </Pressable>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={Colors.mutedForeground} />
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
    <UserRow
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
    />
  ), [banMut, handleLongPress]);

  return (
    <View style={{ flex: 1, backgroundColor: A_BG }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: A_BORDER }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: Colors.admin }} />
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>Utilisateurs</Text>
          </View>
          {!isLoading && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: A_BG, borderWidth: 1, borderColor: A_BORDER }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground }}>{users.length}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: A_BG, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: A_BORDER, marginBottom: 12 }}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(({ value, label }) => (
            <Pressable key={value}
              onPress={() => { setRoleFilter(value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
              style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
                backgroundColor: roleFilter === value ? Colors.admin : A_BG,
                borderColor: roleFilter === value ? Colors.admin : A_BORDER }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: roleFilter === value ? Colors.white : Colors.mutedForeground }}>{label}</Text>
            </Pressable>
          ))}
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: A_BG, borderWidth: 1, borderColor: A_BORDER }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground }}>{users.length} résultats</Text>
          </View>
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
          estimatedItemSize={96}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="people-outline" size={44} color={A_BORDER} />
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
