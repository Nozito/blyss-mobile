/**
 * Prestation pro — deux parcours distincts plutôt qu'un formulaire unique :
 *   - Création : tunnel en 4 étapes + écran de succès (une décision par écran,
 *     grammaire visuelle proche de l'inscription mais avec la DA de l'app —
 *     pas la palette "poster" réservée au tunnel d'entrée, cf. components/onboarding/kit.tsx).

 *   - Modification : la prestation existe déjà, on l'édite en la regardant —
 *     carte d'aperçu (PrestationHero, style dégradé propre à cet écran — la
 *     carte réelle côté cliente est PrestationCard, visuellement différente),
 *     sections repliables avec steppers/segments, frise de battement, et une
 *     barre "Enregistrer" qui n'apparaît que s'il y a un changement réel.
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Switch, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import Reanimated, { FadeIn, FadeInDown, FadeOutDown, useReducedMotion } from "react-native-reanimated";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { proApi, prestationConfigApi } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Chip, ChipGrid } from "@/components/ui/Chip";
import { Accordion } from "@/components/ui/Accordion";
import { AddDisclosure } from "@/components/ui/AddDisclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";
import { formatDuration } from "@/lib/dateUtils";
import type { PricingMode, QuestionType, VariantGroup, PrestationOption, Question } from "@/types/prestation";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Texte court",
  long_text: "Texte long",
  boolean: "Oui / Non",
  single_choice: "Choix unique",
  multi_choice: "Choix multiple",
};
const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

// ── Brouillon local (création uniquement) — groupes/options/questions se
// configurent AVANT que la prestation existe côté serveur : tout reste en
// mémoire ici et n'est envoyé qu'au moment de "Créer la prestation".
type DraftValue = { tempId: string; label: string; priceDelta: string; durationDelta: string };
type DraftGroup = { tempId: string; name: string; required: boolean; values: DraftValue[] };
type DraftOption = { tempId: string; name: string; priceDelta: string; durationDelta: string };
type DraftChoice = { tempId: string; label: string };
type DraftQuestion = { tempId: string; label: string; type: QuestionType; required: boolean; isSensitive: boolean; choices: DraftChoice[] };

function tempId(): string {
  return Math.random().toString(36).slice(2);
}

const DURATION_PRESETS = [30, 45, 60, 90, 120];
// Alignées sur les CHECK constraints buffer_before_minutes / buffer_after_minutes
// de la table `prestations` côté backend.
const BUFFER_PRESETS = [0, 5, 10, 15, 20, 30];
const DEFAULT_PRICE = 30;
const DEFAULT_DURATION = 60;

type Service = {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  active?: boolean;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  pricing_mode?: PricingMode;
};

function clampPrice(n: number): number {
  return Math.max(0, Math.round(n * 100) / 100);
}
function formatPrice(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, "");
}

// ── Pièces partagées entre le tunnel de création et l'édition ────────────────

function StepperButton({ icon, accessibilityLabel, onPress, small }: { icon: "add" | "remove"; accessibilityLabel: string; onPress: () => void; small?: boolean }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: small ? 32 : 38,
        height: small ? 32 : 38,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.cream,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={small ? 14 : 18} color={colors.foreground} />
    </Pressable>
  );
}

/** Stepper prix — boutons extérieurs ±5€, intérieurs ±0,50€ (icônes seules,
 * la magnitude se lit dans la taille du bouton, pas dans un chiffre). */
function PriceStepper({ price, onChange }: { price: number; onChange: (p: number) => void }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <StepperButton icon="remove" accessibilityLabel="−5" onPress={() => onChange(clampPrice(price - 5))} />
      <StepperButton icon="remove" small accessibilityLabel="−0,5" onPress={() => onChange(clampPrice(price - 0.5))} />
      <Text style={{ fontSize: 30, fontWeight: "900", color: colors.foreground, minWidth: 92, textAlign: "center" }}>
        {formatPrice(price)}€
      </Text>
      <StepperButton icon="add" small accessibilityLabel="+0,5" onPress={() => onChange(clampPrice(price + 0.5))} />
      <StepperButton icon="add" accessibilityLabel="+5" onPress={() => onChange(clampPrice(price + 5))} />
    </View>
  );
}

function RowToggle({ active, onToggle }: { active: boolean; onToggle: (v: boolean) => void }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
        padding: 18, flexDirection: "row", alignItems: "center", gap: 14,
      }}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: active ? `${colors.primary}15` : colors.muted,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name={active ? "checkmark-circle-outline" : "pause-circle-outline"} size={22} color={active ? colors.primary : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          Prestation {active ? "active" : "inactive"}
        </Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
          {active ? "Visible et réservable par tes clientes" : "Masquée, non réservable"}
        </Text>
      </View>
      <Switch
        value={active}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.onColor}
        accessibilityLabel="Activer ou désactiver la prestation"
        accessibilityRole="switch"
      />
    </View>
  );
}

function deltaLabel(value: number, unit: string) {
  return `${value >= 0 ? "+" : ""}${value}${unit}`;
}

/** Résumé prix/durée d'une variante ou option — un supplément à 0€/0min
 * n'apporte aucune information (le prix de base s'applique déjà tel quel),
 * on ne l'affiche donc pas. */
function deltaSummary(price: number, duration: number): string {
  const parts: string[] = [];
  if (price !== 0) parts.push(deltaLabel(price, "€"));
  if (duration !== 0) parts.push(deltaLabel(duration, "min"));
  return parts.join(" · ");
}

/** Ligne d'un groupe/option/question — tap sur le libellé pour éditer en
 * place (même geste que la carte de la liste), switch + suppression à côté. */
function ConfigItemRow({
  icon, title, subtitle, active, onPress, onToggleActive, onDelete,
}: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; active: boolean;
  onPress: () => void; onToggleActive: () => void; onDelete: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Modifier ${title}`} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: active ? colors.primaryLight : colors.muted, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={active ? colors.primary : colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, opacity: active ? 1 : 0.5 }} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2, opacity: active ? 1 : 0.5 }}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      <Switch
        value={active}
        onValueChange={onToggleActive}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.onColor}
        accessibilityLabel="Actif"
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
      <Pressable onPress={onDelete} accessibilityLabel="Supprimer" hitSlop={10}>
        <Ionicons name="trash-outline" size={17} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

/** Sous-ligne (valeur d'un groupe, choix d'une question) — même geste de tap. */
function ConfigSubRow({
  label, active, onPress, onToggleActive, onDelete,
}: {
  label: string; active?: boolean; onPress?: () => void; onToggleActive?: () => void; onDelete: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.cream, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}>
      {onPress ? (
        <Pressable onPress={onPress} style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.foreground, opacity: active === false ? 0.5 : 1 }}>{label}</Text>
        </Pressable>
      ) : (
        <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }}>{label}</Text>
      )}
      {onToggleActive && (
        <Switch
          value={active !== false}
          onValueChange={onToggleActive}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.onColor}
          style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
        />
      )}
      <Pressable onPress={onDelete} accessibilityLabel="Supprimer" hitSlop={10}>
        <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

/** Boutons Annuler/Enregistrer d'un formulaire d'édition inline. */
function InlineEditActions({
  onSave, onCancel, saveDisabled, saving,
}: { onSave: () => void; onCancel: () => void; saveDisabled?: boolean; saving?: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
      <Pressable onPress={onCancel} accessibilityRole="button" style={{ flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.mutedForeground }}>Annuler</Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={saveDisabled || saving}
        accessibilityRole="button"
        style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: saveDisabled ? 0.5 : 1 }}
      >
        {saving ? <ActivityIndicator color={colors.onColor} size="small" /> : <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.onColor }}>Enregistrer</Text>}
      </Pressable>
    </View>
  );
}

/** Bloc d'accentuation — l'aperçu client réel, pas juste de la déco : affiche
 * le statut et, en édition, sert de raccourci vers "Prix & durée". */
function PrestationHero({
  name, price, duration, inactive, fromPrice, onPress,
}: {
  name: string; price: number; duration: number; inactive?: boolean; fromPrice?: boolean; onPress?: () => void;
}) {
  const colors = useThemeColors();
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? "Voir le prix et la durée" : undefined}
    >
      <LinearGradient
        colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 22, padding: 20 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: colors.onColor, opacity: 0.75 }}>
            Aperçu client
          </Text>
          {inactive && (
            <View style={{ backgroundColor: "rgba(0,0,0,0.28)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontSize: 9.5, fontWeight: "800", color: colors.onColor, textTransform: "uppercase", letterSpacing: 0.4 }}>
                Inactive
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onColor, marginBottom: 14 }} numberOfLines={1}>
          {name || "Prestation sans nom"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="time-outline" size={14} color={colors.onColor} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onColor, opacity: 0.9 }}>
              {formatDuration(duration)}
            </Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: "900", color: colors.onColor }}>
            {fromPrice ? "Dès " : ""}{price.toFixed(2)}€
          </Text>
        </View>
      </LinearGradient>
    </Wrapper>
  );
}

// Racine carrée plutôt que la valeur brute : sur un service long (1h30+),
// un battement de 5-10min devenait invisible à côté d'un bloc RDV proportionnel
// aux minutes réelles (ratio ~1/20) — la racine compresse l'écart pour que la
// frise reste lisible quelle que soit la durée choisie.
function segmentGrow(minutes: number): number {
  return minutes > 0 ? Math.max(3, Math.sqrt(minutes)) : 0;
}

/** Hachures diagonales (façon zone non travaillée sur un planning) pour les
 * segments de battement — un aplat gris ne se distinguait pas assez du bloc
 * RDV plein. SVG plutôt que des Views tournées : le motif reste net et se
 * répète correctement quelle que soit la largeur du segment. */
function DiagonalHatch({ color, patternId }: { color: string; patternId: string }) {
  return (
    <Svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <Pattern id={patternId} patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
          <Rect x={0} y={0} width={4} height={8} fill={color} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  );
}

/** Frise visuelle du créneau bloqué — battement avant/pendant/après. */
function BufferTimeline({ before, duration, after }: { before: number; duration: number; after: number }) {
  const colors = useThemeColors();
  const total = before + duration + after;
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", height: 34, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        {before > 0 && (
          <View style={{ flexGrow: segmentGrow(before), backgroundColor: colors.cream }}>
            <DiagonalHatch color={colors.border} patternId="hatch-before" />
          </View>
        )}
        <View style={{ flexGrow: segmentGrow(duration), backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: colors.onColor }} numberOfLines={1}>RDV</Text>
        </View>
        {after > 0 && (
          <View style={{ flexGrow: segmentGrow(after), backgroundColor: colors.cream }}>
            <DiagonalHatch color={colors.border} patternId="hatch-after" />
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 7 }}>
        <Text style={{ fontSize: 10.5, color: colors.mutedForeground, fontWeight: "600" }}>Créneau bloqué</Text>
        <Text style={{ fontSize: 10.5, color: colors.mutedForeground, fontWeight: "600" }}>{formatDuration(total)} au total</Text>
      </View>
    </View>
  );
}

function WizardHeader({ step, total, onBack, onSkip }: { step: number; total: number; onBack?: () => void; onSkip: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={{ paddingTop: 4, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </Pressable>
          ) : null}
          <Text style={{ fontWeight: "900", fontSize: 28, letterSpacing: -1, color: colors.foreground }}>
            {String(step).padStart(2, "0")}
          </Text>
        </View>
        <Pressable onPress={onSkip} accessibilityRole="button" accessibilityLabel="Passer">
          <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 8 }}>
            Plus tard
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 3, marginTop: 12, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
        <View style={{ height: 3, borderRadius: 3, backgroundColor: colors.primary, width: `${(step / total) * 100}%` }} />
      </View>
    </View>
  );
}

export default function ServiceFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  // Clé sur `id` plutôt qu'un simple booléen : après la création, on
  // remplace vers cette même route avec ?id=<créée> (cf. étape "succès"
  // plus bas) — Expo Router garde alors le composant monté, un booléen figé
  // à true empêchait à jamais l'hydratation (et donc la barre "Enregistrer")
  // de se déclencher pour la prestation qui vient d'être créée.
  const initializedFor = useRef<string | undefined>(undefined);
  const reduceMotion = useReducedMotion();

  const { data: servicesData, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["pro-services"],
    queryFn: () => proApi.getServices(),
    enabled: isEdit,
  });

  const existing = isEdit
    ? ((servicesData?.data as Service[] | undefined) ?? []).find((s) => String(s.id) === id)
    : undefined;

  // ── État partagé (édition ET dernière étape de création) ────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(DEFAULT_PRICE);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ready, setReady] = useState(!isEdit);

  // Instantané chargé depuis le serveur — sert de référence pour détecter
  // un changement réel (barre "Enregistrer") sans dépendre du re-fetch.
  const baseline = useRef<{ name: string; description: string; price: number; duration: number; bufferBefore: number; bufferAfter: number; isActive: boolean } | null>(null);

  useEffect(() => {
    if (initializedFor.current === id) return;
    if (isEdit && isLoadingExisting) return;
    initializedFor.current = id;
    if (isEdit && existing) {
      const snapshot = {
        name: existing.name,
        description: existing.description ?? "",
        // NUMERIC/DECIMAL Postgres revient en `string` via l'API — sans ce
        // Number(), price/duration restent des strings et cassent tout calcul
        // ou affichage en aval (stepper, .toFixed dans PrestationCard...).
        price: Number(existing.price) || 0,
        duration: Number(existing.duration_minutes) || DEFAULT_DURATION,
        bufferBefore: existing.buffer_before_minutes ?? 0,
        bufferAfter: existing.buffer_after_minutes ?? 0,
        isActive: existing.active !== false,
      };
      baseline.current = snapshot;
      setName(snapshot.name);
      setDescription(snapshot.description);
      setPrice(snapshot.price);
      setDuration(snapshot.duration);
      setBufferBefore(snapshot.bufferBefore);
      setBufferAfter(snapshot.bufferAfter);
      setIsActive(snapshot.isActive);
    }
    setReady(true);
  }, [id, existing, isEdit, isLoadingExisting]);

  const dirty =
    isEdit &&
    !!baseline.current &&
    (name !== baseline.current.name ||
      description !== baseline.current.description ||
      price !== baseline.current.price ||
      duration !== baseline.current.duration ||
      bufferBefore !== baseline.current.bufferBefore ||
      bufferAfter !== baseline.current.bufferAfter ||
      isActive !== baseline.current.isActive);

  function buildPayload() {
    return {
      name: name.trim(),
      description: description.trim(),
      price,
      duration_minutes: duration,
      active: isActive,
      buffer_before_minutes: bufferBefore,
      buffer_after_minutes: bufferAfter,
      // Pas un choix du pro : "à partir de" dès qu'un groupe de variantes ou
      // une option existe, "prix fixe" tant qu'il n'y en a aucun. En création,
      // configCount reste à 0 (les requêtes serveur sont désactivées tant que
      // la prestation n'existe pas) — c'est le brouillon local qu'il faut lire.
      pricing_mode: ((isEdit ? configCount > 0 : hasDraftConfig) ? "from" : "fixed") as PricingMode,
    };
  }

  const createMutation = useMutation({
    // apiCall() ne rejette jamais sa promesse (voir lib/api.ts) — sans ce throw,
    // un échec métier renvoyé par le serveur (res.success: false) déclenchait
    // silencieusement onSuccess : le formulaire se fermait comme si la
    // prestation avait été créée, alors que rien ne s'était passé côté serveur.
    mutationFn: async () => {
      const res = await proApi.createService(buildPayload());
      if (!res.success) throw new Error(res.error ?? "Impossible de créer la prestation.");
      const newId = (res.data as { id: number } | undefined)?.id;

      // Le brouillon (étape 4) n'existe qu'en mémoire tant que la prestation
      // n'a pas d'id serveur — on le rejoue ici, juste après la création,
      // dans l'ordre groupes→valeurs, options, questions→choix. apiCall() ne
      // rejette jamais (même commentaire que ci-dessus) : chaque échec est
      // compté plutôt qu'ignoré, pour prévenir le pro sur l'écran de succès
      // au lieu de lui faire croire que tout a été enregistré.
      let configFailures = 0;
      if (newId) {
        for (const g of draftGroups) {
          const gRes = await prestationConfigApi.createVariantGroup(newId, { name: g.name, required: g.required });
          const groupId = gRes.data?.id;
          if (gRes.success && groupId) {
            for (const v of g.values) {
              const vRes = await prestationConfigApi.createVariantValue(groupId, {
                label: v.label,
                price_delta: parseFloat(v.priceDelta) || 0,
                duration_delta: parseInt(v.durationDelta, 10) || 0,
              });
              if (!vRes.success) configFailures += 1;
            }
          } else {
            configFailures += 1;
          }
        }
        for (const o of draftOptions) {
          const oRes = await prestationConfigApi.createOption(newId, {
            name: o.name,
            price_delta: parseFloat(o.priceDelta) || 0,
            duration_delta: parseInt(o.durationDelta, 10) || 0,
          });
          if (!oRes.success) configFailures += 1;
        }
        for (const q of draftQuestions) {
          const qRes = await prestationConfigApi.createQuestion(newId, {
            label: q.label, type: q.type, required: q.required, is_sensitive: q.isSensitive,
          });
          const questionId = qRes.data?.id;
          if (qRes.success && questionId) {
            for (const c of q.choices) {
              const cRes = await prestationConfigApi.createQuestionChoice(questionId, { label: c.label });
              if (!cRes.success) configFailures += 1;
            }
          } else {
            configFailures += 1;
          }
        }
      }

      return { ...res, newId, configFailures };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["pro-services"] });
      setCreatedId(res.newId ?? null);
      setConfigFailures(res.configFailures);
      setStep(6);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Impossible de créer la prestation."),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existing) throw new Error("Prestation introuvable.");
      const res = await proApi.updateService(existing.id, buildPayload());
      if (!res.success) throw new Error(res.error ?? "Impossible de modifier la prestation.");
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-services"] });
      if (baseline.current) {
        baseline.current = { name, description, price, duration, bufferBefore, bufferAfter, isActive };
      }
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Impossible de modifier la prestation."),
  });

  // ── Compteur variantes/options/questions (badge de la ligne de lien) ────
  const groupsQuery = useQuery({
    queryKey: ["prestation-variant-groups", existing?.id],
    queryFn: () => prestationConfigApi.getVariantGroups(existing!.id),
    enabled: isEdit && !!existing,
  });
  const optionsQuery = useQuery({
    queryKey: ["prestation-options", existing?.id],
    queryFn: () => prestationConfigApi.getOptions(existing!.id),
    enabled: isEdit && !!existing,
  });
  const questionsQuery = useQuery({
    queryKey: ["prestation-questions", existing?.id],
    queryFn: () => prestationConfigApi.getQuestions(existing!.id),
    enabled: isEdit && !!existing,
  });
  const groups = (groupsQuery.data?.data as VariantGroup[] | undefined) ?? [];
  const options = (optionsQuery.data?.data as PrestationOption[] | undefined) ?? [];
  const questions = (questionsQuery.data?.data as Question[] | undefined) ?? [];
  const configCount = groups.length + options.length + questions.length;

  // ── Variantes & options en édition — inline dans cet écran (plus de
  // navigation vers d'autres écrans : la même carte se replie/déplie/édite
  // sur place, cf. Prix & durée et Temps de battement ci-dessus). ──────────
  const [configError, setConfigError] = useState<string | null>(null);
  function handleConfigResult(res: { success: boolean; error?: string; message?: string }, invalidateKey: unknown[]) {
    if (!res.success) {
      setConfigError(res.message ?? res.error ?? "Une erreur est survenue.");
      return false;
    }
    setConfigError(null);
    qc.invalidateQueries({ queryKey: invalidateKey });
    return true;
  }

  const [groupsOpen, setGroupsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  // Groupes + valeurs
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupEditDraft, setGroupEditDraft] = useState({ name: "", required: true });
  const [cfgAddGroupOpen, setCfgAddGroupOpen] = useState(false);
  const [cfgNewGroupDraft, setCfgNewGroupDraft] = useState({ name: "", required: true });
  const createGroup = useMutation({
    mutationFn: () => prestationConfigApi.createVariantGroup(existing!.id, { name: cfgNewGroupDraft.name.trim(), required: cfgNewGroupDraft.required }),
    onSuccess: (res) => {
      if (handleConfigResult(res, ["prestation-variant-groups", existing?.id])) {
        setCfgNewGroupDraft({ name: "", required: true });
        setCfgAddGroupOpen(false);
      }
    },
  });
  const updateGroup = useMutation({
    mutationFn: (vars: { id: number; data: Partial<{ name: string; required: boolean; active: boolean }> }) => prestationConfigApi.updateVariantGroup(vars.id, vars.data),
    onSuccess: (res) => handleConfigResult(res, ["prestation-variant-groups", existing?.id]),
  });
  const deleteGroup = useMutation({
    mutationFn: (id: number) => prestationConfigApi.deleteVariantGroup(id),
    onSuccess: (res) => handleConfigResult(res, ["prestation-variant-groups", existing?.id]),
  });

  const [editingValueId, setEditingValueId] = useState<number | null>(null);
  const [valueEditDraft, setValueEditDraft] = useState({ label: "", priceDelta: "", durationDelta: "" });
  const [cfgAddValueOpen, setCfgAddValueOpen] = useState<Record<number, boolean>>({});
  const [cfgNewValueDrafts, setCfgNewValueDrafts] = useState<Record<number, { label: string; priceDelta: string; durationDelta: string }>>({});
  function cfgValueDraftFor(groupId: number) {
    return cfgNewValueDrafts[groupId] ?? { label: "", priceDelta: "", durationDelta: "" };
  }
  const createValue = useMutation({
    mutationFn: (groupId: number) => {
      const draft = cfgValueDraftFor(groupId);
      return prestationConfigApi.createVariantValue(groupId, {
        label: draft.label.trim(),
        price_delta: parseFloat(draft.priceDelta) || 0,
        duration_delta: parseInt(draft.durationDelta, 10) || 0,
      });
    },
    onSuccess: (res, groupId) => {
      if (handleConfigResult(res, ["prestation-variant-groups", existing?.id])) {
        setCfgNewValueDrafts((d) => ({ ...d, [groupId]: { label: "", priceDelta: "", durationDelta: "" } }));
        setCfgAddValueOpen((o) => ({ ...o, [groupId]: false }));
      }
    },
  });
  const updateValue = useMutation({
    mutationFn: (vars: { id: number; data: Partial<{ label: string; price_delta: number; duration_delta: number; active: boolean }> }) =>
      prestationConfigApi.updateVariantValue(vars.id, vars.data),
    onSuccess: (res) => handleConfigResult(res, ["prestation-variant-groups", existing?.id]),
  });
  const deleteValue = useMutation({
    mutationFn: (id: number) => prestationConfigApi.deleteVariantValue(id),
    onSuccess: (res) => handleConfigResult(res, ["prestation-variant-groups", existing?.id]),
  });

  // Options
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [optionEditDraft, setOptionEditDraft] = useState({ name: "", priceDelta: "", durationDelta: "" });
  const [cfgAddOptionOpen, setCfgAddOptionOpen] = useState(false);
  const [cfgNewOptionDraft, setCfgNewOptionDraft] = useState({ name: "", priceDelta: "", durationDelta: "" });
  const createOption = useMutation({
    mutationFn: () =>
      prestationConfigApi.createOption(existing!.id, {
        name: cfgNewOptionDraft.name.trim(),
        price_delta: parseFloat(cfgNewOptionDraft.priceDelta) || 0,
        duration_delta: parseInt(cfgNewOptionDraft.durationDelta, 10) || 0,
      }),
    onSuccess: (res) => {
      if (handleConfigResult(res, ["prestation-options", existing?.id])) {
        setCfgNewOptionDraft({ name: "", priceDelta: "", durationDelta: "" });
        setCfgAddOptionOpen(false);
      }
    },
  });
  const updateOption = useMutation({
    mutationFn: (vars: { id: number; data: Partial<{ name: string; price_delta: number; duration_delta: number; active: boolean }> }) =>
      prestationConfigApi.updateOption(vars.id, vars.data),
    onSuccess: (res) => handleConfigResult(res, ["prestation-options", existing?.id]),
  });
  const deleteOption = useMutation({
    mutationFn: (id: number) => prestationConfigApi.deleteOption(id),
    onSuccess: (res) => handleConfigResult(res, ["prestation-options", existing?.id]),
  });

  // Questions + choix
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionEditLabel, setQuestionEditLabel] = useState("");
  const [cfgAddQuestionOpen, setCfgAddQuestionOpen] = useState(false);
  const [cfgNewQuestionDraft, setCfgNewQuestionDraft] = useState<{ label: string; type: QuestionType; required: boolean; isSensitive: boolean }>({
    label: "", type: "short_text", required: false, isSensitive: false,
  });
  const [cfgNewQuestionSuggestion, setCfgNewQuestionSuggestion] = useState<{ suggested: boolean; matchedKeywords: string[] } | null>(null);
  async function handleCfgNewQuestionLabelChange(label: string) {
    setCfgNewQuestionDraft((q) => ({ ...q, label }));
    if (label.trim().length < 3) {
      setCfgNewQuestionSuggestion(null);
      return;
    }
    const res = await prestationConfigApi.detectSensitiveQuestion(label.trim());
    if (res.success && res.data?.suggested) {
      setCfgNewQuestionSuggestion(res.data);
      setCfgNewQuestionDraft((q) => ({ ...q, isSensitive: true }));
    } else {
      setCfgNewQuestionSuggestion(null);
    }
  }
  const createQuestion = useMutation({
    mutationFn: () =>
      prestationConfigApi.createQuestion(existing!.id, {
        label: cfgNewQuestionDraft.label.trim(),
        type: cfgNewQuestionDraft.type,
        required: cfgNewQuestionDraft.required,
        is_sensitive: cfgNewQuestionDraft.isSensitive,
      }),
    onSuccess: (res) => {
      if (handleConfigResult(res, ["prestation-questions", existing?.id])) {
        setCfgNewQuestionDraft({ label: "", type: "short_text", required: false, isSensitive: false });
        setCfgNewQuestionSuggestion(null);
        setCfgAddQuestionOpen(false);
      }
    },
  });
  const updateQuestion = useMutation({
    mutationFn: (vars: { id: number; data: Partial<{ label: string; required: boolean; is_sensitive: boolean; active: boolean }> }) =>
      prestationConfigApi.updateQuestion(vars.id, vars.data),
    onSuccess: (res) => handleConfigResult(res, ["prestation-questions", existing?.id]),
  });
  const deleteQuestion = useMutation({
    mutationFn: (id: number) => prestationConfigApi.deleteQuestion(id),
    onSuccess: (res) => handleConfigResult(res, ["prestation-questions", existing?.id]),
  });

  const [cfgAddChoiceOpen, setCfgAddChoiceOpen] = useState<Record<number, boolean>>({});
  const [cfgNewChoiceDrafts, setCfgNewChoiceDrafts] = useState<Record<number, string>>({});
  const createChoice = useMutation({
    mutationFn: (questionId: number) => prestationConfigApi.createQuestionChoice(questionId, { label: (cfgNewChoiceDrafts[questionId] ?? "").trim() }),
    onSuccess: (res, questionId) => {
      if (handleConfigResult(res, ["prestation-questions", existing?.id])) {
        setCfgNewChoiceDrafts((d) => ({ ...d, [questionId]: "" }));
        setCfgAddChoiceOpen((o) => ({ ...o, [questionId]: false }));
      }
    },
  });
  const deleteChoice = useMutation({
    mutationFn: (id: number) => prestationConfigApi.deleteQuestionChoice(id),
    onSuccess: (res) => handleConfigResult(res, ["prestation-questions", existing?.id]),
  });

  // ── Tunnel de création (5 étapes + succès) ───────────────────────────────
  const [step, setStep] = useState(1);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [configFailures, setConfigFailures] = useState(0);
  const [accPriceOpen, setAccPriceOpen] = useState(false);
  const [accBufferOpen, setAccBufferOpen] = useState(false);

  // ── Étape 4 (création) — variantes/options/questions en brouillon local ──
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([]);
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([]);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [draftGroupsOpen, setDraftGroupsOpen] = useState(false);
  const [draftOptionsOpen, setDraftOptionsOpen] = useState(false);
  const [draftQuestionsOpen, setDraftQuestionsOpen] = useState(false);

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(true);
  function addDraftGroup() {
    if (!newGroupName.trim()) return;
    setDraftGroups((gs) => [...gs, { tempId: tempId(), name: newGroupName.trim(), required: newGroupRequired, values: [] }]);
    setNewGroupName("");
    setNewGroupRequired(true);
    setAddGroupOpen(false);
  }
  function deleteDraftGroup(id: string) {
    setDraftGroups((gs) => gs.filter((g) => g.tempId !== id));
  }

  const [addValueOpen, setAddValueOpen] = useState<Record<string, boolean>>({});
  const [newValueDrafts, setNewValueDrafts] = useState<Record<string, { label: string; priceDelta: string; durationDelta: string }>>({});
  function valueDraftFor(groupId: string) {
    return newValueDrafts[groupId] ?? { label: "", priceDelta: "", durationDelta: "" };
  }
  function addDraftValue(groupId: string) {
    const draft = valueDraftFor(groupId);
    if (!draft.label.trim()) return;
    setDraftGroups((gs) => gs.map((g) => (g.tempId === groupId ? { ...g, values: [...g.values, { tempId: tempId(), ...draft }] } : g)));
    setNewValueDrafts((d) => ({ ...d, [groupId]: { label: "", priceDelta: "", durationDelta: "" } }));
    setAddValueOpen((o) => ({ ...o, [groupId]: false }));
  }
  function deleteDraftValue(groupId: string, valueId: string) {
    setDraftGroups((gs) => gs.map((g) => (g.tempId === groupId ? { ...g, values: g.values.filter((v) => v.tempId !== valueId) } : g)));
  }

  const [addOptionOpen, setAddOptionOpen] = useState(false);
  const [newOption, setNewOption] = useState({ name: "", priceDelta: "", durationDelta: "" });
  function addDraftOption() {
    if (!newOption.name.trim()) return;
    setDraftOptions((os) => [...os, { tempId: tempId(), ...newOption, name: newOption.name.trim() }]);
    setNewOption({ name: "", priceDelta: "", durationDelta: "" });
    setAddOptionOpen(false);
  }
  function deleteDraftOption(id: string) {
    setDraftOptions((os) => os.filter((o) => o.tempId !== id));
  }

  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState<{ label: string; type: QuestionType; required: boolean; isSensitive: boolean }>({
    label: "", type: "short_text", required: false, isSensitive: false,
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
  function addDraftQuestion() {
    if (!newQuestion.label.trim()) return;
    setDraftQuestions((qs) => [...qs, { tempId: tempId(), label: newQuestion.label.trim(), type: newQuestion.type, required: newQuestion.required, isSensitive: newQuestion.isSensitive, choices: [] }]);
    setNewQuestion({ label: "", type: "short_text", required: false, isSensitive: false });
    setSensitiveSuggestion(null);
    setAddQuestionOpen(false);
  }
  function deleteDraftQuestion(id: string) {
    setDraftQuestions((qs) => qs.filter((q) => q.tempId !== id));
  }

  const [addChoiceOpen, setAddChoiceOpen] = useState<Record<string, boolean>>({});
  const [newChoiceDrafts, setNewChoiceDrafts] = useState<Record<string, string>>({});
  function addDraftChoice(questionId: string) {
    const label = (newChoiceDrafts[questionId] ?? "").trim();
    if (!label) return;
    setDraftQuestions((qs) => qs.map((q) => (q.tempId === questionId ? { ...q, choices: [...q.choices, { tempId: tempId(), label }] } : q)));
    setNewChoiceDrafts((d) => ({ ...d, [questionId]: "" }));
    setAddChoiceOpen((o) => ({ ...o, [questionId]: false }));
  }
  function deleteDraftChoice(questionId: string, choiceId: string) {
    setDraftQuestions((qs) => qs.map((q) => (q.tempId === questionId ? { ...q, choices: q.choices.filter((c) => c.tempId !== choiceId) } : q)));
  }

  const hasDraftConfig = draftGroups.length > 0 || draftOptions.length > 0 || draftQuestions.length > 0;

  function goNext() {
    if (step === 1) {
      if (!name.trim()) {
        setNameError("Nom requis");
        return;
      }
      setNameError(null);
    }
    if (step === 2) {
      if (price <= 0) {
        setPriceError("Le prix doit être supérieur à 0€.");
        return;
      }
      setPriceError(null);
    }
    if (step === 5) {
      createMutation.mutate();
      return;
    }
    setStep((s) => s + 1);
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ═══════════════════════ CRÉATION ═══════════════════════
  if (!isEdit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step < 6 && (
            <WizardHeader step={step} total={5} onBack={step > 1 ? () => setStep((s) => s - 1) : undefined} onSkip={() => safeBack(router)} />
          )}

          <Reanimated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(180)} style={{ flex: 1 }}>
            {step === 1 && (
              <View>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 6 }}>
                  Comment s'appelle ta prestation ?
                </Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 22 }}>
                  Le nom que verra ta cliente en premier.
                </Text>
                <View style={{ marginBottom: 16 }}>
                  <Input
                    value={name}
                    onChangeText={(t) => { setName(t); if (nameError) setNameError(null); }}
                    placeholder="Ex : Pose gel full cover"
                    error={nameError ?? undefined}
                    autoCapitalize="sentences"
                  />
                </View>
                <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 90 }}>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Décris ta prestation : technique, matériaux, résultat... (facultatif)"
                    placeholderTextColor={colors.inputPlaceholder}
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                    style={{ fontSize: 14.5, color: colors.foreground, padding: 0 }}
                    accessibilityLabel="Description de la prestation"
                  />
                </View>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 6 }}>Prix & durée</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 26 }}>
                  Ce que paie ta cliente, et le temps que tu bloques pour elle.
                </Text>
                <View style={{ backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16, alignItems: "center" }}>
                  <PriceStepper price={price} onChange={(p) => { setPrice(p); if (priceError) setPriceError(null); }} />
                </View>
                {priceError && <View style={{ marginBottom: 16 }}><ErrorMessage message={priceError} /></View>}
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Durée</Text>
                <ChipGrid columns={3}>
                  {DURATION_PRESETS.map((d) => (
                    <Chip key={d} label={formatDuration(d)} selected={duration === d} onPress={() => setDuration(d)} large fill />
                  ))}
                </ChipGrid>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 6 }}>Temps de battement</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 22 }}>
                  Bloqué automatiquement autour du RDV — nettoyage, préparation.
                </Text>
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Avant le RDV</Text>
                  <ChipGrid columns={3}>
                    {BUFFER_PRESETS.map((m) => (
                      <Chip key={m} label={m === 0 ? "Aucun" : `${m}min`} selected={bufferBefore === m} onPress={() => setBufferBefore(m)} fill />
                    ))}
                  </ChipGrid>
                </View>
                <View>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Après le RDV</Text>
                  <ChipGrid columns={3}>
                    {BUFFER_PRESETS.map((m) => (
                      <Chip key={m} label={m === 0 ? "Aucun" : `${m}min`} selected={bufferAfter === m} onPress={() => setBufferAfter(m)} fill />
                    ))}
                  </ChipGrid>
                </View>
                <BufferTimeline before={bufferBefore} duration={duration} after={bufferAfter} />
              </View>
            )}

            {step === 4 && (
              <View>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 6 }}>Variantes, options & questions</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 22 }}>
                  Facultatif — tu peux aussi le faire plus tard. Rien n'est envoyé tant que tu n'as pas créé la prestation.
                </Text>

                <Accordion
                  icon="layers-outline"
                  title="Groupes de variantes"
                  subtitle={draftGroups.length > 0 ? `${draftGroups.length} groupe${draftGroups.length > 1 ? "s" : ""}` : "Tailles, formes... une seule valeur choisie"}
                  open={draftGroupsOpen}
                  onToggle={() => setDraftGroupsOpen((o) => !o)}
                >
                  {draftGroups.map((g) => (
                    <View key={g.tempId} style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.foreground }}>
                          {g.name} {g.required && <Text style={{ color: colors.primary, fontSize: 11 }}>· requis</Text>}
                        </Text>
                        <Pressable onPress={() => deleteDraftGroup(g.tempId)} accessibilityLabel="Supprimer le groupe" hitSlop={10}>
                          <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      {g.values.length > 0 && (
                        <View style={{ marginTop: 10, gap: 6 }}>
                          {g.values.map((v) => {
                            const extra = deltaSummary(parseFloat(v.priceDelta) || 0, parseInt(v.durationDelta, 10) || 0);
                            return (
                              <View key={v.tempId} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={{ flex: 1, fontSize: 12.5, color: colors.foreground }}>
                                  {v.label}{extra ? ` · ${extra}` : ""}
                                </Text>
                                <Pressable onPress={() => deleteDraftValue(g.tempId, v.tempId)} accessibilityLabel="Supprimer la valeur" hitSlop={10}>
                                  <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      )}
                      <View style={{ marginTop: 10 }}>
                        <AddDisclosure label="Ajouter une valeur" open={!!addValueOpen[g.tempId]} onOpenChange={(v) => setAddValueOpen((o) => ({ ...o, [g.tempId]: v }))}>
                          <Input value={valueDraftFor(g.tempId).label} onChangeText={(t) => setNewValueDrafts((d) => ({ ...d, [g.tempId]: { ...valueDraftFor(g.tempId), label: t } }))} placeholder="Nom (ex : M)" />
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Input value={valueDraftFor(g.tempId).priceDelta} onChangeText={(t) => setNewValueDrafts((d) => ({ ...d, [g.tempId]: { ...valueDraftFor(g.tempId), priceDelta: t } }))} placeholder="€" keyboardType="numbers-and-punctuation" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Input value={valueDraftFor(g.tempId).durationDelta} onChangeText={(t) => setNewValueDrafts((d) => ({ ...d, [g.tempId]: { ...valueDraftFor(g.tempId), durationDelta: t } }))} placeholder="min" keyboardType="numbers-and-punctuation" />
                            </View>
                          </View>
                          <Pressable onPress={() => addDraftValue(g.tempId)} disabled={!valueDraftFor(g.tempId).label.trim()} style={{ height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 8, opacity: valueDraftFor(g.tempId).label.trim() ? 1 : 0.5 }}>
                            <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 12.5 }}>Ajouter la valeur</Text>
                          </Pressable>
                        </AddDisclosure>
                      </View>
                    </View>
                  ))}
                  <AddDisclosure label="Ajouter un groupe" open={addGroupOpen} onOpenChange={setAddGroupOpen}>
                    <Input value={newGroupName} onChangeText={setNewGroupName} placeholder="Ex : Longueur" />
                    <Pressable onPress={() => setNewGroupRequired((r) => !r)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <Ionicons name={newGroupRequired ? "checkbox" : "square-outline"} size={19} color={colors.primary} />
                      <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Choix obligatoire pour la cliente</Text>
                    </Pressable>
                    <Pressable onPress={addDraftGroup} disabled={!newGroupName.trim()} style={{ height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10, opacity: newGroupName.trim() ? 1 : 0.5 }}>
                      <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter le groupe</Text>
                    </Pressable>
                  </AddDisclosure>
                </Accordion>

                <Accordion
                  icon="add-circle-outline"
                  title="Options"
                  subtitle={draftOptions.length > 0 ? `${draftOptions.length} option${draftOptions.length > 1 ? "s" : ""}` : "Suppléments cumulables"}
                  open={draftOptionsOpen}
                  onToggle={() => setDraftOptionsOpen((o) => !o)}
                >
                  {draftOptions.map((o) => {
                    const extra = deltaSummary(parseFloat(o.priceDelta) || 0, parseInt(o.durationDelta, 10) || 0);
                    return (
                      <View key={o.tempId} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                        <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }}>{o.name}{extra ? ` · ${extra}` : ""}</Text>
                        <Pressable onPress={() => deleteDraftOption(o.tempId)} accessibilityLabel="Supprimer l'option" hitSlop={10}>
                          <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    );
                  })}
                  <AddDisclosure label="Ajouter une option" open={addOptionOpen} onOpenChange={setAddOptionOpen}>
                    <Input value={newOption.name} onChangeText={(t) => setNewOption((o) => ({ ...o, name: t }))} placeholder="Ex : Nail Art" />
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Input value={newOption.priceDelta} onChangeText={(t) => setNewOption((o) => ({ ...o, priceDelta: t }))} placeholder="€" keyboardType="numbers-and-punctuation" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input value={newOption.durationDelta} onChangeText={(t) => setNewOption((o) => ({ ...o, durationDelta: t }))} placeholder="min" keyboardType="numbers-and-punctuation" />
                      </View>
                    </View>
                    <Pressable onPress={addDraftOption} disabled={!newOption.name.trim()} style={{ height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10, opacity: newOption.name.trim() ? 1 : 0.5 }}>
                      <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter l'option</Text>
                    </Pressable>
                  </AddDisclosure>
                </Accordion>

                <Accordion
                  icon="help-circle-outline"
                  title="Questions"
                  subtitle={draftQuestions.length > 0 ? `${draftQuestions.length} question${draftQuestions.length > 1 ? "s" : ""}` : "À poser à la cliente avant le RDV"}
                  open={draftQuestionsOpen}
                  onToggle={() => setDraftQuestionsOpen((o) => !o)}
                >
                  {draftQuestions.map((q) => (
                    <View key={q.tempId} style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.foreground }}>{q.label}</Text>
                          <Text style={{ fontSize: 11.5, color: colors.mutedForeground, marginTop: 1 }}>
                            {[QUESTION_TYPE_LABELS[q.type], q.required && "requise", q.isSensitive && "donnée sensible"].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        <Pressable onPress={() => deleteDraftQuestion(q.tempId)} accessibilityLabel="Supprimer la question" hitSlop={10}>
                          <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      {(q.type === "single_choice" || q.type === "multi_choice") && (
                        <View style={{ marginTop: 10 }}>
                          {q.choices.map((c) => (
                            <View key={c.tempId} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <Text style={{ flex: 1, fontSize: 12.5, color: colors.foreground }}>{c.label}</Text>
                              <Pressable onPress={() => deleteDraftChoice(q.tempId, c.tempId)} accessibilityLabel="Supprimer le choix" hitSlop={10}>
                                <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                              </Pressable>
                            </View>
                          ))}
                          <AddDisclosure label="Ajouter un choix" open={!!addChoiceOpen[q.tempId]} onOpenChange={(v) => setAddChoiceOpen((o) => ({ ...o, [q.tempId]: v }))}>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Input value={newChoiceDrafts[q.tempId] ?? ""} onChangeText={(t) => setNewChoiceDrafts((d) => ({ ...d, [q.tempId]: t }))} placeholder="Nouveau choix" />
                              </View>
                              <Pressable onPress={() => addDraftChoice(q.tempId)} disabled={!(newChoiceDrafts[q.tempId] ?? "").trim()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: (newChoiceDrafts[q.tempId] ?? "").trim() ? 1 : 0.5 }}>
                                <Ionicons name="add" size={18} color={colors.onColor} />
                              </Pressable>
                            </View>
                          </AddDisclosure>
                        </View>
                      )}
                    </View>
                  ))}
                  <AddDisclosure label="Ajouter une question" open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
                    <Input value={newQuestion.label} onChangeText={handleQuestionLabelChange} placeholder="Ex : As-tu déjà une pose ?" />
                    <ChipGrid columns={2}>
                      {QUESTION_TYPES.map((t) => (
                        <Chip key={t} label={QUESTION_TYPE_LABELS[t]} selected={newQuestion.type === t} onPress={() => setNewQuestion((q) => ({ ...q, type: t }))} fill />
                      ))}
                    </ChipGrid>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 10 }}>
                      <Pressable onPress={() => setNewQuestion((q) => ({ ...q, required: !q.required }))} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <Ionicons name={newQuestion.required ? "checkbox" : "square-outline"} size={19} color={colors.primary} />
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Obligatoire</Text>
                      </Pressable>
                      <Pressable onPress={() => setNewQuestion((q) => ({ ...q, isSensitive: !q.isSensitive }))} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <Ionicons name={newQuestion.isSensitive ? "checkbox" : "square-outline"} size={19} color={colors.destructive} />
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Donnée sensible</Text>
                      </Pressable>
                    </View>
                    {sensitiveSuggestion?.suggested && (
                      <View style={{ backgroundColor: colors.destructiveLight, borderRadius: 12, padding: 12, marginTop: 10 }}>
                        <Text style={{ fontSize: 11.5, color: colors.destructiveText, lineHeight: 16 }}>
                          Question probablement sensible ({sensitiveSuggestion.matchedKeywords.join(", ")}) — coché automatiquement.
                        </Text>
                      </View>
                    )}
                    <Pressable onPress={addDraftQuestion} disabled={!newQuestion.label.trim()} style={{ height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10, opacity: newQuestion.label.trim() ? 1 : 0.5 }}>
                      <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter la question</Text>
                    </Pressable>
                  </AddDisclosure>
                </Accordion>
              </View>
            )}

            {step === 5 && (
              <View>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 6 }}>Dernière vérif</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 22 }}>Voici ce que verra ta cliente.</Text>
                <View style={{ marginBottom: 16 }}>
                  <PrestationHero name={name} price={price} duration={duration} />
                </View>
                {hasDraftConfig && (
                  <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="options-outline" size={16} color={colors.primary} />
                    <Text style={{ fontSize: 12.5, color: colors.mutedForeground, flex: 1 }}>
                      {[
                        draftGroups.length > 0 && `${draftGroups.length} groupe${draftGroups.length > 1 ? "s" : ""}`,
                        draftOptions.length > 0 && `${draftOptions.length} option${draftOptions.length > 1 ? "s" : ""}`,
                        draftQuestions.length > 0 && `${draftQuestions.length} question${draftQuestions.length > 1 ? "s" : ""}`,
                      ].filter(Boolean).join(" · ")} configurés
                    </Text>
                  </View>
                )}
                {formError && <View style={{ marginBottom: 16 }}><ErrorMessage message={formError} /></View>}
                <RowToggle active={isActive} onToggle={setIsActive} />
              </View>
            )}

            {step === 6 && (
              <View style={{ flex: 1, justifyContent: "center" }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
                  <Ionicons name="checkmark" size={28} color={colors.onColor} />
                </View>
                <Text style={{ fontSize: 24, fontWeight: "900", color: colors.foreground, marginBottom: 10 }}>
                  Ta prestation est prête
                </Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19, marginBottom: configFailures > 0 ? 10 : 26, maxWidth: 280 }}>
                  {hasDraftConfig
                    ? "Tes variantes, options et questions ont été enregistrées avec la prestation."
                    : "Ajoute des tailles, des suppléments ou des questions pour ta cliente — ou laisse-la telle quelle."}
                </Text>
                {configFailures > 0 && (
                  <Text style={{ fontSize: 12, color: colors.warning, lineHeight: 17, marginBottom: 26, maxWidth: 280 }}>
                    {configFailures === 1
                      ? "Un élément n'a pas pu être enregistré — vérifie tes variantes & options."
                      : `${configFailures} éléments n'ont pas pu être enregistrés — vérifie tes variantes & options.`}
                  </Text>
                )}
                <Pressable
                  onPress={() => {
                    if (createdId == null) return safeBack(router);
                    router.replace(`/(pro)/(profile)/service-form?id=${createdId}`);
                  }}
                  style={{ height: 54, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginBottom: 14 }}
                >
                  <Ionicons name={hasDraftConfig ? "options-outline" : "add"} size={18} color={colors.onColor} />
                  <Text style={{ color: colors.onColor, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>
                    {hasDraftConfig ? "Voir mes variantes & options" : "Ajouter des variantes"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => safeBack(router)} accessibilityRole="button">
                  <Text style={{ color: colors.mutedForeground, fontSize: 12.5, fontWeight: "600", textAlign: "center" }}>
                    Plus tard, retour à mes prestations
                  </Text>
                </Pressable>
              </View>
            )}
          </Reanimated.View>

          {step < 6 && (
            <View style={{ marginTop: 24 }}>
              <Pressable
                onPress={goNext}
                disabled={createMutation.isPending}
                style={{
                  height: 54, borderRadius: 999, backgroundColor: colors.primary,
                  alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
                  opacity: createMutation.isPending ? 0.7 : 1,
                  shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
                }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color={colors.onColor} />
                ) : (
                  <Text style={{ color: colors.onColor, fontWeight: "800", fontSize: 12.5, letterSpacing: 0.6, textTransform: "uppercase" }}>
                    {step === 5 ? "Créer la prestation" : "Continuer"}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════ MODIFICATION ═══════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: insets.bottom + (dirty ? 100 : 32) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Modifier</Text>
            <Text style={{ fontSize: 12.5, color: isActive ? colors.success : colors.mutedForeground, fontWeight: "700", marginTop: 1 }}>
              ● {isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {formError && <View style={{ marginBottom: 16 }}><ErrorMessage message={formError} /></View>}

        <View style={{ marginBottom: 18 }}>
          <PrestationHero
            name={name}
            price={price}
            duration={duration}
            inactive={!isActive}
            fromPrice={configCount > 0}
            onPress={() => setAccPriceOpen(true)}
          />
        </View>

        <Accordion
          icon="pricetag-outline"
          title="Prix & durée"
          subtitle={`${configCount > 0 ? "À partir de " : ""}${formatPrice(price)}€ · ${formatDuration(duration)}`}
          open={accPriceOpen}
          onToggle={() => setAccPriceOpen((o) => !o)}
        >
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <PriceStepper price={price} onChange={setPrice} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Durée
          </Text>
          <ChipGrid columns={3}>
            {DURATION_PRESETS.map((d) => (
              <Chip key={d} label={formatDuration(d)} selected={duration === d} onPress={() => setDuration(d)} fill />
            ))}
          </ChipGrid>
          {configCount > 0 && (
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>
              Affiché « à partir de » car des variantes ou options existent (Variantes & options ci-dessous).
            </Text>
          )}
        </Accordion>

        <Accordion
          icon="hourglass-outline"
          title="Temps de battement"
          subtitle={`${bufferBefore === 0 ? "aucun" : `${bufferBefore}min`} avant · ${bufferAfter === 0 ? "aucun" : `${bufferAfter}min`} après`}
          open={accBufferOpen}
          onToggle={() => setAccBufferOpen((o) => !o)}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Avant le RDV
          </Text>
          <ChipGrid columns={3}>
            {BUFFER_PRESETS.map((m) => (
              <Chip key={m} label={m === 0 ? "Aucun" : `${m}min`} selected={bufferBefore === m} onPress={() => setBufferBefore(m)} fill />
            ))}
          </ChipGrid>
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4, marginBottom: 8 }}>
            Après le RDV
          </Text>
          <ChipGrid columns={3}>
            {BUFFER_PRESETS.map((m) => (
              <Chip key={m} label={m === 0 ? "Aucun" : `${m}min`} selected={bufferAfter === m} onPress={() => setBufferAfter(m)} fill />
            ))}
          </ChipGrid>
          <BufferTimeline before={bufferBefore} duration={duration} after={bufferAfter} />
        </Accordion>

        {configError && <View style={{ marginBottom: 16 }}><ErrorMessage message={configError} /></View>}

        <Accordion
          icon="layers-outline"
          title="Groupes de variantes"
          subtitle={groups.length > 0 ? `${groups.length} groupe${groups.length > 1 ? "s" : ""}` : "Tailles, formes... une seule valeur choisie"}
          open={groupsOpen}
          onToggle={() => setGroupsOpen((o) => !o)}
        >
          {groups.length === 0 && (
            <EmptyState icon="layers-outline" title="Aucun groupe pour l'instant" description="Ajoute un groupe comme « Longueur » ou « Forme »." />
          )}
          {groups.map((g) => (
            <View key={g.id} style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              {editingGroupId === g.id ? (
                <View>
                  <Input value={groupEditDraft.name} onChangeText={(t) => setGroupEditDraft((d) => ({ ...d, name: t }))} placeholder="Nom du groupe" autoFocus />
                  <Pressable onPress={() => setGroupEditDraft((d) => ({ ...d, required: !d.required }))} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <Ionicons name={groupEditDraft.required ? "checkbox" : "square-outline"} size={19} color={colors.primary} />
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Choix obligatoire pour la cliente</Text>
                  </Pressable>
                  <InlineEditActions
                    saveDisabled={!groupEditDraft.name.trim()}
                    saving={updateGroup.isPending}
                    onCancel={() => setEditingGroupId(null)}
                    onSave={() => {
                      updateGroup.mutate({ id: g.id, data: { name: groupEditDraft.name.trim(), required: groupEditDraft.required } });
                      setEditingGroupId(null);
                    }}
                  />
                </View>
              ) : (
                <ConfigItemRow
                  icon="layers-outline"
                  title={g.name}
                  subtitle={g.required ? "Requis" : "Optionnel"}
                  active={g.active}
                  onPress={() => { setEditingGroupId(g.id); setGroupEditDraft({ name: g.name, required: g.required }); }}
                  onToggleActive={() => updateGroup.mutate({ id: g.id, data: { active: !g.active } })}
                  onDelete={() => deleteGroup.mutate(g.id)}
                />
              )}

              <View style={{ marginTop: 12, paddingLeft: 12 }}>
                {g.values.map((v) =>
                  editingValueId === v.id ? (
                    <View key={v.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                      <Input value={valueEditDraft.label} onChangeText={(t) => setValueEditDraft((d) => ({ ...d, label: t }))} placeholder="Nom de la valeur" autoFocus />
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Input value={valueEditDraft.priceDelta} onChangeText={(t) => setValueEditDraft((d) => ({ ...d, priceDelta: t }))} placeholder="€" keyboardType="numbers-and-punctuation" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input value={valueEditDraft.durationDelta} onChangeText={(t) => setValueEditDraft((d) => ({ ...d, durationDelta: t }))} placeholder="min" keyboardType="numbers-and-punctuation" />
                        </View>
                      </View>
                      <InlineEditActions
                        saveDisabled={!valueEditDraft.label.trim()}
                        saving={updateValue.isPending}
                        onCancel={() => setEditingValueId(null)}
                        onSave={() => {
                          updateValue.mutate({
                            id: v.id,
                            data: { label: valueEditDraft.label.trim(), price_delta: parseFloat(valueEditDraft.priceDelta) || 0, duration_delta: parseInt(valueEditDraft.durationDelta, 10) || 0 },
                          });
                          setEditingValueId(null);
                        }}
                      />
                    </View>
                  ) : (
                    <ConfigSubRow
                      key={v.id}
                      label={(() => { const extra = deltaSummary(v.price_delta, v.duration_delta); return extra ? `${v.label} · ${extra}` : v.label; })()}
                      active={v.active}
                      onPress={() => { setEditingValueId(v.id); setValueEditDraft({ label: v.label, priceDelta: String(v.price_delta), durationDelta: String(v.duration_delta) }); }}
                      onToggleActive={() => updateValue.mutate({ id: v.id, data: { active: !v.active } })}
                      onDelete={() => deleteValue.mutate(v.id)}
                    />
                  )
                )}
                <AddDisclosure label="Ajouter une valeur" open={!!cfgAddValueOpen[g.id]} onOpenChange={(v) => setCfgAddValueOpen((o) => ({ ...o, [g.id]: v }))}>
                  <Input
                    value={cfgValueDraftFor(g.id).label}
                    onChangeText={(t) => setCfgNewValueDrafts((d) => ({ ...d, [g.id]: { ...cfgValueDraftFor(g.id), label: t } }))}
                    placeholder="Nom (ex : M)"
                  />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Input value={cfgValueDraftFor(g.id).priceDelta} onChangeText={(t) => setCfgNewValueDrafts((d) => ({ ...d, [g.id]: { ...cfgValueDraftFor(g.id), priceDelta: t } }))} placeholder="€" keyboardType="numbers-and-punctuation" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input value={cfgValueDraftFor(g.id).durationDelta} onChangeText={(t) => setCfgNewValueDrafts((d) => ({ ...d, [g.id]: { ...cfgValueDraftFor(g.id), durationDelta: t } }))} placeholder="min" keyboardType="numbers-and-punctuation" />
                    </View>
                  </View>
                  <Pressable
                    onPress={() => createValue.mutate(g.id)}
                    disabled={!cfgValueDraftFor(g.id).label.trim() || (createValue.isPending && createValue.variables === g.id)}
                    style={{ height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 8, opacity: cfgValueDraftFor(g.id).label.trim() ? 1 : 0.5 }}
                  >
                    {createValue.isPending && createValue.variables === g.id ? (
                      <ActivityIndicator color={colors.onColor} size="small" />
                    ) : (
                      <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 12.5 }}>Ajouter la valeur</Text>
                    )}
                  </Pressable>
                </AddDisclosure>
              </View>
            </View>
          ))}
          <AddDisclosure label="Ajouter un groupe" open={cfgAddGroupOpen} onOpenChange={setCfgAddGroupOpen}>
            <Input value={cfgNewGroupDraft.name} onChangeText={(t) => setCfgNewGroupDraft((d) => ({ ...d, name: t }))} placeholder="Ex : Longueur" />
            <Pressable onPress={() => setCfgNewGroupDraft((d) => ({ ...d, required: !d.required }))} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Ionicons name={cfgNewGroupDraft.required ? "checkbox" : "square-outline"} size={19} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Choix obligatoire pour la cliente</Text>
            </Pressable>
            <Pressable
              onPress={() => createGroup.mutate()}
              disabled={!cfgNewGroupDraft.name.trim() || createGroup.isPending}
              style={{ height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10, opacity: cfgNewGroupDraft.name.trim() ? 1 : 0.5 }}
            >
              {createGroup.isPending ? <ActivityIndicator color={colors.onColor} size="small" /> : <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter le groupe</Text>}
            </Pressable>
          </AddDisclosure>
        </Accordion>

        <Accordion
          icon="add-circle-outline"
          title="Options"
          subtitle={options.length > 0 ? `${options.length} option${options.length > 1 ? "s" : ""}` : "Suppléments cumulables"}
          open={optionsOpen}
          onToggle={() => setOptionsOpen((o) => !o)}
        >
          {options.length === 0 && (
            <EmptyState icon="add-circle-outline" title="Aucune option pour l'instant" description="Ajoute un supplément comme « Nail Art »." />
          )}
          {options.map((o) =>
            editingOptionId === o.id ? (
              <View key={o.id} style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <Input value={optionEditDraft.name} onChangeText={(t) => setOptionEditDraft((d) => ({ ...d, name: t }))} placeholder="Nom de l'option" autoFocus />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input value={optionEditDraft.priceDelta} onChangeText={(t) => setOptionEditDraft((d) => ({ ...d, priceDelta: t }))} placeholder="€" keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input value={optionEditDraft.durationDelta} onChangeText={(t) => setOptionEditDraft((d) => ({ ...d, durationDelta: t }))} placeholder="min" keyboardType="numbers-and-punctuation" />
                  </View>
                </View>
                <InlineEditActions
                  saveDisabled={!optionEditDraft.name.trim()}
                  saving={updateOption.isPending}
                  onCancel={() => setEditingOptionId(null)}
                  onSave={() => {
                    updateOption.mutate({
                      id: o.id,
                      data: { name: optionEditDraft.name.trim(), price_delta: parseFloat(optionEditDraft.priceDelta) || 0, duration_delta: parseInt(optionEditDraft.durationDelta, 10) || 0 },
                    });
                    setEditingOptionId(null);
                  }}
                />
              </View>
            ) : (
              <View key={o.id} style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                <ConfigItemRow
                  icon="add-circle-outline"
                  title={o.name}
                  subtitle={deltaSummary(o.price_delta, o.duration_delta) || "Aucun supplément"}
                  active={o.active}
                  onPress={() => { setEditingOptionId(o.id); setOptionEditDraft({ name: o.name, priceDelta: String(o.price_delta), durationDelta: String(o.duration_delta) }); }}
                  onToggleActive={() => updateOption.mutate({ id: o.id, data: { active: !o.active } })}
                  onDelete={() => deleteOption.mutate(o.id)}
                />
              </View>
            )
          )}
          <AddDisclosure label="Ajouter une option" open={cfgAddOptionOpen} onOpenChange={setCfgAddOptionOpen}>
            <Input value={cfgNewOptionDraft.name} onChangeText={(t) => setCfgNewOptionDraft((d) => ({ ...d, name: t }))} placeholder="Ex : Nail Art" />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Input value={cfgNewOptionDraft.priceDelta} onChangeText={(t) => setCfgNewOptionDraft((d) => ({ ...d, priceDelta: t }))} placeholder="€" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Input value={cfgNewOptionDraft.durationDelta} onChangeText={(t) => setCfgNewOptionDraft((d) => ({ ...d, durationDelta: t }))} placeholder="min" keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            <Pressable
              onPress={() => createOption.mutate()}
              disabled={!cfgNewOptionDraft.name.trim() || createOption.isPending}
              style={{ height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10, opacity: cfgNewOptionDraft.name.trim() ? 1 : 0.5 }}
            >
              {createOption.isPending ? <ActivityIndicator color={colors.onColor} size="small" /> : <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter l'option</Text>}
            </Pressable>
          </AddDisclosure>
        </Accordion>

        <Accordion
          icon="help-circle-outline"
          title="Questions"
          subtitle={questions.length > 0 ? `${questions.length} question${questions.length > 1 ? "s" : ""}` : "À poser à la cliente avant le RDV"}
          open={questionsOpen}
          onToggle={() => setQuestionsOpen((o) => !o)}
        >
          {questions.length === 0 && (
            <EmptyState icon="help-circle-outline" title="Aucune question pour l'instant" description="Récupère une info avant le rendez-vous." />
          )}
          {questions.map((q) => (
            <View key={q.id} style={{ backgroundColor: colors.cream, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              {editingQuestionId === q.id ? (
                <View>
                  <Input value={questionEditLabel} onChangeText={setQuestionEditLabel} placeholder="Libellé de la question" autoFocus />
                  <InlineEditActions
                    saveDisabled={!questionEditLabel.trim()}
                    saving={updateQuestion.isPending}
                    onCancel={() => setEditingQuestionId(null)}
                    onSave={() => {
                      updateQuestion.mutate({ id: q.id, data: { label: questionEditLabel.trim() } });
                      setEditingQuestionId(null);
                    }}
                  />
                </View>
              ) : (
                <ConfigItemRow
                  icon="help-circle-outline"
                  title={q.label}
                  subtitle={[QUESTION_TYPE_LABELS[q.type], q.required && "requise", q.is_sensitive && "donnée sensible"].filter(Boolean).join(" · ")}
                  active={q.active}
                  onPress={() => { setEditingQuestionId(q.id); setQuestionEditLabel(q.label); }}
                  onToggleActive={() => updateQuestion.mutate({ id: q.id, data: { active: !q.active } })}
                  onDelete={() => deleteQuestion.mutate(q.id)}
                />
              )}
              {(q.type === "single_choice" || q.type === "multi_choice") && (
                <View style={{ marginTop: 12, paddingLeft: 12 }}>
                  {(q.choices ?? []).map((c) => (
                    <ConfigSubRow key={c.id} label={c.label} onDelete={() => deleteChoice.mutate(c.id)} />
                  ))}
                  <AddDisclosure label="Ajouter un choix" open={!!cfgAddChoiceOpen[q.id]} onOpenChange={(v) => setCfgAddChoiceOpen((o) => ({ ...o, [q.id]: v }))}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Input value={cfgNewChoiceDrafts[q.id] ?? ""} onChangeText={(t) => setCfgNewChoiceDrafts((d) => ({ ...d, [q.id]: t }))} placeholder="Nouveau choix" />
                      </View>
                      <Pressable
                        onPress={() => createChoice.mutate(q.id)}
                        disabled={!(cfgNewChoiceDrafts[q.id] ?? "").trim() || createChoice.isPending}
                        style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: (cfgNewChoiceDrafts[q.id] ?? "").trim() ? 1 : 0.5 }}
                      >
                        <Ionicons name="add" size={20} color={colors.onColor} />
                      </Pressable>
                    </View>
                  </AddDisclosure>
                </View>
              )}
            </View>
          ))}
          <AddDisclosure label="Ajouter une question" open={cfgAddQuestionOpen} onOpenChange={setCfgAddQuestionOpen}>
            <Input value={cfgNewQuestionDraft.label} onChangeText={handleCfgNewQuestionLabelChange} placeholder="Ex : As-tu déjà une pose ?" />
            <ChipGrid columns={2}>
              {QUESTION_TYPES.map((t) => (
                <Chip key={t} label={QUESTION_TYPE_LABELS[t]} selected={cfgNewQuestionDraft.type === t} onPress={() => setCfgNewQuestionDraft((q) => ({ ...q, type: t }))} fill />
              ))}
            </ChipGrid>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 10 }}>
              <Pressable onPress={() => setCfgNewQuestionDraft((q) => ({ ...q, required: !q.required }))} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Ionicons name={cfgNewQuestionDraft.required ? "checkbox" : "square-outline"} size={19} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Obligatoire</Text>
              </Pressable>
              <Pressable onPress={() => setCfgNewQuestionDraft((q) => ({ ...q, isSensitive: !q.isSensitive }))} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Ionicons name={cfgNewQuestionDraft.isSensitive ? "checkbox" : "square-outline"} size={19} color={colors.destructive} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Donnée sensible</Text>
              </Pressable>
            </View>
            {cfgNewQuestionSuggestion?.suggested && (
              <View style={{ backgroundColor: colors.destructiveLight, borderRadius: 12, padding: 12, marginTop: 10 }}>
                <Text style={{ fontSize: 11.5, color: colors.destructiveText, lineHeight: 16 }}>
                  Question probablement sensible ({cfgNewQuestionSuggestion.matchedKeywords.join(", ")}) — coché automatiquement.
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => createQuestion.mutate()}
              disabled={!cfgNewQuestionDraft.label.trim() || createQuestion.isPending}
              style={{ height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 10, opacity: cfgNewQuestionDraft.label.trim() ? 1 : 0.5 }}
            >
              {createQuestion.isPending ? <ActivityIndicator color={colors.onColor} size="small" /> : <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 13 }}>Ajouter la question</Text>}
            </Pressable>
          </AddDisclosure>
        </Accordion>

        <View style={{ marginTop: 6 }}>
          <RowToggle active={isActive} onToggle={setIsActive} />
        </View>
      </ScrollView>

      {dirty && (
        <Reanimated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(200)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(160)}
          style={{
            position: "absolute", left: 16, right: 16, bottom: insets.bottom + 14,
            backgroundColor: colors.foreground, borderRadius: 16, padding: 14,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
            shadowColor: colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
          }}
        >
          <Text style={{ color: colors.background, fontSize: 12.5, fontWeight: "600", opacity: 0.85, flexShrink: 1 }}>
            Modifications non enregistrées
          </Text>
          <Pressable
            onPress={() => {
              if (price <= 0) {
                setFormError("Le prix doit être supérieur à 0€.");
                return;
              }
              updateMutation.mutate();
            }}
            disabled={updateMutation.isPending}
            style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, opacity: updateMutation.isPending ? 0.7 : 1 }}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onColor} />
            ) : (
              <Text style={{ color: colors.onColor, fontSize: 12.5, fontWeight: "800" }}>Enregistrer</Text>
            )}
          </Pressable>
        </Reanimated.View>
      )}
    </View>
  );
}
