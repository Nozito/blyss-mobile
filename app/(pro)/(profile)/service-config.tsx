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
import type { VariantGroup, PrestationOption, Question, QuestionType } from "@/types/prestation";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Texte court",
  long_text: "Texte long",
  boolean: "Oui / Non",
  single_choice: "Choix unique",
  multi_choice: "Choix multiple",
};
const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

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
  const questionsQuery = useQuery({
    queryKey: ["prestation-questions", prestationId],
    queryFn: () => prestationConfigApi.getQuestions(prestationId),
  });

  const groups = (groupsQuery.data?.data as VariantGroup[] | undefined) ?? [];
  const options = (optionsQuery.data?.data as PrestationOption[] | undefined) ?? [];
  const questions = (questionsQuery.data?.data as Question[] | undefined) ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["prestation-variant-groups", prestationId] });
    qc.invalidateQueries({ queryKey: ["prestation-options", prestationId] });
    qc.invalidateQueries({ queryKey: ["prestation-questions", prestationId] });
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

  // ── Questions (V2) ───────────────────────────────────────────────────────
  const [newQuestion, setNewQuestion] = useState<{ label: string; type: QuestionType; required: boolean; isSensitive: boolean }>({
    label: "",
    type: "short_text",
    required: false,
    isSensitive: false,
  });
  const [sensitiveSuggestion, setSensitiveSuggestion] = useState<{ suggested: boolean; matchedKeywords: string[] } | null>(null);

  async function handleQuestionLabelChange(label: string) {
    setNewQuestion((q) => ({ ...q, label }));
    if (label.trim().length < 3) {
      setSensitiveSuggestion(null);
      return;
    }
    const res = await prestationConfigApi.detectSensitiveQuestion(label.trim());
    if (res.success && res.data?.suggested) {
      setSensitiveSuggestion(res.data);
      setNewQuestion((q) => ({ ...q, isSensitive: true }));
    } else {
      setSensitiveSuggestion(null);
    }
  }

  const createQuestionMutation = useMutation({
    mutationFn: () =>
      prestationConfigApi.createQuestion(prestationId, {
        label: newQuestion.label.trim(),
        type: newQuestion.type,
        required: newQuestion.required,
        is_sensitive: newQuestion.isSensitive,
      }),
    onSuccess: (res) => {
      if (handleResult(res)) {
        setNewQuestion({ label: "", type: "short_text", required: false, isSensitive: false });
        setSensitiveSuggestion(null);
      }
    },
  });
  const toggleQuestion = useMutation({
    mutationFn: ({ questionId, active }: { questionId: number; active: boolean }) => prestationConfigApi.updateQuestion(questionId, { active }),
    onSuccess: handleResult,
  });
  const deleteQuestion = useMutation({
    mutationFn: (questionId: number) => prestationConfigApi.deleteQuestion(questionId),
    onSuccess: handleResult,
  });

  const [newChoiceDrafts, setNewChoiceDrafts] = useState<Record<number, string>>({});
  const createChoice = useMutation({
    mutationFn: (questionId: number) => prestationConfigApi.createQuestionChoice(questionId, { label: (newChoiceDrafts[questionId] ?? "").trim() }),
    onSuccess: (res, questionId) => {
      if (handleResult(res)) setNewChoiceDrafts((d) => ({ ...d, [questionId]: "" }));
    },
  });
  const deleteChoice = useMutation({
    mutationFn: (choiceId: number) => prestationConfigApi.deleteQuestionChoice(choiceId),
    onSuccess: handleResult,
  });

  const isLoading = groupsQuery.isLoading || optionsQuery.isLoading || questionsQuery.isLoading;

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
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Variantes, options & questions</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Personnalise ta prestation et les informations à recueillir</Text>
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

            <Card title="Questions" subtitle="Récupère les informations dont tu as besoin avant le rendez-vous">
              {questions.map((q) => (
                <View key={q.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, opacity: q.active ? 1 : 0.5 }}>{q.label}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                        {QUESTION_TYPE_LABELS[q.type]}
                        {q.required && " · requise"}
                        {q.is_sensitive && " · donnée sensible"}
                      </Text>
                    </View>
                    <RowActions
                      active={q.active}
                      onToggle={() => toggleQuestion.mutate({ questionId: q.id, active: !q.active })}
                      onDelete={() => deleteQuestion.mutate(q.id)}
                    />
                  </View>

                  {(q.type === "single_choice" || q.type === "multi_choice") && (
                    <View style={{ paddingLeft: 12 }}>
                      {(q.choices ?? []).map((c) => (
                        <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }}>{c.label}</Text>
                          <Pressable onPress={() => deleteChoice.mutate(c.id)} accessibilityLabel="Supprimer le choix" hitSlop={8}>
                            <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                      ))}
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <TextInput
                          value={newChoiceDrafts[q.id] ?? ""}
                          onChangeText={(t) => setNewChoiceDrafts((d) => ({ ...d, [q.id]: t }))}
                          placeholder="Nouveau choix"
                          placeholderTextColor={colors.inputPlaceholder}
                          style={{ flex: 1, backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.foreground }}
                        />
                        <Pressable
                          onPress={() => createChoice.mutate(q.id)}
                          disabled={!(newChoiceDrafts[q.id] ?? "").trim() || createChoice.isPending}
                          accessibilityLabel="Ajouter le choix"
                          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: (newChoiceDrafts[q.id] ?? "").trim() ? 1 : 0.5 }}
                        >
                          <Ionicons name="add" size={18} color={colors.onColor} />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <TextInput
                value={newQuestion.label}
                onChangeText={handleQuestionLabelChange}
                placeholder="Nouvelle question (ex : As-tu déjà une pose ?)"
                placeholderTextColor={colors.inputPlaceholder}
                style={{ backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.foreground, marginBottom: 10 }}
              />

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }} accessibilityRole="radiogroup">
                {QUESTION_TYPES.map((t) => {
                  const selected = newQuestion.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setNewQuestion((q) => ({ ...q, type: t }))}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${colors.primary}15` : colors.cream,
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: selected ? colors.primary : colors.mutedForeground }}>
                        {QUESTION_TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 10 }}>
                <Pressable onPress={() => setNewQuestion((q) => ({ ...q, required: !q.required }))} accessibilityLabel="Réponse obligatoire" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={newQuestion.required ? "checkbox" : "square-outline"} size={18} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Obligatoire</Text>
                </Pressable>
                <Pressable onPress={() => setNewQuestion((q) => ({ ...q, isSensitive: !q.isSensitive }))} accessibilityLabel="Donnée sensible" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={newQuestion.isSensitive ? "checkbox" : "square-outline"} size={18} color={colors.destructive} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Donnée sensible</Text>
                </Pressable>
              </View>

              {sensitiveSuggestion?.suggested && (
                <View style={{ backgroundColor: colors.destructiveLight, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  <Text style={{ fontSize: 11.5, color: colors.destructiveText }}>
                    Cette question semble porter sur une donnée sensible ({sensitiveSuggestion.matchedKeywords.join(", ")}). "Donnée sensible" a été cochée automatiquement — décoche si ce n'est pas le cas.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => createQuestionMutation.mutate()}
                disabled={!newQuestion.label.trim() || createQuestionMutation.isPending}
                accessibilityLabel="Ajouter la question"
                style={{
                  height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
                  flexDirection: "row", gap: 6, opacity: newQuestion.label.trim() ? 1 : 0.5,
                }}
              >
                <Ionicons name="add" size={16} color={colors.onColor} />
                <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter la question</Text>
              </Pressable>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
