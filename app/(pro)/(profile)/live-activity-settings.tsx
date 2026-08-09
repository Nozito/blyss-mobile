import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Switch, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { proApi } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";

type Privacy = "full" | "time_only" | "countdown_only";

const PRIVACY_OPTIONS: { value: Privacy; title: string; description: string }[] = [
  {
    value: "full",
    title: "Compte à rebours, heure et prénom",
    description: "« Dans 2h35 · Cliente : Camille · Aujourd'hui à 16h30 »",
  },
  {
    value: "time_only",
    title: "Compte à rebours et heure",
    description: "« Dans 2h35 · Aujourd'hui à 16h30 » — sans le prénom de la cliente",
  },
  {
    value: "countdown_only",
    title: "Compte à rebours seul",
    description: "« Dans 2h35 » — le plus discret",
  },
];

export default function LiveActivitySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isIOS = Platform.OS === "ios";

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [privacy, setPrivacy] = useState<Privacy>("full");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isIOS) {
      setLoading(false);
      return;
    }
    proApi.getLiveActivitySettings().then((res) => {
      if (res.success && res.data) {
        setEnabled(res.data.enabled);
        setPrivacy(res.data.privacy);
      }
    }).finally(() => setLoading(false));
  }, [isIOS]);

  const save = async (next: { enabled?: boolean; privacy?: Privacy }) => {
    setSaving(true);
    setError(null);
    const res = await proApi.updateLiveActivitySettings(next);
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? "Impossible d'enregistrer ce réglage.");
      return false;
    }
    return true;
  };

  const handleToggle = async (value: boolean) => {
    const previous = enabled;
    setEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const ok = await save({ enabled: value });
    if (!ok) setEnabled(previous);
  };

  const handlePrivacySelect = async (value: Privacy) => {
    if (value === privacy) return;
    const previous = privacy;
    setPrivacy(value);
    Haptics.selectionAsync().catch(() => {});
    const ok = await save({ privacy: value });
    if (!ok) setPrivacy(previous);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 20,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <AnimatedIconButton
          onPress={() => safeBack(router)}
          accessibilityLabel="Retour"
          style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </AnimatedIconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Rendez-vous en direct</Text>
          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Écran verrouillé & Dynamic Island</Text>
        </View>
      </View>

      {!isIOS ? (
        <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 20, ...Shadows.card, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.mutedForeground} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
            Cette fonctionnalité utilise les Live Activities d'iOS et n'est pas disponible sur Android pour le moment.
          </Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 20, ...Shadows.card, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                Afficher mon prochain rendez-vous
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4, lineHeight: 17 }}>
                Sur ton écran verrouillé et le Dynamic Island, avec un compte à rebours qui se met à jour tout seul.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              disabled={saving}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.onColor}
            />
          </View>

          {enabled && (
            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10, paddingLeft: 2 }}>
                Informations affichées
              </Text>
              <View style={{ backgroundColor: colors.white, borderRadius: 20, overflow: "hidden", ...Shadows.card }}>
                {PRIVACY_OPTIONS.map((option, index) => (
                  <AnimatedPressable
                    key={option.value}
                    onPress={() => handlePrivacySelect(option.value)}
                    disabled={saving}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    <Ionicons
                      name={privacy === option.value ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={privacy === option.value ? colors.primary : colors.mutedForeground}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{option.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 3, lineHeight: 17 }}>
                        {option.description}
                      </Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 12, paddingHorizontal: 2 }}>
                <Ionicons name="lock-closed-outline" size={13} color={colors.mutedForeground} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 11.5, color: colors.mutedForeground, lineHeight: 16 }}>
                  Utile si ton téléphone peut être vu par quelqu'un d'autre — les informations que tu choisis de masquer ne sont jamais envoyées à ton téléphone.
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {error && <ErrorMessage message={error} />}
    </ScrollView>
  );
}
