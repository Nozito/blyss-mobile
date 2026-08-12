import React, { useCallback, memo } from "react";
import { View, Text, FlatList, Pressable, Switch } from "react-native";
import { useActionSheet } from "@/components/ui/ActionSheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useRouter } from "expo-router";
import { proApi } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useThemeColors } from "@/hooks/useThemeColors";
import { safeBack } from "@/lib/navigation";
import { useToast } from "@/components/ui/Toast";

type Service = {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  active?: boolean;
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

const ServiceRow = memo(function ServiceRow({
  item,
  onToggleActive,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  item: Service;
  onToggleActive: (id: number, active: boolean) => void;
  onDuplicate: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const colors = useThemeColors();
  const inactive = item.active === false;
  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: 20, marginBottom: 12,
      borderWidth: 1,
      borderColor: inactive ? colors.border : `${colors.primary}25`,
      overflow: "hidden",
    }}>
      {/* Ligne principale */}
      <View style={{ padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: inactive ? colors.muted : `${colors.primary}15`,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons
            name="color-palette-outline"
            size={22}
            color={inactive ? colors.mutedForeground : colors.primary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, flex: 1 }} numberOfLines={1}>
              {item.name}
            </Text>
            {inactive && <Badge variant="secondary" size="sm">Inactif</Badge>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>
              {(typeof item.price === "number" ? item.price : parseFloat(String(item.price ?? "0"))).toFixed(2)} €
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                {formatDuration(item.duration_minutes)}
              </Text>
            </View>
          </View>
          {item.description ? (
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4 }} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Barre d'actions */}
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, alignItems: "center" }}>
        {/* Toggle actif */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}>
          <Ionicons
            name={inactive ? "pause-circle-outline" : "checkmark-circle-outline"}
            size={15}
            color={inactive ? colors.mutedForeground : colors.success}
          />
          <Text style={{ fontSize: 12, fontWeight: "600", color: inactive ? colors.mutedForeground : colors.success }}>
            {inactive ? "Inactive" : "Active"}
          </Text>
          <Switch
            value={!inactive}
            onValueChange={(val) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onToggleActive(item.id, val);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.onColor}
            style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
          />
        </View>

        {/* Dupliquer */}
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onDuplicate(item.id);
          }}
          accessibilityLabel="Dupliquer la prestation"
          accessibilityRole="button"
          style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", borderLeftWidth: 1, borderLeftColor: colors.border }}
        >
          <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
        </AnimatedPressable>

        {/* Modifier */}
        <AnimatedPressable
          onPress={() => onEdit(item.id)}
          accessibilityLabel="Modifier la prestation"
          accessibilityRole="button"
          style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", borderLeftWidth: 1, borderLeftColor: colors.border }}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.primary} />
        </AnimatedPressable>

        {/* Supprimer */}
        <AnimatedPressable
          onPress={() => onDelete(item.id, item.name)}
          accessibilityLabel="Supprimer la prestation"
          accessibilityRole="button"
          style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", borderLeftWidth: 1, borderLeftColor: colors.border }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        </AnimatedPressable>
      </View>
    </View>
  );
});

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const qc = useQueryClient();
  const showActionSheet = useActionSheet();
  const { showToast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pro-services"],
    queryFn: () => proApi.getServices(),
  });

  const toggleMutation = useMutation<
    Awaited<ReturnType<typeof proApi.updateService>>,
    Error,
    { id: number; active: boolean },
    { prev: unknown }
  >({
    // apiCall() ne rejette jamais — sans ce throw, un échec métier ne
    // déclenchait jamais le rollback ci-dessous et le switch restait affiché
    // dans le mauvais état indéfiniment.
    mutationFn: async ({ id, active }) => {
      const res = await proApi.updateService(id, { active });
      if (!res.success) throw new Error(res.error ?? "Action impossible");
      return res;
    },
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ["pro-services"] });
      const prev = qc.getQueryData(["pro-services"]);
      qc.setQueryData(["pro-services"], (old: unknown) => {
        const o = old as { data?: Service[] } | undefined;
        return { ...o, data: (o?.data ?? []).map((s) => s.id === id ? { ...s, active } : s) };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(["pro-services"], ctx?.prev);
      showToast("Impossible de mettre à jour la prestation", "error");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await proApi.duplicateService(id);
      if (!res.success) throw new Error(res.error ?? "Duplication impossible");
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-services"] }),
    onError: () => showToast("Impossible de dupliquer la prestation", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await proApi.deleteService(id);
      if (!res.success) throw new Error(res.error ?? "Suppression impossible");
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-services"] }),
    onError: (err) =>
      showToast(err instanceof Error ? err.message : "Impossible de supprimer la prestation", "error"),
  });

  const services = (data?.data as Service[] | undefined) ?? [];
  const activeCount = services.filter((s) => s.active !== false).length;

  const handleToggleActive = useCallback(
    (id: number, active: boolean) => toggleMutation.mutate({ id, active }),
    [toggleMutation]
  );
  const handleDuplicate = useCallback(
    (id: number) => duplicateMutation.mutate(id),
    [duplicateMutation]
  );
  const handleEdit = useCallback(
    (id: number) => router.push(`/(pro)/(profile)/service-form?id=${id}`),
    [router]
  );
  const handleDelete = useCallback(
    (id: number, name: string) =>
      showActionSheet(
        {
          title: "Supprimer la prestation",
          message: `Supprimer « ${name} » ? Cette action est irréversible.`,
          options: ["Annuler", "Supprimer"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (idx) => {
          if (idx === 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            deleteMutation.mutate(id);
          }
        }
      ),
    [deleteMutation, showActionSheet]
  );

  const renderServiceItem = useCallback(
    ({ item }: { item: Service }) => (
      <ServiceRow
        item={item}
        onToggleActive={handleToggleActive}
        onDuplicate={handleDuplicate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [handleToggleActive, handleDuplicate, handleEdit, handleDelete]
  );

  const listHeader = (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingTop: 16, paddingBottom: 16,
    }}>
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
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
          Prestations
        </Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
          {activeCount} active{activeCount !== 1 ? "s" : ""} sur {services.length}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/(pro)/(profile)/service-form")}
        accessibilityLabel="Ajouter une prestation"
        accessibilityRole="button"
        style={{
          width: 40, height: 40, borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: "center", justifyContent: "center",
          shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
        }}
      >
        <Ionicons name="add" size={22} color={colors.onColor} />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {isLoading ? (
        <View style={{ paddingHorizontal: 20, flex: 1 }}>
          {listHeader}
          <LoadingSpinner />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshing={false}
          onRefresh={refetch}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 64, gap: 12 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: `${colors.primary}15`,
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="color-palette-outline" size={28} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>
                Aucune prestation
              </Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}>
                Crée ta première prestation{"\n"}pour qu'elles apparaissent ici
              </Text>
              <Pressable
                onPress={() => router.push("/(pro)/(profile)/service-form")}
                style={{
                  marginTop: 8, paddingHorizontal: 24, paddingVertical: 12,
                  backgroundColor: colors.primary, borderRadius: 16,
                  flexDirection: "row", alignItems: "center", gap: 8,
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.onColor} />
                <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 14 }}>Créer une prestation</Text>
              </Pressable>
            </View>
          }
          renderItem={renderServiceItem}
        />
      )}
    </View>
  );
}
