/**
 * Configuration d'une prestation — groupes de variantes, valeurs, options.
 *
 * Réf : docs/ARCHITECTURE_MOTEUR_PRESTATIONS_V1_V3.md (§7, §8, §14.1).
 * Écran volontairement simple pour la V1 : listes à plat + formulaires
 * d'ajout inline, pas de drag & drop de tri (sort_order géré côté serveur
 * avec une valeur par défaut, ajustable plus tard si le besoin apparaît).
 */

import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Switch, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { prestationConfigApi } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";
import type { VariantGroup, PrestationOption } from "@/types/prestation";

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 16 }}>
      <Text style={{ fontSize: 15, fontWeight: "800", color: colors.foreground }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2, marginBottom: 14 }}>{subtitle}</Text>}
      {!subtitle && <View style={{ marginBottom: 14 }} />}
      {children}
    </View>
  );
}

function DeltaInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const colors = useThemeColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inputPlaceholder}
      keyboardType="numbers-and-punctuation"
      style={{
        flex: 1, backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
        paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.foreground,
      }}
    />
  );
}

function RowActions({ active, onToggle, onDelete }: { active: boolean; onToggle: () => void; onDelete: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Switch value={active} onValueChange={onToggle} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.onColor} accessibilityLabel="Actif" />
      <Pressable onPress={onDelete} accessibilityLabel="Supprimer" hitSlop={8}>
        <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function ServiceConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const prestationId = parseInt(id, 10);
  const [error, setError] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["prestation-variant-groups", prestationId],
    queryFn: () => prestationConfigApi.getVariantGroups(prestationId),
  });
  const optionsQuery = useQuery({
    queryKey: ["prestation-options", prestationId],
    queryFn: () => prestationConfigApi.getOptions(prestationId),
  });

  const groups = (groupsQuery.data?.data as VariantGroup[] | undefined) ?? [];
  const options = (optionsQuery.data?.data as PrestationOption[] | undefined) ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["prestation-variant-groups", prestationId] });
    qc.invalidateQueries({ queryKey: ["prestation-options", prestationId] });
  }

  function handleResult<T>(res: { success: boolean; error?: string; message?: string }) {
    if (!res.success) {
      setError(res.message ?? res.error ?? "Une erreur est survenue.");
      return false;
    }
    setError(null);
    invalidate();
    return true;
  }

  // ── Groupes ────────────────────────────────────────────────────────────
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(true);
  const createGroup = useMutation({
    mutationFn: () => prestationConfigApi.createVariantGroup(prestationId, { name: newGroupName.trim(), required: newGroupRequired }),
    onSuccess: (res) => {
      if (handleResult(res)) setNewGroupName("");
    },
  });
  const toggleGroup = useMutation({
    mutationFn: ({ groupId, active }: { groupId: number; active: boolean }) => prestationConfigApi.updateVariantGroup(groupId, { active }),
    onSuccess: handleResult,
  });
  const deleteGroup = useMutation({
    mutationFn: (groupId: number) => prestationConfigApi.deleteVariantGroup(groupId),
    onSuccess: handleResult,
  });

  // ── Valeurs ────────────────────────────────────────────────────────────
  const [newValueDrafts, setNewValueDrafts] = useState<Record<number, { label: string; priceDelta: string; durationDelta: string }>>({});
  function draftFor(groupId: number) {
    return newValueDrafts[groupId] ?? { label: "", priceDelta: "0", durationDelta: "0" };
  }
  const createValue = useMutation({
    mutationFn: (groupId: number) => {
      const draft = draftFor(groupId);
      return prestationConfigApi.createVariantValue(groupId, {
        label: draft.label.trim(),
        price_delta: parseFloat(draft.priceDelta) || 0,
        duration_delta: parseInt(draft.durationDelta, 10) || 0,
      });
    },
    onSuccess: (res, groupId) => {
      if (handleResult(res)) setNewValueDrafts((d) => ({ ...d, [groupId]: { label: "", priceDelta: "0", durationDelta: "0" } }));
    },
  });
  const toggleValue = useMutation({
    mutationFn: ({ valueId, active }: { valueId: number; active: boolean }) => prestationConfigApi.updateVariantValue(valueId, { active }),
    onSuccess: handleResult,
  });
  const deleteValue = useMutation({
    mutationFn: (valueId: number) => prestationConfigApi.deleteVariantValue(valueId),
    onSuccess: handleResult,
  });

  // ── Options ────────────────────────────────────────────────────────────
  const [newOption, setNewOption] = useState({ name: "", priceDelta: "0", durationDelta: "0" });
  const createOption = useMutation({
    mutationFn: () =>
      prestationConfigApi.createOption(prestationId, {
        name: newOption.name.trim(),
        price_delta: parseFloat(newOption.priceDelta) || 0,
        duration_delta: parseInt(newOption.durationDelta, 10) || 0,
      }),
    onSuccess: (res) => {
      if (handleResult(res)) setNewOption({ name: "", priceDelta: "0", durationDelta: "0" });
    },
  });
  const toggleOption = useMutation({
    mutationFn: ({ optionId, active }: { optionId: number; active: boolean }) => prestationConfigApi.updateOption(optionId, { active }),
    onSuccess: handleResult,
  });
  const deleteOption = useMutation({
    mutationFn: (optionId: number) => prestationConfigApi.deleteOption(optionId),
    onSuccess: handleResult,
  });

  const isLoading = groupsQuery.isLoading || optionsQuery.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Variantes & options</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Le prix et la durée s'ajustent automatiquement</Text>
          </View>
        </View>

        {error && <View style={{ marginBottom: 16 }}><ErrorMessage message={error} /></View>}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Card title="Groupes de variantes" subtitle="Ex : Longueur, Forme — une seule valeur choisie par groupe">
              {groups.map((group) => (
                <View key={group.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                        {group.name} {group.required && <Text style={{ color: colors.primary, fontSize: 11 }}>· requis</Text>}
                      </Text>
                    </View>
                    <RowActions
                      active={group.active}
                      onToggle={() => toggleGroup.mutate({ groupId: group.id, active: !group.active })}
                      onDelete={() => deleteGroup.mutate(group.id)}
                    />
                  </View>

                  {group.values.map((v) => (
                    <View key={v.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 12 }}>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.foreground, opacity: v.active ? 1 : 0.5 }}>
                        {v.label} · {v.price_delta >= 0 ? "+" : ""}{v.price_delta}€ · {v.duration_delta >= 0 ? "+" : ""}{v.duration_delta}min
                      </Text>
                      <RowActions
                        active={v.active}
                        onToggle={() => toggleValue.mutate({ valueId: v.id, active: !v.active })}
                        onDelete={() => deleteValue.mutate(v.id)}
                      />
                    </View>
                  ))}

                  <View style={{ flexDirection: "row", gap: 8, paddingLeft: 12, marginTop: 4 }}>
                    <TextInput
                      value={draftFor(group.id).label}
                      onChangeText={(t) => setNewValueDrafts((d) => ({ ...d, [group.id]: { ...draftFor(group.id), label: t } }))}
                      placeholder="Nouvelle valeur (ex : M)"
                      placeholderTextColor={colors.inputPlaceholder}
                      style={{ flex: 2, backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.foreground }}
                    />
                    <DeltaInput value={draftFor(group.id).priceDelta} onChangeText={(t) => setNewValueDrafts((d) => ({ ...d, [group.id]: { ...draftFor(group.id), priceDelta: t } }))} placeholder="€" />
                    <DeltaInput value={draftFor(group.id).durationDelta} onChangeText={(t) => setNewValueDrafts((d) => ({ ...d, [group.id]: { ...draftFor(group.id), durationDelta: t } }))} placeholder="min" />
                    <Pressable
                      onPress={() => createValue.mutate(group.id)}
                      disabled={!draftFor(group.id).label.trim() || createValue.isPending}
                      accessibilityLabel="Ajouter la valeur"
                      style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: draftFor(group.id).label.trim() ? 1 : 0.5 }}
                    >
                      <Ionicons name="add" size={18} color={colors.onColor} />
                    </Pressable>
                  </View>
                </View>
              ))}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Nouveau groupe (ex : Longueur)"
                  placeholderTextColor={colors.inputPlaceholder}
                  style={{ flex: 1, backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.foreground }}
                />
                <Pressable onPress={() => setNewGroupRequired((r) => !r)} accessibilityLabel="Obligatoire" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name={newGroupRequired ? "checkbox" : "square-outline"} size={18} color={colors.primary} />
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Requis</Text>
                </Pressable>
                <Pressable
                  onPress={() => createGroup.mutate()}
                  disabled={!newGroupName.trim() || createGroup.isPending}
                  accessibilityLabel="Ajouter le groupe"
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: newGroupName.trim() ? 1 : 0.5 }}
                >
                  <Ionicons name="add" size={18} color={colors.onColor} />
                </Pressable>
              </View>
            </Card>

            <Card title="Options" subtitle="Ex : French, Nail Art — plusieurs sélectionnables en même temps">
              {options.map((o) => (
                <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.foreground, opacity: o.active ? 1 : 0.5 }}>
                    {o.name} · {o.price_delta >= 0 ? "+" : ""}{o.price_delta}€ · {o.duration_delta >= 0 ? "+" : ""}{o.duration_delta}min
                  </Text>
                  <RowActions
                    active={o.active}
                    onToggle={() => toggleOption.mutate({ optionId: o.id, active: !o.active })}
                    onDelete={() => deleteOption.mutate(o.id)}
                  />
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={newOption.name}
                  onChangeText={(t) => setNewOption((o) => ({ ...o, name: t }))}
                  placeholder="Nouvelle option (ex : Nail Art)"
                  placeholderTextColor={colors.inputPlaceholder}
                  style={{ flex: 2, backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.foreground }}
                />
                <DeltaInput value={newOption.priceDelta} onChangeText={(t) => setNewOption((o) => ({ ...o, priceDelta: t }))} placeholder="€" />
                <DeltaInput value={newOption.durationDelta} onChangeText={(t) => setNewOption((o) => ({ ...o, durationDelta: t }))} placeholder="min" />
                <Pressable
                  onPress={() => createOption.mutate()}
                  disabled={!newOption.name.trim() || createOption.isPending}
                  accessibilityLabel="Ajouter l'option"
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: newOption.name.trim() ? 1 : 0.5 }}
                >
                  <Ionicons name="add" size={18} color={colors.onColor} />
                </Pressable>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
