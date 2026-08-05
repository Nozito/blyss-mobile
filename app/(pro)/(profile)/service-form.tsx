import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { proApi } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";

const DURATION_PRESETS = [30, 45, 60, 90, 120];

function formatDurationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

type Service = {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  active?: boolean;
};

type FormData = {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
};

function SectionLabel({ text }: { text: string }) {
  const colors = useThemeColors();
  return (
    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, letterSpacing: 0.1, marginBottom: 6 }}>
      {text}
    </Text>
  );
}

export default function ServiceFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const initialized = useRef(false);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: servicesData } = useQuery({
    queryKey: ["pro-services"],
    queryFn: () => proApi.getServices(),
    enabled: isEdit,
  });

  const existing = isEdit
    ? ((servicesData?.data as Service[] | undefined) ?? []).find((s) => String(s.id) === id)
    : undefined;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { name: "", description: "", price: "", duration_minutes: "60" },
  });

  useEffect(() => {
    if (!existing || initialized.current) return;
    initialized.current = true;
    reset({
      name: existing.name,
      description: existing.description ?? "",
      price: String(existing.price),
      duration_minutes: String(existing.duration_minutes),
    });
    setIsActive(existing.active !== false);
  }, [existing, reset]);

  const createMutation = useMutation({
    // apiCall() ne rejette jamais sa promesse (voir lib/api.ts) — sans ce throw,
    // un échec métier renvoyé par le serveur (res.success: false) déclenchait
    // silencieusement onSuccess : le formulaire se fermait comme si la
    // prestation avait été créée, alors que rien ne s'était passé côté serveur.
    mutationFn: async (d: Parameters<typeof proApi.createService>[0]) => {
      const res = await proApi.createService(d);
      if (!res.success) throw new Error(res.error ?? "Impossible de créer la prestation.");
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-services"] });
      safeBack(router);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Impossible de créer la prestation."),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ pid, data }: { pid: number; data: Parameters<typeof proApi.updateService>[1] }) => {
      const res = await proApi.updateService(pid, data);
      if (!res.success) throw new Error(res.error ?? "Impossible de modifier la prestation.");
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-services"] });
      safeBack(router);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Impossible de modifier la prestation."),
  });

  const onSubmit = (fd: FormData) => {
    setFormError(null);
    const price = parseFloat(fd.price);
    const duration = parseInt(fd.duration_minutes, 10);
    if (isNaN(price) || price <= 0) {
      setFormError("Le prix doit être un nombre positif.");
      return;
    }
    if (isNaN(duration) || duration <= 0) {
      setFormError("La durée doit être un nombre positif.");
      return;
    }
    const payload = {
      name: fd.name.trim(),
      description: fd.description.trim(),
      price,
      duration_minutes: duration,
      active: isActive,
    };
    if (isEdit && existing) {
      updateMutation.mutate({ pid: existing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const durationValue = watch("duration_minutes");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 200,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 }}>
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
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
              {isEdit ? "Modifier la prestation" : "Nouvelle prestation"}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
              {isEdit ? "Mets à jour les informations" : "Ajoute une prestation à ton catalogue"}
            </Text>
          </View>
        </View>

        {/* Nom */}
        <View style={{ marginBottom: 16 }}>
          <SectionLabel text="Nom de la prestation *" />
          <Controller
            control={control}
            name="name"
            rules={{ required: "Nom requis", maxLength: { value: 100, message: "100 caractères max" } }}
            render={({ field: { onChange, value } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Ex : Pose gel full cover"
                leftIcon="sparkles-outline"
                error={errors.name?.message}
                autoCapitalize="sentences"
              />
            )}
          />
        </View>

        {/* Description */}
        <View style={{ marginBottom: 16 }}>
          <SectionLabel text="Description" />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <View style={{
                backgroundColor: colors.cream, borderRadius: 14,
                borderWidth: 1.5, borderColor: colors.border,
                paddingHorizontal: 14, paddingVertical: 12, minHeight: 90,
              }}>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="Décris ta prestation : technique, matériaux, résultat..."
                  placeholderTextColor={colors.inputPlaceholder}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                  style={{ fontSize: 14.5, color: colors.foreground, padding: 0 }}
                />
              </View>
            )}
          />
        </View>

        {/* Prix */}
        <View style={{ marginBottom: 16 }}>
          <SectionLabel text="Prix (€) *" />
          <Controller
            control={control}
            name="price"
            rules={{ required: "Prix requis" }}
            render={({ field: { onChange, value } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Ex : 55"
                keyboardType="decimal-pad"
                leftIcon="pricetag-outline"
                error={errors.price?.message}
              />
            )}
          />
        </View>

        {/* Durée */}
        <View style={{ marginBottom: 16 }}>
          <SectionLabel text="Durée *" />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {DURATION_PRESETS.map((d) => {
              const selected = durationValue === String(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => setValue("duration_minutes", String(d))}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? `${colors.primary}15` : colors.cream,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? colors.primary : colors.mutedForeground }}>
                    {formatDurationLabel(d)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Controller
            control={control}
            name="duration_minutes"
            rules={{ required: "Durée requise" }}
            render={({ field: { onChange, value } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Durée en minutes"
                keyboardType="number-pad"
                leftIcon="time-outline"
                error={errors.duration_minutes?.message}
                hint="Saisie libre en minutes"
              />
            )}
          />
        </View>

        {/* Actif / Inactif */}
        <View style={{
          backgroundColor: colors.card, borderRadius: 16,
          borderWidth: 1, borderColor: colors.border,
          padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: isActive ? `${colors.primary}15` : colors.muted,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons
              name={isActive ? "checkmark-circle-outline" : "pause-circle-outline"}
              size={22}
              color={isActive ? colors.primary : colors.mutedForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              Prestation {isActive ? "active" : "inactive"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              {isActive ? "Visible et réservable par tes clientes" : "Masquée, non réservable"}
            </Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.onColor}
          />
        </View>
      </ScrollView>

      {/* Sticky CTA — positioned above the absolute tab bar (height 64, bottom insets.bottom+24) */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: insets.bottom + 96,
        backgroundColor: withAlpha(colors.background, 0.97),
      }}>
        {formError && <View style={{ marginBottom: 10 }}><ErrorMessage message={formError} /></View>}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          style={{
            height: 56, borderRadius: 20,
            backgroundColor: colors.primary,
            alignItems: "center", justifyContent: "center",
            flexDirection: "row", gap: 8,
            opacity: isLoading ? 0.7 : 1,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
          }}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onColor} />
          ) : (
            <>
              <Ionicons name={isEdit ? "save-outline" : "add-circle-outline"} size={20} color={colors.onColor} />
              <Text style={{ color: colors.onColor, fontWeight: "700", fontSize: 16 }}>
                {isEdit ? "Enregistrer les modifications" : "Créer la prestation"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
