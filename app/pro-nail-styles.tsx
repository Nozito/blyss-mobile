/**
 * #34 — « Mes spécialités nails » (profil pro). Multi-select des styles
 * déclarés, utilisés par la reco de l'onboarding client.
 * Route top-level, navigable via router.push("/pro-nail-styles").
 */
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { proApi, type NailStyle } from "@/lib/api";
import { NAIL_STYLE_OPTIONS } from "@/lib/clientOnboardingContent";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useToast } from "@/components/ui/Toast";
import { useThemeColors } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { safeBack } from "@/lib/navigation";

export default function ProNailStylesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pro-nail-styles"],
    queryFn: async () => {
      const res = await proApi.getNailStyles();
      if (!res.success || !res.data) throw new Error(res.error ?? "Chargement impossible");
      return res.data.styles;
    },
  });

  const [selected, setSelected] = useState<Set<NailStyle>>(new Set());
  useEffect(() => {
    if (data) setSelected(new Set(data));
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const a = [...selected].sort().join(",");
    const b = [...data].sort().join(",");
    return a !== b;
  }, [selected, data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await proApi.setNailStyles([...selected]);
      if (!res.success) throw new Error(res.error ?? "Enregistrement impossible");
      return res.data?.styles ?? [];
    },
    onSuccess: (styles) => {
      qc.setQueryData(["pro-nail-styles"], styles);
      showToast("Spécialités enregistrées", "success");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Erreur", "error"),
  });

  const toggle = (v: NailStyle) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-5 pt-2 pb-4">
        <AnimatedIconButton onPress={() => safeBack(router, "/(pro)/(profile)")}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </AnimatedIconButton>
        <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>
          Mes spécialités nails
        </Text>
      </View>

      {isLoading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {isError && !isLoading && (
        <View style={{ paddingHorizontal: 20 }}>
          <ErrorMessage message="Impossible de charger tes spécialités." />
        </View>
      )}

      {!isLoading && !isError && (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>
              Sélectionne les styles que tu proposes. Ils permettent aux nouvelles clientes de
              te trouver quand elles cherchent ce type de prestation.
            </Text>

            <View style={{ gap: 10 }}>
              {NAIL_STYLE_OPTIONS.map((opt) => {
                const on = selected.has(opt.value);
                return (
                  <AnimatedPressable
                    key={opt.value}
                    onPress={() => toggle(opt.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? withAlpha(colors.primary, 0.08) : colors.card,
                    }}
                  >
                    <Text style={{ fontSize: 20 }}>{opt.emoji}</Text>
                    <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
                      {opt.label}
                    </Text>
                    <Ionicons
                      name={on ? "checkbox" : "square-outline"}
                      size={22}
                      color={on ? colors.primary : colors.mutedForeground}
                    />
                  </AnimatedPressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <LoadingButton
              loading={save.isPending}
              onPress={() => save.mutate()}
              label="Enregistrer"
              disabled={!dirty}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
