import React, { useState } from "react";
import {
  View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, TextInput, ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminUser } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { useDebounce } from "@/hooks/useDebounce";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { Avatar } from "@/components/admin/Avatar";

const PLAN_OPTS = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };
const MONTHS_OPTS = [1, 3, 6, 12];

export type GrantTargetUser = Pick<AdminUser, "id" | "first_name" | "last_name" | "profile_photo">;

/**
 * Offrir un abonnement à un pro. `user` fixe la cible ; sans `user`, une
 * recherche s'affiche d'abord (utilisée depuis le dashboard admin).
 */
export function GrantSubscriptionModal({
  user,
  onClose,
  onGranted,
}: {
  user?: GrantTargetUser | null;
  onClose: () => void;
  onGranted?: () => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<GrantTargetUser | null>(user ?? null);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);

  const [plan, setPlan] = useState<typeof PLAN_OPTS[number]>("serenite");
  const [months, setMonths] = useState(1);
  const [grantError, setGrantError] = useState<string | null>(null);

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["admin-grant-user-search", debounced],
    queryFn: () => adminApi.getUsers({ search: debounced, role: "pro", limit: 15 }),
    enabled: !picked && debounced.trim().length >= 2,
    staleTime: 30_000,
  });
  const results = (searchData?.data as AdminUser[] | undefined) ?? [];

  const grantMut = useMutation({
    mutationFn: () => adminApi.grantSubscription(picked!.id, { plan, months }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", picked!.id] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      onGranted?.();
      onClose();
    },
    onError: () => setGrantError("Impossible d'accorder l'abonnement."),
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ ...StyleSheet.absoluteFill, backgroundColor: ADMIN.overlay }} onPress={onClose} />
        <View style={{
          backgroundColor: ADMIN.surface,
          borderTopLeftRadius: ADMIN.sheetRadius, borderTopRightRadius: ADMIN.sheetRadius,
          paddingHorizontal: ADMIN.space.xl, paddingBottom: ADMIN.space.xxl, paddingTop: ADMIN.space.md,
          maxHeight: "88%",
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: ADMIN.sheetHandle, alignSelf: "center", marginBottom: ADMIN.space.xl }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: ADMIN.space.md, marginBottom: ADMIN.space.xl }}>
            {picked && <Avatar name={`${picked.first_name} ${picked.last_name}`} photo={picked.profile_photo} size={40} />}
            <View style={{ flex: 1 }}>
              <Text style={{ ...ADMIN.type.title, color: ADMIN.text }}>Offrir un abonnement</Text>
              <Text style={{ ...ADMIN.type.label, color: ADMIN.textSub }}>
                {picked ? `pour ${picked.first_name} ${picked.last_name}` : "choisis un pro"}
              </Text>
            </View>
            <AnimatedIconButton onPress={onClose} accessibilityLabel="Fermer" style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={ADMIN.textSub} />
            </AnimatedIconButton>
          </View>

          {!picked ? (
            <>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 10, height: 44,
                borderWidth: 1, borderColor: ADMIN.border, paddingHorizontal: 12, marginBottom: ADMIN.space.md,
              }}>
                <Ionicons name="search" size={16} color={ADMIN.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Nom ou email du pro"
                  placeholderTextColor={ADMIN.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, color: ADMIN.text, fontSize: 14 }}
                />
                {isFetching && <ActivityIndicator size="small" color={ADMIN.textMuted} />}
              </View>
              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {debounced.trim().length < 2 ? (
                  <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, paddingVertical: 12 }}>
                    Tape au moins 2 caractères.
                  </Text>
                ) : results.length === 0 && !isFetching ? (
                  <Text style={{ ...ADMIN.type.caption, color: ADMIN.textMuted, paddingVertical: 12 }}>
                    Aucun pro trouvé.
                  </Text>
                ) : (
                  results.map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setPicked(u); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ADMIN.border }}
                    >
                      <Avatar name={`${u.first_name} ${u.last_name}`} photo={u.profile_photo} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...ADMIN.type.name, fontSize: 14, color: ADMIN.text }} numberOfLines={1}>{u.first_name} {u.last_name}</Text>
                        <Text style={{ ...ADMIN.type.label, color: ADMIN.textMuted }} numberOfLines={1}>{u.email}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={ADMIN.textMuted} />
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </>
          ) : (
            <>
              {!user && (
                <Pressable onPress={() => setPicked(null)} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: ADMIN.space.md }}>
                  <Ionicons name="chevron-back" size={14} color={ADMIN.accent} />
                  <Text style={{ ...ADMIN.type.label, color: ADMIN.accent }}>Changer de pro</Text>
                </Pressable>
              )}

              <Text style={styles.label}>Plan</Text>
              <View style={{ flexDirection: "row", borderWidth: 1, borderColor: ADMIN.border, marginBottom: ADMIN.space.xl }}>
                {PLAN_OPTS.map((p, i) => (
                  <Pressable key={p}
                    onPress={() => { setPlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={{ flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: plan === p ? ADMIN.accent : "transparent", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: ADMIN.border }}>
                    <Text style={{ ...ADMIN.type.label, color: plan === p ? ADMIN.accentInk : ADMIN.textSub }}>{PLAN_LABELS[p]}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Durée</Text>
              <View style={{ flexDirection: "row", borderWidth: 1, borderColor: ADMIN.border, marginBottom: ADMIN.space.xxl }}>
                {MONTHS_OPTS.map((m, i) => (
                  <Pressable key={m}
                    onPress={() => { setMonths(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={{ flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: months === m ? ADMIN.accent : "transparent", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: ADMIN.border }}>
                    <Text style={{ ...ADMIN.type.label, color: months === m ? ADMIN.accentInk : ADMIN.textSub }}>{m}m</Text>
                  </Pressable>
                ))}
              </View>

              {grantError && <View style={{ marginBottom: ADMIN.space.md }}><ErrorMessage message={grantError} /></View>}

              <AnimatedPressable
                onPress={() => { setGrantError(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); grantMut.mutate(); }}
                disabled={grantMut.isPending}
                style={{ height: 50, borderRadius: 4, backgroundColor: ADMIN.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: grantMut.isPending ? 0.7 : 1 }}>
                {grantMut.isPending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.white }}>Accorder l'abonnement</Text>}
              </AnimatedPressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 32, height: 32, borderRadius: 4,
    backgroundColor: ADMIN.surfaceHover,
    alignItems: "center", justifyContent: "center",
  },
  label: { ...ADMIN.type.label, color: ADMIN.textMuted, marginBottom: 10 },
});
