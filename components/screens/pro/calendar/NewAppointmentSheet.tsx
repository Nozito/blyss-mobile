import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { withAlpha } from "@/constants/colors";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { proApi, type AvailabilitySlot, type ManualOverrideMode } from "@/lib/api";

type Client = {
  id: number;
  first_name: string;
  last_name: string;
  // Absents en mode "Nouvelle cliente" (exact) — minimisation côté backend.
  phone_number?: string | null;
  email?: string;
  profile_photo: string | null;
};

type Prestation = {
  id: number;
  name: string;
  price: number;
  duration_minutes: number;
  active?: boolean;
};

export type EditableAppointment = {
  id: number;
  clientLabel: string;
  prestationId: number | null;
  date: Date;
  durationMinutes: number;
};

const EARLY_EXECUTION_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoAt(date: Date, hours: number, minutes: number) {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function NewAppointmentSheet({
  visible,
  onClose,
  onSaved,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  /** `proposalSent: true` = la pro a modifié un RDV existant : ce n'est qu'une
   * proposition envoyée à la cliente, pas encore un changement effectif. */
  onSaved: (info?: { proposalSent?: boolean; overrideApplied?: ManualOverrideMode | null }) => void;
  /** When set, the sheet edits this appointment instead of creating a new one — client isn't editable. */
  editing?: EditableAppointment | null;
}) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const { user } = useAuth();
  const isEditing = !!editing;

  const [step, setStep] = useState<1 | 2 | 3>(isEditing ? 2 : 1);

  const [clientQuery, setClientQuery] = useState("");
  const debouncedClientQuery = useDebounce(clientQuery.trim(), 250);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  // RGPD — "relation" : recherche par nom parmi les clientes de la pro.
  // "exact" : walk-in, correspondance exacte email/téléphone uniquement.
  const [clientMode, setClientMode] = useState<"relation" | "exact">("relation");
  // Contact exact saisi pour une walk-in — renvoyé au backend qui revérifie
  // la concordance avec le client_id.
  const [walkinContact, setWalkinContact] = useState<string | null>(null);

  const [services, setServices] = useState<Prestation[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedPrestation, setSelectedPrestation] = useState<Prestation | null>(null);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState("09:00");
  const [earlyExecutionAccepted, setEarlyExecutionAccepted] = useState(false);
  const [initiatedVia, setInitiatedVia] = useState<"app" | "phone">("app");
  const [phoneReason, setPhoneReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Créneaux calculés côté serveur (moteur de dispo 3.2) — remplace la
  // génération locale. Chargés pour la date sélectionnée dès qu'une prestation
  // est choisie (flow création uniquement).
  const [computedSlots, setComputedSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);
  // Override d'ajout manuel (3.4) : proposé seulement après un refus du backend
  // avec canOverride, jamais par défaut.
  const [pendingOverride, setPendingOverride] = useState<{
    mode: ManualOverrideMode;
    message: string;
  } | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [alternativeSlots, setAlternativeSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);
    setClientMode("relation");
    setWalkinContact(null);
    setInitiatedVia("app");
    setPhoneReason("");
    setComputedSlots([]);
    setSelectedSlotStart(null);
    setPendingOverride(null);
    setOverrideNote("");
    setAlternativeSlots([]);
    if (editing) {
      setStep(2);
      setSelectedClient(null);
      setClientQuery("");
      setClientResults([]);
      setDate(editing.date);
      setTime(`${pad2(editing.date.getHours())}:${pad2(editing.date.getMinutes())}`);
      setEarlyExecutionAccepted(false);
    } else {
      setStep(1);
      setSelectedClient(null);
      setClientQuery("");
      setClientResults([]);
      setSelectedPrestation(null);
      setDate(new Date());
      setTime("09:00");
      setEarlyExecutionAccepted(false);
    }
  }, [visible, editing]);

  useEffect(() => {
    if (!visible) return;
    setServicesLoading(true);
    proApi.getServices().then((res) => {
      const list = (res.success && res.data ? (res.data as Prestation[]) : []).filter((p) => p.active !== false);
      setServices(list);
      if (editing?.prestationId) {
        const match = list.find((p) => p.id === editing.prestationId);
        if (match) setSelectedPrestation(match);
      }
    }).catch(() => setServices([])).finally(() => setServicesLoading(false));
  }, [visible, editing]);

  useEffect(() => {
    if (!visible || isEditing) return;
    if (!debouncedClientQuery) {
      setClientResults([]);
      setClientSearchLoading(false);
      return;
    }
    let cancelled = false;
    setClientSearchLoading(true);
    proApi.searchClients(debouncedClientQuery, { exact: clientMode === "exact" }).then((res) => {
      if (cancelled) return;
      setClientResults(res.success && res.data ? res.data : []);
      setClientSearchLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setClientResults([]);
        setClientSearchLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [visible, isEditing, debouncedClientQuery, clientMode]);

  const duration = selectedPrestation?.duration_minutes ?? editing?.durationMinutes ?? 60;
  const dateStr = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  // Charge les créneaux calculés pour la date + prestation sélectionnées.
  useEffect(() => {
    if (!visible || isEditing || step !== 3 || !selectedPrestation || !user?.id) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlotStart(null);
    setPendingOverride(null);
    setAlternativeSlots([]);
    proApi
      .getAvailability({
        proId: user.id,
        serviceIds: [selectedPrestation.id],
        fromDate: dateStr,
        toDate: dateStr,
      })
      .then((res) => {
        if (cancelled) return;
        const day = res.success && res.data ? res.data.days.find((d) => d.date === dateStr) : undefined;
        setComputedSlots(day?.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setComputedSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, isEditing, step, selectedPrestation, dateStr, user?.id]);

  // Départ effectif : un créneau calculé si choisi, sinon la saisie manuelle
  // (heure libre — déclenche le chemin override si hors créneaux).
  const [h, m] = time.split(":").map(Number);
  const manualStartAt = toIsoAt(date, h || 0, m || 0);
  const startAt = selectedSlotStart ? new Date(selectedSlotStart) : manualStartAt;
  const endAt = new Date(startAt.getTime() + duration * 60_000);
  const needsEarlyExecutionConsent = startAt.getTime() - Date.now() < EARLY_EXECUTION_THRESHOLD_MS;

  const handleSubmit = async () => {
    setError(null);
    if (!selectedPrestation) {
      setError("Choisis une prestation");
      return;
    }
    if (startAt <= new Date()) {
      setError("Choisis une date et une heure dans le futur");
      return;
    }
    if (needsEarlyExecutionConsent && !earlyExecutionAccepted) {
      setError("Ce RDV a lieu dans moins de 14 jours : coche la case de consentement ci-dessous");
      return;
    }
    if (isEditing && initiatedVia === "phone" && !phoneReason.trim()) {
      setError("Indique le motif de ce report annoncé par téléphone");
      return;
    }

    if (pendingOverride?.mode === "conflict" && !overrideNote.trim()) {
      setError("Indique le motif pour forcer ce créneau en conflit");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && editing) {
        const res = await proApi.updateAppointment(editing.id, {
          start_datetime: startAt.toISOString(),
          end_datetime: endAt.toISOString(),
          prestation_id: selectedPrestation.id,
          initiated_via: initiatedVia,
          ...(initiatedVia === "phone" ? { reason: phoneReason.trim() } : {}),
        });
        if (!res.success) throw new Error(res.error || "Erreur lors de la modification");
        onSaved({ proposalSent: true });
        onClose();
        return;
      }

      if (!selectedClient) {
        setError("Choisis une cliente");
        setSaving(false);
        return;
      }

      const res = await proApi.createAppointment({
        client_id: selectedClient.id,
        prestation_id: selectedPrestation.id,
        start_datetime: startAt.toISOString(),
        end_datetime: endAt.toISOString(),
        early_execution_requested: needsEarlyExecutionConsent,
        ...(walkinContact ? { client_contact: walkinContact } : {}),
        ...(pendingOverride
          ? {
              manual_override: {
                mode: pendingOverride.mode,
                ...(overrideNote.trim() ? { note: overrideNote.trim() } : {}),
              },
            }
          : {}),
      });

      if (res.success) {
        onSaved({ overrideApplied: res.data.override_applied });
        onClose();
        return;
      }

      // Refus exploitable : le backend indique si un override est possible.
      if (res.canOverride && res.code) {
        const mode: ManualOverrideMode = res.code === "OUTSIDE_WORKING_HOURS" ? "outside_hours" : "conflict";
        setPendingOverride({
          mode,
          message:
            mode === "outside_hours"
              ? "Ce créneau est en dehors de tes horaires d'ouverture. Tu peux l'ajouter quand même — les heures voisines ne deviennent pas réservables pour autant."
              : "Ce créneau chevauche un rendez-vous existant. Forcer l'ajout est un dernier recours : la cliente concernée devra être prévenue.",
        });
        setAlternativeSlots(res.alternativeSlots ?? []);
        setError(null);
        return;
      }

      setAlternativeSlots(res.alternativeSlots ?? []);
      throw new Error(res.error || "Erreur lors de la création");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} bottomSheet noPadding maxHeight="92%">
      <View style={{ overflow: "hidden", borderTopLeftRadius: 28, borderTopRightRadius: 28, flex: 1 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4 }} />

        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 17, fontWeight: "800", color: colors.foreground }}>
              {isEditing ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              {isEditing ? editing?.clientLabel : step === 1 ? "1. Choisis la cliente" : step === 2 ? "2. Choisis la prestation" : "3. Date & heure"}
            </Text>
          </View>
          <AnimatedIconButton
            onPress={onClose}
            accessibilityLabel="Fermer"
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={18} color={colors.foreground} />
          </AnimatedIconButton>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          {step === 1 && !isEditing && (
            <View style={{ gap: 12 }}>
              {/* RGPD — la recherche par nom ne porte que sur les clientes de la
                  pro ; une nouvelle cliente se rattache par email/téléphone exact. */}
              <View style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: 12, padding: 3 }}>
                {([
                  { key: "relation", label: "Mes clientes" },
                  { key: "exact", label: "Nouvelle cliente" },
                ] as const).map((opt) => {
                  const active = clientMode === opt.key;
                  return (
                    <AnimatedPressable
                      key={opt.key}
                      onPress={() => {
                        setClientMode(opt.key);
                        setClientQuery("");
                        setClientResults([]);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: active ? colors.white : "transparent" }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? colors.foreground : colors.mutedForeground }}>{opt.label}</Text>
                    </AnimatedPressable>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, height: 46 }}>
                <Ionicons name={clientMode === "exact" ? "at-outline" : "search-outline"} size={16} color={colors.mutedForeground} />
                <TextInput
                  value={clientQuery}
                  onChangeText={setClientQuery}
                  placeholder={clientMode === "exact" ? "Email ou téléphone exact" : "Nom de la cliente"}
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, fontSize: 14, color: colors.foreground }}
                  autoCapitalize="none"
                  keyboardType={clientMode === "exact" ? "email-address" : "default"}
                />
              </View>

              {clientSearchLoading ? (
                <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator size="small" color={colors.primary} /></View>
              ) : clientResults.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center", paddingVertical: 12 }}>
                  {clientMode === "exact"
                    ? (debouncedClientQuery
                        ? "Aucune cliente avec cet email ou ce téléphone exact"
                        : "Saisis l'email ou le téléphone exact communiqué par la cliente")
                    : (debouncedClientQuery
                        ? "Aucune cliente à ce nom parmi les tiennes"
                        : "Recherche parmi tes clientes existantes")}
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {clientResults.map((c) => (
                    <AnimatedPressable
                      key={c.id}
                      onPress={() => {
                        setSelectedClient(c);
                        setWalkinContact(clientMode === "exact" ? clientQuery.trim() : null);
                        setStep(2);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Avatar uri={c.profile_photo} name={`${c.first_name} ${c.last_name}`} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
                          {c.first_name} {c.last_name}
                        </Text>
                        {!!c.phone_number && (
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>{c.phone_number}</Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                    </AnimatedPressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: 12 }}>
              {!isEditing && selectedClient && (
                <AnimatedPressable onPress={() => setStep(1)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Ionicons name="chevron-back" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{selectedClient.first_name} {selectedClient.last_name}</Text>
                </AnimatedPressable>
              )}
              {servicesLoading ? (
                <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator size="small" color={colors.primary} /></View>
              ) : services.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center", paddingVertical: 12 }}>Aucune prestation active</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {services.map((s) => {
                    const selected = selectedPrestation?.id === s.id;
                    return (
                      <AnimatedPressable
                        key={s.id}
                        onPress={() => { setSelectedPrestation(s); setStep(3); }}
                        style={{
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          backgroundColor: selected ? withAlpha(colors.primary, 0.08) : colors.white,
                          borderRadius: 14, padding: 14,
                          borderWidth: 1.5, borderColor: selected ? colors.primary : colors.border,
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{s.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                            {s.duration_minutes} min · {Number(s.price).toFixed(2).replace(".", ",")} €
                          </Text>
                        </View>
                        <Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} size={20} color={selected ? colors.primary : colors.mutedForeground} />
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {step === 3 && selectedPrestation && (
            <View style={{ gap: 18 }}>
              <AnimatedPressable onPress={() => setStep(2)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="chevron-back" size={16} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{selectedPrestation.name}</Text>
              </AnimatedPressable>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>Date</Text>
                <AnimatedPressable
                  onPress={() => setShowDatePicker(true)}
                  style={{ height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: showDatePicker ? colors.primary : colors.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, textTransform: "capitalize" }}>
                    {date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </AnimatedPressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    minimumDate={new Date()}
                    onChange={(_, d) => {
                      if (Platform.OS === "android") setShowDatePicker(false);
                      if (d) setDate(d);
                    }}
                    themeVariant={isDark ? "dark" : "light"}
                    accentColor={colors.primary}
                  />
                )}
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                  Heure de début
                </Text>

                {isEditing ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"].map((t) => (
                        <AnimatedPressable
                          key={t}
                          onPress={() => setTime(t)}
                          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: time === t ? colors.primary : colors.muted }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "700", color: time === t ? colors.onColor : colors.foreground }}>{t}</Text>
                        </AnimatedPressable>
                      ))}
                    </View>
                  </ScrollView>
                ) : slotsLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: "center" }}><ActivityIndicator size="small" color={colors.primary} /></View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {computedSlots.length === 0 ? (
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                        Aucun créneau disponible ce jour-là selon tes horaires d'ouverture et tes absences.
                      </Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {computedSlots.map((s) => {
                            const label = new Date(s.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                            const active = selectedSlotStart === s.start;
                            return (
                              <AnimatedPressable
                                key={s.start}
                                onPress={() => { setSelectedSlotStart(s.start); setPendingOverride(null); setAlternativeSlots([]); }}
                                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: active ? colors.primary : colors.muted }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: "700", color: active ? colors.onColor : colors.foreground }}>{label}</Text>
                              </AnimatedPressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                    )}

                    <AnimatedPressable
                      onPress={() => { setSelectedSlotStart(null); setShowDatePicker(false); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <Ionicons name={selectedSlotStart ? "ellipse-outline" : "radio-button-on"} size={15} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Saisir une autre heure</Text>
                    </AnimatedPressable>

                    {!selectedSlotStart && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00"].map((t) => (
                            <AnimatedPressable
                              key={t}
                              onPress={() => { setTime(t); setPendingOverride(null); }}
                              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: time === t ? colors.primary : "transparent" }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "700", color: time === t ? colors.onColor : colors.foreground }}>{t}</Text>
                            </AnimatedPressable>
                          ))}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Ionicons name="time-outline" size={16} color={colors.mutedForeground} />
                <Text style={{ fontSize: 13, color: colors.mutedForeground, flex: 1 }}>
                  RDV de{" "}
                  <Text style={{ fontWeight: "700", color: colors.foreground }}>
                    {startAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {" "}à{" "}
                  <Text style={{ fontWeight: "700", color: colors.foreground }}>
                    {endAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {" · "}{duration} min
                </Text>
              </View>

              {pendingOverride && (
                <View
                  style={{
                    gap: 10,
                    backgroundColor: pendingOverride.mode === "conflict" ? colors.destructiveLight : colors.warningLight,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: pendingOverride.mode === "conflict" ? colors.destructiveText : colors.warningBorder,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Ionicons
                      name={pendingOverride.mode === "conflict" ? "alert-circle" : "warning-outline"}
                      size={18}
                      color={pendingOverride.mode === "conflict" ? colors.destructive : colors.warningText}
                    />
                    <Text style={{ fontSize: 12, color: colors.warningTextDark, flex: 1, lineHeight: 17 }}>
                      {pendingOverride.message}
                    </Text>
                  </View>
                  {pendingOverride.mode === "conflict" && (
                    <TextInput
                      value={overrideNote}
                      onChangeText={setOverrideNote}
                      placeholder="Motif obligatoire (ex: cliente prévenue, RDV maintenu à sa demande)"
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                      style={{ backgroundColor: colors.white, borderRadius: 10, padding: 10, fontSize: 13, color: colors.foreground, minHeight: 54, textAlignVertical: "top" }}
                    />
                  )}
                </View>
              )}

              {alternativeSlots.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground }}>Créneaux proches disponibles</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {alternativeSlots.map((s) => (
                        <AnimatedPressable
                          key={s.start}
                          onPress={() => {
                            const d = new Date(s.start);
                            setDate(d);
                            setSelectedSlotStart(s.start);
                            setPendingOverride(null);
                            setAlternativeSlots([]);
                          }}
                          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.muted }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                            {new Date(s.start).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}{" "}
                            {new Date(s.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </AnimatedPressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {isEditing && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Comment ce report a-t-il été convenu ?
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <AnimatedPressable
                      onPress={() => setInitiatedVia("app")}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: initiatedVia === "app" ? colors.primary : colors.muted }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: initiatedVia === "app" ? colors.onColor : colors.foreground }}>
                        Dans l'application
                      </Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => setInitiatedVia("phone")}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: initiatedVia === "phone" ? colors.primary : colors.muted }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: initiatedVia === "phone" ? colors.onColor : colors.foreground }}>
                        Par téléphone
                      </Text>
                    </AnimatedPressable>
                  </View>
                  {initiatedVia === "phone" && (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
                        La cliente reste informée et doit accepter dans l'application — un appel téléphonique ne modifie jamais son rendez-vous directement.
                      </Text>
                      <TextInput
                        value={phoneReason}
                        onChangeText={setPhoneReason}
                        placeholder="Motif du report (ex: cliente indisponible sur le créneau initial)"
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                        style={{
                          backgroundColor: colors.muted,
                          borderRadius: 12,
                          padding: 12,
                          fontSize: 13,
                          color: colors.foreground,
                          minHeight: 60,
                          textAlignVertical: "top",
                        }}
                      />
                    </View>
                  )}
                </View>
              )}

              {needsEarlyExecutionConsent && (
                <AnimatedPressable
                  onPress={() => setEarlyExecutionAccepted((v) => !v)}
                  style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: colors.warningLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.warningBorder }}
                >
                  <Ionicons name={earlyExecutionAccepted ? "checkbox" : "square-outline"} size={20} color={colors.warningText} />
                  <Text style={{ fontSize: 12, color: colors.warningTextDark, flex: 1, lineHeight: 17 }}>
                    La cliente a expressément demandé un rendez-vous dans moins de 14 jours et reconnaît perdre son droit de rétractation une fois la prestation exécutée.
                  </Text>
                </AnimatedPressable>
              )}

              {error && <ErrorMessage message={error} />}

              <LoadingButton
                loading={saving}
                onPress={handleSubmit}
                label={
                  isEditing
                    ? "Enregistrer les modifications"
                    : pendingOverride?.mode === "conflict"
                      ? "Forcer malgré le conflit"
                      : pendingOverride?.mode === "outside_hours"
                        ? "Ajouter hors horaires"
                        : "Créer le rendez-vous"
                }
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
