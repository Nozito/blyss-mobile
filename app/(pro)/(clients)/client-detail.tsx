import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Linking,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { proApi, nailTechApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type Client = {
  id: number;
  name: string;
  phone?: string | null;
  lastVisit?: string | null;
  totalVisits?: number;
  avatar?: string | null;
};

// Le backend renvoie parfois des écarts en jours mal signés (ex: "-57j" pour
// une visite passée). On normalise vers un affichage toujours positif et lisible.
function formatLastVisit(raw?: string | null): string {
  if (!raw) return "Jamais venue";
  const match = raw.match(/(-?\d+)\s*j\b/i);
  if (!match) return raw;
  const days = Math.abs(parseInt(match[1], 10));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Il y a 1 jour";
  return `Il y a ${days} jours`;
}

function SectionTitle({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  const colors = useThemeColors();
  return (
    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, letterSpacing: 0.1, marginBottom: 6 }}>
      {text}
    </Text>
  );
}

export default function ClientDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const contentOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const { clientId } = useLocalSearchParams<{ clientId: string }>();

  const [notes, setNotes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [shape, setShape] = useState("");
  const [style, setStyle] = useState("");
  const [patchTest, setPatchTest] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [initial, setInitial] = useState({ notes: "", allergies: "", shape: "", style: "", patchTest: false });

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["pro-clients"],
    queryFn: () => proApi.getClients(),
  });

  const { data: notesData, isLoading: loadingNotes } = useQuery({
    queryKey: ["client-notes", clientId],
    queryFn: () => nailTechApi.getClientNotes(Number(clientId)),
    enabled: !!clientId,
  });

  const [blockError, setBlockError] = useState<string | null>(null);

  const blockMutation = useMutation({
    // apiCall() ne rejette jamais — sans ce throw, un échec métier du blocage
    // ne déclenchait ni onError ni aucun retour visuel : le bouton semblait
    // juste ne rien faire.
    mutationFn: async () => {
      const res = await nailTechApi.blockClient(Number(clientId));
      if (!res.success) throw new Error(res.error ?? "Impossible de bloquer cette cliente.");
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-clients"] });
      qc.invalidateQueries({ queryKey: ["blocked-clients"] });
      safeBack(router);
    },
    onError: (e: unknown) => setBlockError(e instanceof Error ? e.message : "Impossible de bloquer cette cliente."),
  });

  const client = ((clientsData?.data as Client[] | undefined) ?? []).find(
    (c) => String(c.id) === clientId
  );

  useEffect(() => {
    const d = notesData?.data;
    if (!d) return;
    const vals = {
      notes: d.notes ?? "",
      allergies: d.allergies ?? "",
      shape: d.preferred_shape ?? "",
      style: d.preferred_style ?? "",
      patchTest: d.patch_test_done ?? false,
    };
    setNotes(vals.notes);
    setAllergies(vals.allergies);
    setShape(vals.shape);
    setStyle(vals.style);
    setPatchTest(vals.patchTest);
    setInitial(vals);
  }, [notesData]);

  useEffect(() => {
    setHasChanges(
      notes !== initial.notes ||
      allergies !== initial.allergies ||
      shape !== initial.shape ||
      style !== initial.style ||
      patchTest !== initial.patchTest
    );
  }, [notes, allergies, shape, style, patchTest, initial]);

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await nailTechApi.updateClientNotes(Number(clientId), {
        notes,
        allergies,
        preferred_shape: shape,
        preferred_style: style,
        patch_test_done: patchTest,
      });
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        qc.invalidateQueries({ queryKey: ["client-notes", clientId] });
        setInitial({ notes, allergies, shape, style, patchTest });
        setHasChanges(false);
      } else {
        setSaveError("Impossible de sauvegarder les notes.");
      }
    } catch {
      setSaveError("Impossible de sauvegarder les notes.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (loadingNotes || (loadingClients && !notesData) || reduceMotion) return;
    Animated.timing(contentOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [loadingNotes, loadingClients, notesData, reduceMotion, contentOpacity]);

  if (loadingNotes || (loadingClients && !notesData)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!notesData?.data && !client) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Ionicons name="person-outline" size={48} color={colors.border} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Cliente introuvable</Text>
      </View>
    );
  }

  const noteInfo = notesData?.data;
  const displayName = (noteInfo?.first_name && noteInfo?.last_name)
    ? `${noteInfo.first_name} ${noteInfo.last_name}`
    : client?.name ?? "";
  const displayEmail = noteInfo?.email ?? "";
  const displayPhone = noteInfo?.phone_number ?? client?.phone ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            accessibilityLabel="Retour"
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, flex: 1 }}>
            Fiche cliente
          </Text>
        </View>

        {/* Profil card */}
        <View style={{
          backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 16,
          borderWidth: 1, borderColor: colors.border, alignItems: "center",
        }}>
          <View style={{ marginBottom: 12 }}>
            <Avatar name={displayName} size={72} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>
            {displayName}
          </Text>

          {/* Boutons contact */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12, width: "100%" }}>
            <Pressable
              disabled={!displayPhone}
              onPress={async () => {
                const phone = displayPhone;
                if (!phone) return;
                const url = `tel:${phone.replace(/\s/g, "")}`;
                const supported = await Linking.canOpenURL(url);
                if (supported) {
                  await Linking.openURL(url);
                }
              }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 14,
                backgroundColor: `${colors.primary}15`,
                borderWidth: 1, borderColor: `${colors.primary}20`,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: displayPhone ? 1 : 0.4,
              }}
            >
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Appeler</Text>
            </Pressable>
            <Pressable
              disabled={!displayEmail}
              onPress={async () => {
                const email = displayEmail;
                if (!email) return;
                const url = `mailto:${email}`;
                const supported = await Linking.canOpenURL(url);
                if (supported) {
                  await Linking.openURL(url);
                }
              }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 14,
                backgroundColor: `${colors.primary}15`,
                borderWidth: 1, borderColor: `${colors.primary}20`,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: displayEmail ? 1 : 0.4,
              }}
            >
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Email</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats */}
        <View style={{
          flexDirection: "row", backgroundColor: colors.card,
          borderRadius: 20, borderWidth: 1, borderColor: colors.border,
          marginBottom: 20, overflow: "hidden",
        }}>
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 18 }}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginBottom: 4 }} />
            <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
              {client?.totalVisits ?? 0}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5 }}>VISITES</Text>
          </View>
          {client?.lastVisit ? (
            <>
              <View style={{ width: 1, backgroundColor: colors.border, marginVertical: 12 }} />
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 10 }}>
                <Ionicons name="time-outline" size={18} color={colors.primary} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5, marginBottom: 4 }}>DERNIÈRE VISITE</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground, textAlign: "center" }} numberOfLines={2}>
                  {formatLastVisit(client.lastVisit)}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Notes & Préférences */}
        <SectionTitle title="Notes & Préférences" />

        {loadingNotes ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{
            backgroundColor: colors.card, borderRadius: 20,
            borderWidth: 1, borderColor: colors.border,
            padding: 16, marginBottom: 20, gap: 14,
          }}>
            {/* Notes libres */}
            <View>
              <FieldLabel text="Notes libres" />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes sur la cliente, habitudes, historique..."
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                style={{
                  backgroundColor: colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: colors.foreground, minHeight: 80,
                }}
              />
            </View>

            {/* Allergies */}
            <View>
              <FieldLabel text="Allergies / Contra-indications" />
              <TextInput
                value={allergies}
                onChangeText={setAllergies}
                placeholder="Ex : acrylique, résine UV..."
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                textAlignVertical="top"
                maxLength={300}
                style={{
                  backgroundColor: colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: colors.foreground, minHeight: 60,
                }}
              />
            </View>

            {/* Forme */}
            <View>
              <FieldLabel text="Forme d'ongles préférée" />
              <TextInput
                value={shape}
                onChangeText={setShape}
                placeholder="Ex : amande, carré, stiletto..."
                placeholderTextColor={colors.inputPlaceholder}
                maxLength={100}
                style={{
                  backgroundColor: colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: colors.foreground, height: 44,
                }}
              />
            </View>

            {/* Style */}
            <View>
              <FieldLabel text="Style préféré" />
              <TextInput
                value={style}
                onChangeText={setStyle}
                placeholder="Ex : minimaliste, nail art, french..."
                placeholderTextColor={colors.inputPlaceholder}
                maxLength={100}
                style={{
                  backgroundColor: colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: colors.foreground, height: 44,
                }}
              />
            </View>

            {/* Patch test */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Test patch effectué</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  Confirme si un test patch a été réalisé
                </Text>
              </View>
              <Switch
                value={patchTest}
                onValueChange={setPatchTest}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.onColor}
              />
            </View>
          </View>
        )}

        {/* Bloquer */}
        <SectionTitle title="Zone critique" />
        {blockError && <View style={{ marginBottom: 10 }}><ErrorMessage message={blockError} /></View>}
        <AnimatedPressable
          onPress={() => {
            if (blockMutation.isPending) return;
            setBlockError(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            blockMutation.mutate();
          }}
          disabled={blockMutation.isPending}
          style={{
            backgroundColor: colors.destructiveLight, borderRadius: 16,
            borderWidth: 1, borderColor: `${colors.destructive}30`,
            padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
            opacity: blockMutation.isPending ? 0.6 : 1,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: `${colors.destructive}15`,
            alignItems: "center", justifyContent: "center",
          }}>
            {blockMutation.isPending
              ? <ActivityIndicator size="small" color={colors.destructive} />
              : <Ionicons name="ban-outline" size={20} color={colors.destructive} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.destructive }}>Bloquer cette cliente</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              Elle ne pourra plus réserver chez toi
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.destructive} />
        </AnimatedPressable>
      </ScrollView>

      {/* Sticky save */}
      {hasChanges && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingHorizontal: 20, paddingTop: 12,
          paddingBottom: insets.bottom + 96,
          backgroundColor: withAlpha(colors.background, 0.97),
        }}>
          {saveError && <View style={{ marginBottom: 10 }}><ErrorMessage message={saveError} /></View>}
          <AnimatedPressable
            onPress={handleSave}
            disabled={isSaving}
            style={{
              height: 56, borderRadius: 20,
              backgroundColor: colors.primary,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 8,
              opacity: isSaving ? 0.7 : 1,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.onColor} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={colors.onColor} />
                <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 16 }}>Enregistrer les notes</Text>
              </>
            )}
          </AnimatedPressable>
        </View>
      )}
      </Animated.View>
    </View>
  );
}
