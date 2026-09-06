import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { clientOnboardingApi, type NailStyle } from "@/lib/api";
import { NAIL_STYLE_OPTIONS } from "@/lib/clientOnboardingContent";
import { Input } from "@/components/ui/Input";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

function SectionHeader({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingLeft: 2 }}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>{label}</Text>
    </View>
  );
}

export default function ClientPreferencesScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [styles, setStyles] = useState<NailStyle[]>([]);
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await clientOnboardingApi.getStatus();
      if (cancelled) return;
      if (res.success && res.data) {
        const current = res.data.styles ?? (res.data.style_nails ? [res.data.style_nails] : []);
        setStyles(current);
        setCity(res.data.city ?? "");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleStyle = (value: NailStyle) => {
    Haptics.selectionAsync().catch(() => {});
    setSuccess(null);
    setStyles((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (styles.length === 0) {
      setError("Choisis au moins un style qui te plaît.");
      return;
    }
    setSaving(true);
    const res = await clientOnboardingApi.setPreferences(styles, city.trim() || undefined);
    setSaving(false);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccess("Préférences enregistrées.");
    } else {
      setError(res.error ?? "Impossible d'enregistrer tes préférences.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={20} color={colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Mes préférences</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              On s'en sert pour te recommander des pros
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Styles */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader icon="color-palette-outline" label="Styles qui te plaisent" />
              <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 16, ...Shadows.card }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {NAIL_STYLE_OPTIONS.map((opt) => {
                    const active = styles.includes(opt.value);
                    return (
                      <AnimatedPressable
                        key={opt.value}
                        onPress={() => toggleStyle(opt.value)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: active }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 11,
                          borderRadius: 13,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? withAlpha(colors.primary, 0.08) : "transparent",
                        }}
                      >
                        <Ionicons
                          name={active ? "checkmark-circle" : "ellipse-outline"}
                          size={16}
                          color={active ? colors.primary : colors.mutedForeground}
                        />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.primary : colors.foreground }}>
                          {opt.label}
                        </Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Ville */}
            <View style={{ marginBottom: 20 }}>
              <SectionHeader icon="location-outline" label="Ta ville" />
              <View style={{ backgroundColor: colors.white, borderRadius: 20, padding: 20, ...Shadows.card }}>
                <Input
                  label="Ville"
                  value={city}
                  onChangeText={(t) => {
                    setSuccess(null);
                    setCity(t);
                  }}
                  placeholder="Ex. Nantes"
                  leftIcon="location-outline"
                />
              </View>
            </View>

            {error && (
              <View style={{ backgroundColor: colors.destructiveLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.destructive }}>
                <Text style={{ fontSize: 13, color: colors.destructiveText, fontWeight: "500" }}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={{ backgroundColor: colors.successLight, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.successBorder }}>
                <Text style={{ fontSize: 13, color: colors.successText, fontWeight: "600" }}>{success}</Text>
              </View>
            )}

            <Pressable onPress={handleSave} disabled={saving} style={{ marginBottom: 24, opacity: saving ? 0.7 : 1 }}>
              <LinearGradient
                colors={[colors.primary, "rgba(254,93,157,0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.onColor} />
                ) : (
                  <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 15 }}>
                    Enregistrer mes préférences
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
