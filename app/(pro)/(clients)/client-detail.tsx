import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { proApi, nailTechApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Colors } from "@/constants/colors";
import { TAB_BOTTOM_PADDING } from "@/constants/layout";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

type Client = {
  id: number;
  name: string;
  phone?: string | null;
  lastVisit?: string | null;
  totalVisits?: number;
  avatar?: string | null;
};

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: "600", color: "#3F3F46", letterSpacing: 0.1, marginBottom: 6 }}>
      {text}
    </Text>
  );
}

export default function ClientDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
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

  const blockMutation = useMutation({
    mutationFn: () => nailTechApi.blockClient(Number(clientId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-clients"] });
      qc.invalidateQueries({ queryKey: ["blocked-clients"] });
      router.back();
    },
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

  if (loadingNotes || (loadingClients && !notesData)) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!notesData?.data && !client) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Ionicons name="person-outline" size={48} color={Colors.border} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Cliente introuvable</Text>
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
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + TAB_BOTTOM_PADDING,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <AnimatedIconButton
            onPress={() => router.back()}
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.foreground, flex: 1 }}>
            Fiche cliente
          </Text>
        </View>

        {/* Profil card */}
        <View style={{
          backgroundColor: Colors.card, borderRadius: 20, padding: 20, marginBottom: 16,
          borderWidth: 1, borderColor: Colors.border, alignItems: "center",
        }}>
          <View style={{ marginBottom: 12 }}>
            <Avatar name={displayName} size={72} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.foreground, marginBottom: 4 }}>
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
                backgroundColor: `${Colors.primary}15`,
                borderWidth: 1, borderColor: `${Colors.primary}20`,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: displayPhone ? 1 : 0.4,
              }}
            >
              <Ionicons name="call-outline" size={16} color={Colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.primary }}>Appeler</Text>
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
                backgroundColor: `${Colors.primary}15`,
                borderWidth: 1, borderColor: `${Colors.primary}20`,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: displayEmail ? 1 : 0.4,
              }}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.primary }}>Email</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats */}
        <View style={{
          flexDirection: "row", backgroundColor: Colors.card,
          borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
          marginBottom: 20, overflow: "hidden",
        }}>
          <View style={{ flex: 1, alignItems: "center", paddingVertical: 18 }}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground }}>
              {client?.totalVisits ?? 0}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.mutedForeground, letterSpacing: 0.5 }}>VISITES</Text>
          </View>
          {client?.lastVisit ? (
            <>
              <View style={{ width: 1, backgroundColor: Colors.border, marginVertical: 12 }} />
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18, paddingHorizontal: 10 }}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, letterSpacing: 0.5, marginBottom: 4 }}>DERNIÈRE VISITE</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground, textAlign: "center" }} numberOfLines={2}>
                  {client.lastVisit}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Notes & Préférences */}
        <SectionTitle title="Notes & Préférences" />

        {loadingNotes ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{
            backgroundColor: Colors.card, borderRadius: 20,
            borderWidth: 1, borderColor: Colors.border,
            padding: 16, marginBottom: 20, gap: 14,
          }}>
            {/* Notes libres */}
            <View>
              <FieldLabel text="Notes libres" />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes sur la cliente, habitudes, historique..."
                placeholderTextColor={Colors.inputPlaceholder}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                style={{
                  backgroundColor: Colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: Colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: Colors.foreground, minHeight: 80,
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
                placeholderTextColor={Colors.inputPlaceholder}
                multiline
                textAlignVertical="top"
                maxLength={300}
                style={{
                  backgroundColor: Colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: Colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: Colors.foreground, minHeight: 60,
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
                placeholderTextColor={Colors.inputPlaceholder}
                maxLength={100}
                style={{
                  backgroundColor: Colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: Colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: Colors.foreground, height: 44,
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
                placeholderTextColor={Colors.inputPlaceholder}
                maxLength={100}
                style={{
                  backgroundColor: Colors.cream, borderRadius: 12,
                  borderWidth: 1.5, borderColor: Colors.border,
                  paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: Colors.foreground, height: 44,
                }}
              />
            </View>

            {/* Patch test */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Test patch effectué</Text>
                <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                  Confirme si un test patch a été réalisé
                </Text>
              </View>
              <Switch
                value={patchTest}
                onValueChange={setPatchTest}
                trackColor={{ false: "#E5E7EB", true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        )}

        {/* Bloquer */}
        <SectionTitle title="Zone critique" />
        <Pressable
          onPress={() => blockMutation.mutate()}
          style={{
            backgroundColor: "#FFF0F0", borderRadius: 16,
            borderWidth: 1, borderColor: `${Colors.destructive}30`,
            padding: 16, flexDirection: "row", alignItems: "center", gap: 12,
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: `${Colors.destructive}15`,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="ban-outline" size={20} color={Colors.destructive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.destructive }}>Bloquer cette cliente</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
              Elle ne pourra plus réserver chez toi
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.destructive} />
        </Pressable>
      </ScrollView>

      {/* Sticky save */}
      {hasChanges && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          paddingHorizontal: 20, paddingTop: 12,
          paddingBottom: insets.bottom + 96,
          backgroundColor: "rgba(255,234,241,0.97)",
        }}>
          {saveError && <View style={{ marginBottom: 10 }}><ErrorMessage message={saveError} /></View>}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={{
              height: 56, borderRadius: 20,
              backgroundColor: Colors.primary,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 8,
              opacity: isSaving ? 0.7 : 1,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={Colors.white} />
                <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 16 }}>Enregistrer les notes</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
