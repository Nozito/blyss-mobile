/**
 * Sous-étape de configuration d'une prestation (variantes/options/questions)
 * — moteur de prestations V1/V2. Insérée dans l'étape 1 du booking, entre la
 * sélection de la prestation et la sélection du créneau (doc §14.2). Le
 * prix/la durée calculés ici sont INDICATIFS pour l'affichage — le backend
 * recalcule tout et fait toujours foi (doc §5.2). Les questions n'ont AUCUN
 * effet sur le prix/la durée (doc §9, décision verrouillée V2).
 */

import React, { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import type { VariantGroup, PrestationOption, Question } from "@/types/prestation";
import type { ReservationAnswerSelection } from "@/types/reservation";
import { computeIndicativePricing } from "@/lib/cart";

export { computeIndicativePricing };

interface Props {
  prestationName: string;
  basePrice: number;
  baseDurationMinutes: number;
  isLoading: boolean;
  variantGroups: VariantGroup[];
  options: PrestationOption[];
  questions: Question[];
  selectedVariantValueByGroup: Record<number, number>;
  selectedOptionIds: Set<number>;
  answersByQuestion: Record<number, ReservationAnswerSelection>;
  onSelectVariantValue: (groupId: number, valueId: number) => void;
  onToggleOption: (optionId: number) => void;
  onAnswerChange: (questionId: number, patch: Partial<ReservationAnswerSelection>) => void;
}

export function isConfigComplete(variantGroups: VariantGroup[], selectedVariantValueByGroup: Record<number, number>): boolean {
  return variantGroups
    .filter((g) => g.required && g.active)
    .every((g) => selectedVariantValueByGroup[g.id] != null);
}

/** Une question a-t-elle une réponse "avec contenu" (pas juste un objet vide) ? */
function hasAnswerContent(question: Question, answer: ReservationAnswerSelection | undefined): boolean {
  if (!answer) return false;
  if (question.type === "boolean") return answer.value === "true" || answer.value === "false";
  if (question.type === "single_choice") return (answer.values?.length ?? 0) === 1;
  if (question.type === "multi_choice") return (answer.values?.length ?? 0) >= 1;
  return !!answer.value?.trim();
}

/**
 * Une question requise doit avoir une réponse ; une question sensible avec
 * contenu doit avoir un consentement explicite (doc §9.2) — même si elle
 * est facultative (répondre à une donnée sensible engage le consentement
 * dès qu'une réponse est donnée, pas seulement quand elle est obligatoire).
 */
export function isQuestionsComplete(questions: Question[], answers: Record<number, ReservationAnswerSelection>): boolean {
  return questions
    .filter((q) => q.active)
    .every((q) => {
      const answer = answers[q.id];
      const answered = hasAnswerContent(q, answer);
      if (q.required && !answered) return false;
      if (q.is_sensitive && answered && !answer?.consent) return false;
      return true;
    });
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}15` : colors.white,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: selected ? colors.primary : colors.foreground }}>{label}</Text>
    </AnimatedPressable>
  );
}

function QuestionField({
  question,
  answer,
  onChange,
}: {
  question: Question;
  answer: ReservationAnswerSelection | undefined;
  onChange: (patch: Partial<ReservationAnswerSelection>) => void;
}) {
  const colors = useThemeColors();
  const answered = hasAnswerContent(question, answer);
  const needsConsent = question.is_sensitive && answered && !answer?.consent;

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
        {question.label}
        {question.required && <Text style={{ color: colors.primary }}> · requis</Text>}
        {question.is_sensitive && <Text style={{ color: colors.destructive }}> · donnée sensible</Text>}
      </Text>

      {(question.type === "short_text" || question.type === "long_text") && (
        <TextInput
          value={answer?.value ?? ""}
          onChangeText={(text) => onChange({ value: text })}
          placeholder="Ta réponse"
          placeholderTextColor={colors.inputPlaceholder}
          multiline={question.type === "long_text"}
          maxLength={2000}
          style={{
            backgroundColor: colors.white,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 14,
            color: colors.foreground,
            minHeight: question.type === "long_text" ? 90 : undefined,
            textAlignVertical: question.type === "long_text" ? "top" : "center",
          }}
        />
      )}

      {question.type === "boolean" && (
        <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
          <Chip label="Oui" selected={answer?.value === "true"} onPress={() => onChange({ value: "true" })} />
          <Chip label="Non" selected={answer?.value === "false"} onPress={() => onChange({ value: "false" })} />
        </View>
      )}

      {question.type === "single_choice" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
          {(question.choices ?? []).map((choice) => (
            <Chip
              key={choice.id}
              label={choice.label}
              selected={answer?.values?.[0] === choice.id}
              onPress={() => onChange({ values: [choice.id] })}
            />
          ))}
        </View>
      )}

      {question.type === "multi_choice" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(question.choices ?? []).map((choice) => {
            const selected = (answer?.values ?? []).includes(choice.id);
            return (
              <Chip
                key={choice.id}
                label={choice.label}
                selected={selected}
                onPress={() => {
                  const current = answer?.values ?? [];
                  onChange({ values: selected ? current.filter((id) => id !== choice.id) : [...current, choice.id] });
                }}
              />
            );
          })}
        </View>
      )}

      {question.is_sensitive && answered && (
        <AnimatedPressable
          onPress={() => onChange({ consent: !answer?.consent })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!answer?.consent }}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: needsConsent ? colors.destructive : colors.border,
            backgroundColor: colors.white,
          }}
        >
          <Ionicons
            name={answer?.consent ? "checkbox" : "square-outline"}
            size={18}
            color={answer?.consent ? colors.primary : colors.mutedForeground}
          />
          <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
            {question.sensitive_consent_text ?? "Consentement requis pour répondre à cette question."}
          </Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

export function PrestationConfigurator({
  prestationName,
  basePrice,
  baseDurationMinutes,
  isLoading,
  variantGroups,
  options,
  questions,
  selectedVariantValueByGroup,
  selectedOptionIds,
  answersByQuestion,
  onSelectVariantValue,
  onToggleOption,
  onAnswerChange,
}: Props) {
  const colors = useThemeColors();

  const indicative = useMemo(
    () => computeIndicativePricing(basePrice, baseDurationMinutes, variantGroups, options, selectedVariantValueByGroup, selectedOptionIds),
    [basePrice, baseDurationMinutes, variantGroups, options, selectedVariantValueByGroup, selectedOptionIds]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ paddingBottom: 24, gap: 20 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.4 }}>
            Personnalise ta prestation
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>{prestationName}</Text>
        </View>

        {variantGroups.map((group) => (
          <View key={group.id} style={{ gap: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
              {group.name}
              {group.required && <Text style={{ color: colors.primary }}> · requis</Text>}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
              {group.values.map((value) => (
                <Chip
                  key={value.id}
                  label={`${value.label}${value.price_delta !== 0 ? ` (${value.price_delta > 0 ? "+" : ""}${value.price_delta}€)` : ""}`}
                  selected={selectedVariantValueByGroup[group.id] === value.id}
                  onPress={() => onSelectVariantValue(group.id, value.id)}
                />
              ))}
            </View>
          </View>
        ))}

        {options.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Options</Text>
            <View style={{ gap: 8 }}>
              {options.map((option) => {
                const selected = selectedOptionIds.has(option.id);
                return (
                  <AnimatedPressable
                    key={option.id}
                    onPress={() => onToggleOption(option.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: colors.white,
                      ...Shadows.card,
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.foreground }}>{option.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.mutedForeground }}>
                      {option.price_delta > 0 ? "+" : ""}{option.price_delta}€
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        )}

        {questions
          .filter((q) => q.active)
          .map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              answer={answersByQuestion[question.id]}
              onChange={(patch) => onAnswerChange(question.id, patch)}
            />
          ))}

        <View
          style={{
            marginTop: 4,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.white,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            ...Shadows.card,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Total estimé</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
            {indicative.price.toFixed(2)}€ · {indicative.durationMinutes}min
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
