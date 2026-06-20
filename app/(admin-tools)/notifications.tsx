import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Platform, Image,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";

const BG     = ADMIN.bg;
const CARD   = "rgba(255,255,255,0.05)";
const BORDER = ADMIN.border;
const TEXT1  = "#fff";
const TEXT2  = "rgba(255,255,255,0.5)";
const TEXT3  = "rgba(255,255,255,0.28)";
const MUTED  = "rgba(255,255,255,0.07)";

type Target = "all" | "pros" | "clients" | "user_id";

const TARGET_OPTS: { value: Target; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { value: "all",     label: "Tous",       icon: "people-outline",    color: Colors.pro },
  { value: "pros",    label: "Pros",        icon: "briefcase-outline", color: ADMIN.accent },
  { value: "clients", label: "Clients",     icon: "person-outline",    color: Colors.info },
  { value: "user_id", label: "Utilisateur", icon: "at-outline",        color: Colors.success },
];

// ─── SelectedUserCard ─────────────────────────────────────────────────────────

function UserRow({ user, onClear }: { user: AdminUser; onClear?: () => void }) {
  const photoUri = user.profile_photo
    ? user.profile_photo.startsWith("http") ? user.profile_photo : `${API_URL}${user.profile_photo}`
    : null;
  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?";
  const roleColor = user.role === "pro" ? ADMIN.accent : Colors.info;
  const statusColor = user.is_active ? Colors.success : "#EF4444";

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: MUTED,
      borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    }}>
      <View style={{
        width: 46, height: 46, borderRadius: 14,
        backgroundColor: `${roleColor}20`,
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: 46, height: 46 }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: "800", color: roleColor }}>{initials}</Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: TEXT1, letterSpacing: -0.2, flexShrink: 1 }} numberOfLines={1}>
            {user.first_name} {user.last_name}
          </Text>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: `${roleColor}20` }}>
            <Text style={{ fontSize: 9, fontWeight: "700", color: roleColor, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {user.role}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: `${statusColor}18` }}>
            <Text style={{ fontSize: 9, fontWeight: "700", color: statusColor, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {user.is_active ? "Actif" : "Inactif"}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: TEXT2 }} numberOfLines={1}>{user.email}</Text>
      </View>

      {onClear ? (
        <Pressable onPress={onClear} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={20} color={TEXT3} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={14} color={TEXT3} />
      )}
    </View>
  );
}

// ─── UserPicker ───────────────────────────────────────────────────────────────

function UserPicker({
  onSelect,
}: {
  onSelect: (user: AdminUser) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-users-search", debouncedSearch],
    queryFn: () => adminApi.getUsers({ search: debouncedSearch, limit: 20 }),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  const term = debouncedSearch.toLowerCase();
  const users = debouncedSearch.length >= 2
    ? ((data?.data ?? []) as AdminUser[]).filter((u) =>
        u.first_name?.toLowerCase().includes(term) ||
        u.last_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      )
    : [];

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        Rechercher un utilisateur
      </Text>

      {/* Search input */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        backgroundColor: MUTED, borderRadius: 12, paddingHorizontal: 14,
        borderWidth: 1, borderColor: BORDER, height: 46,
      }}>
        <Ionicons name="search-outline" size={16} color={TEXT3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Nom, prénom ou email…"
          placeholderTextColor={TEXT3}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, fontSize: 14, color: TEXT1 }}
        />
        {isFetching && <ActivityIndicator size="small" color={TEXT3} />}
        {search.length > 0 && !isFetching && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={TEXT3} />
          </Pressable>
        )}
      </View>

      {/* Hint */}
      {search.length < 2 && (
        <Text style={{ fontSize: 12, color: TEXT3, marginTop: 8 }}>
          Tape au moins 2 caractères pour chercher
        </Text>
      )}

      {/* Results */}
      {users.length > 0 && (
        <View style={{
          marginTop: 10, borderRadius: 14, borderWidth: 1,
          borderColor: BORDER, overflow: "hidden",
        }}>
          {users.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onSelect(u);
                setSearch("");
              }}
            >
              <UserRow user={u} />
            </Pressable>
          ))}
        </View>
      )}

      {/* Empty state */}
      {debouncedSearch.length >= 2 && !isFetching && users.length === 0 && (
        <Text style={{ fontSize: 12, color: TEXT3, marginTop: 8, textAlign: "center", paddingVertical: 12 }}>
          Aucun utilisateur trouvé
        </Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);

  const sendMut = useMutation({
    mutationFn: () =>
      adminApi.sendPush({
        target,
        user_id: target === "user_id" ? selectedUser?.id : undefined,
        title: title.trim(),
        body: body.trim(),
      }),
    onSuccess: (res) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const sent = res.data?.sent ?? 0;
      setSentCount(sent);
      setTitle("");
      setBody("");
      Alert.alert("Envoyée", `Push envoyée à ${sent} destinataire(s).`);
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Erreur", "Impossible d'envoyer la notification.");
    },
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0 &&
    (target !== "user_id" || selectedUser !== null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
      automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={{ marginBottom: 24 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 }}
        >
          {Platform.OS === "ios"
            ? <SymbolView name="chevron.left" size={16} tintColor={ADMIN.accent} />
            : <Ionicons name="chevron-back" size={18} color={ADMIN.accent} />}
          <Text style={{ fontSize: 15, fontWeight: "700", color: ADMIN.accent }}>Retour</Text>
        </Pressable>
        <Text style={{ fontSize: 32, fontWeight: "900", color: TEXT1, letterSpacing: -0.8 }}>Notifications</Text>
        <Text style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>Envoi push en temps réel</Text>
      </View>

      {/* ── Stats ── */}
      {sentCount !== null && (
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: `${Colors.success}15`, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: `${Colors.success}28` }}>
            <Text style={{ fontSize: 11, color: Colors.success, fontWeight: "600" }}>Dernière push</Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.success, marginTop: 2 }}>{sentCount}</Text>
            <Text style={{ fontSize: 10, color: TEXT2 }}>destinataire(s)</Text>
          </View>
        </View>
      )}

      {/* ── 1. Cible ── */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT1, marginBottom: 14 }}>1. Cible</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {TARGET_OPTS.map((opt) => {
            const active = target === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setTarget(opt.value);
                  if (opt.value !== "user_id") setSelectedUser(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={{
                  flex: 1, minWidth: "44%", flexDirection: "row", alignItems: "center", gap: 8,
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
                  backgroundColor: active ? `${opt.color}18` : MUTED,
                  borderColor: active ? opt.color : BORDER,
                }}
              >
                <Ionicons name={opt.icon} size={16} color={active ? opt.color : TEXT2} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: active ? opt.color : TEXT2 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {target === "user_id" && (
          <>
            {selectedUser ? (
              <View style={{ marginTop: 14 }}>
                <UserRow user={selectedUser} onClear={() => setSelectedUser(null)} />
              </View>
            ) : (
              <UserPicker onSelect={setSelectedUser} />
            )}
          </>
        )}
      </View>

      {/* ── 2. Contenu ── */}
      <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT1, marginBottom: 14 }}>2. Contenu</Text>

        <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Titre</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Titre de la notification"
          placeholderTextColor={TEXT3}
          maxLength={100}
          style={{ backgroundColor: MUTED, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: TEXT1, borderWidth: 1, borderColor: BORDER, marginBottom: 14 }}
        />

        <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Message</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Corps de la notification..."
          placeholderTextColor={TEXT3}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
          style={{ backgroundColor: MUTED, borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, color: TEXT1, borderWidth: 1, borderColor: BORDER, minHeight: 90 }}
        />
        <Text style={{ fontSize: 11, color: TEXT3, textAlign: "right", marginTop: 4 }}>{body.length}/500</Text>
      </View>

      {/* ── Aperçu ── */}
      {(title || body) && (
        <View style={{ backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Aperçu push</Text>
          <View style={{ backgroundColor: MUTED, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: ADMIN.accent, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>🌸</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT2 }}>Blyss · maintenant</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1 }} numberOfLines={1}>{title || "Titre…"}</Text>
            <Text style={{ fontSize: 12, color: TEXT2, marginTop: 2 }} numberOfLines={2}>{body || "Message…"}</Text>
          </View>
        </View>
      )}

      {/* ── Envoyer ── */}
      <Pressable
        onPress={() => {
          if (!canSend) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          sendMut.mutate();
        }}
        disabled={sendMut.isPending || !canSend}
        style={{
          height: 56, borderRadius: 18, backgroundColor: ADMIN.accent,
          alignItems: "center", justifyContent: "center",
          flexDirection: "row", gap: 10,
          opacity: (sendMut.isPending || !canSend) ? 0.4 : 1,
        }}
      >
        {sendMut.isPending
          ? <ActivityIndicator size="small" color="#fff" />
          : (
            <>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
                {target === "all" ? "Envoyer à tous"
                  : target === "pros" ? "Envoyer aux pros"
                  : target === "clients" ? "Envoyer aux clients"
                  : selectedUser ? `Envoyer à ${selectedUser.first_name}`
                  : "Envoyer"}
              </Text>
            </>
          )}
      </Pressable>
    </ScrollView>
  );
}
