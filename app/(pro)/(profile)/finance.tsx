import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { proApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";

type Period = "week" | "month" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
};

function n(v: unknown): number {
  if (typeof v === "number") return v;
  // Handle French decimal format ("123,45") as well as standard ("123.45")
  const normalized = String(v ?? "0").replace(/\s/g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
}

export default function ProFinanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedPeriod, setSelectedPeriod] = useState<Period>("month");
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [objectiveInput, setObjectiveInput] = useState("");
  const [exporting, setExporting]     = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [objectiveSaved, setObjectiveSaved] = useState(false); // BLYSS-FIX: 2.1
  const objectiveSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // BLYSS-FIX: 2.1
  const [showExportModal, setShowExportModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pro-finance-stats"],
    queryFn: () => proApi.getFinanceStats(),
    staleTime: 60_000,
  });

  const objectiveMutation = useMutation({
    mutationFn: (obj: number) => proApi.updateFinanceObjective(obj),
    onSuccess: () => { // BLYSS-FIX: 2.1
      void qc.invalidateQueries({ queryKey: ["pro-finance-stats"] });
      setShowObjectiveModal(false);
      setObjectiveSaved(true);
      if (objectiveSavedTimer.current) clearTimeout(objectiveSavedTimer.current);
      objectiveSavedTimer.current = setTimeout(() => setObjectiveSaved(false), 2000);
    },
    onError: () => setFinanceError("Impossible de mettre à jour l'objectif."),
  });

  const rawStats = data?.data as Record<string, unknown> | undefined;

  const stats = rawStats
    ? {
        today:       n(rawStats.today),
        week:        n(rawStats.week),
        month:       n(rawStats.month),
        lastMonth:   n(rawStats.lastMonth),
        objective:   n(rawStats.objective),
        forecast:    n(rawStats.forecast),
        trend:       rawStats.trend as string | undefined,
        topServices: (rawStats.topServices as Array<{ name: string; revenue: unknown; count: number; percentage: unknown }> | undefined) ?? [],
      }
    : null;

  const periodValue = stats
    ? selectedPeriod === "week"
      ? stats.week
      : selectedPeriod === "year"
      ? stats.month * 12
      : stats.month
    : 0;

  const variation =
    stats && stats.lastMonth > 0
      ? Math.round(((stats.month - stats.lastMonth) / stats.lastMonth) * 100)
      : null;

  const progress = stats && stats.objective > 0
    ? Math.min(Math.round((stats.month / stats.objective) * 100), 100)
    : 0;

  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const handleExport = () => { setFinanceError(null); setShowExportModal(true); };

  const exportCSV = async () => {
    setShowExportModal(false);
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      setFinanceError("L'export n'est pas disponible sur cet appareil.");
      return;
    }
    setExporting(true);
    try {
      const lines: string[] = ["Prestation,CA (€),Nb rendez-vous,Part (%)"];
      if (stats) {
        for (const svc of stats.topServices) {
          const rev = n(svc.revenue).toFixed(2);
          const pct = n(svc.percentage).toFixed(1);
          const name = `"${svc.name.replace(/"/g, '""')}"`;
          lines.push(`${name},${rev},${svc.count},${pct}`);
        }
        lines.push("");
        lines.push("Récapitulatif,Montant (€)");
        lines.push(`Aujourd'hui,${stats.today.toFixed(2)}`);
        lines.push(`Cette semaine,${stats.week.toFixed(2)}`);
        lines.push(`Ce mois,${stats.month.toFixed(2)}`);
        lines.push(`Mois dernier,${stats.lastMonth.toFixed(2)}`);
        lines.push(`Objectif mensuel,${stats.objective.toFixed(2)}`);
      }
      const csv = lines.join("\n");
      const filename = `blyss-finances-${new Date().toISOString().slice(0, 10)}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    } catch {
      setFinanceError("Impossible de générer l'export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setShowExportModal(false);
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      setFinanceError("L'export n'est pas disponible sur cet appareil.");
      return;
    }
    setExporting(true);
    try {
      const topServicesRows = stats?.topServices
        .map(
          (svc, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${svc.name}</td>
            <td>${n(svc.revenue).toFixed(2)} €</td>
            <td>${svc.count}</td>
            <td>${n(svc.percentage).toFixed(1)} %</td>
          </tr>`
        )
        .join("") ?? "";

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #FFEAF1; color: #09090B; padding: 32px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; }
    .logo { font-size: 32px; font-weight: 900; color: #FE5D9D; letter-spacing: -1px; }
    .subtitle { font-size: 13px; color: #6D6D78; margin-top: 2px; }
    .period-badge { background: #FE5D9D; color: #fff; font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 28px; }
    .card { background: #fff; border-radius: 14px; padding: 16px; }
    .card-label { font-size: 11px; color: #6D6D78; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
    .card-value { font-size: 26px; font-weight: 900; color: #09090B; }
    .card-value.primary { color: #FE5D9D; }
    .section-title { font-size: 15px; font-weight: 800; color: #09090B; margin-bottom: 12px; padding-left: 10px; border-left: 4px solid #FE5D9D; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; }
    th { background: #FE5D9D; color: #fff; font-size: 11px; font-weight: 700; text-align: left; padding: 10px 14px; }
    td { font-size: 12px; color: #09090B; padding: 10px 14px; border-bottom: 1px solid #EBE6E0; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #6D6D78; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Blyss</div>
      <div class="subtitle">Rapport financier · ${monthLabel}</div>
    </div>
    <div class="period-badge">${PERIOD_LABELS[selectedPeriod]}</div>
  </div>

  <div class="summary">
    <div class="card">
      <div class="card-label">Aujourd'hui</div>
      <div class="card-value">${stats?.today.toFixed(2) ?? "—"} €</div>
    </div>
    <div class="card">
      <div class="card-label">Cette semaine</div>
      <div class="card-value">${stats?.week.toFixed(2) ?? "—"} €</div>
    </div>
    <div class="card">
      <div class="card-label">Ce mois</div>
      <div class="card-value primary">${stats?.month.toFixed(2) ?? "—"} €</div>
    </div>
    <div class="card">
      <div class="card-label">Mois dernier</div>
      <div class="card-value">${stats?.lastMonth.toFixed(2) ?? "—"} €</div>
    </div>
  </div>

  ${stats?.topServices && stats.topServices.length > 0 ? `
  <div class="section-title">Top prestations</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Prestation</th>
        <th>CA</th>
        <th>Rdv</th>
        <th>Part</th>
      </tr>
    </thead>
    <tbody>${topServicesRows}</tbody>
  </table>` : ""}

  <div class="footer">Généré par Blyss · ${new Date().toLocaleDateString("fr-FR")}</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const filename = `blyss-finances-${new Date().toISOString().slice(0, 10)}.pdf`;
      const destUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.moveAsync({ from: uri, to: destUri });
      await Sharing.shareAsync(destUri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch {
      setFinanceError("Impossible de générer l'export PDF.");
    } finally {
      setExporting(false);
    }
  };

  const statCards = stats
    ? [
        { label: "Aujourd'hui",  value: stats.today,    icon: "sunny-outline" as const,      color: Colors.secondary },
        { label: "Cette semaine", value: stats.week,    icon: "calendar-outline" as const,    color: Colors.primary },
        { label: "Ce mois",       value: stats.month,   icon: "bar-chart-outline" as const,   color: Colors.primary },
        { label: "Mois dernier",  value: stats.lastMonth, icon: "time-outline" as const,     color: Colors.mutedForeground },
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <AnimatedIconButton
            onPress={() => safeBack(router)}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", ...Shadows.card }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
          </AnimatedIconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground }}>Finances</Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{monthLabel}</Text>
          </View>
          <Pressable
            onPress={handleExport}
            disabled={exporting || !stats}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", opacity: exporting || !stats ? 0.5 : 1, ...Shadows.card }}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={18} color={Colors.primary} />
            )}
          </Pressable>
        </View>

        {/* Period selector */}
        <View style={{ flexDirection: "row", backgroundColor: Colors.white, borderRadius: 16, padding: 4, gap: 4, ...Shadows.card }}>
          {(["week", "month", "year"] as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setSelectedPeriod(p)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: selectedPeriod === p ? Colors.primary : "transparent",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: selectedPeriod === p ? Colors.white : Colors.mutedForeground }}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : stats ? (
          <>
            {/* Hero card */}
            <LinearGradient
              colors={[Colors.primary, `${Colors.primary}E6`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 20, padding: 20, overflow: "hidden" }}
            >
              {/* Glow */}
              <View style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.12)" }} />

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                  {PERIOD_LABELS[selectedPeriod]}
                </Text>
                {variation !== null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Ionicons
                      name={variation >= 0 ? "trending-up-outline" : "trending-down-outline"}
                      size={12}
                      color={Colors.white}
                    />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.white }}>
                      {variation >= 0 ? "+" : ""}{variation}% vs mois préc.
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 42, fontWeight: "900", color: Colors.white, letterSpacing: -1, marginBottom: 4 }}>
                {periodValue.toFixed(2).replace(".", ",")} €
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                Prévision fin de mois : {stats.forecast.toFixed(2).replace(".", ",")} €
              </Text>
            </LinearGradient>

            {/* Objectif mensuel */}
            <Pressable
              onPress={() => { setObjectiveInput(String(stats.objective || "")); setShowObjectiveModal(true); }}
              style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.primary}15`, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="flag-outline" size={16} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground }}>Objectif mensuel</Text>
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                      {stats.objective > 0 ? `${stats.objective.toFixed(0)} €` : "Non défini"}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {objectiveSaved && ( // BLYSS-FIX: 2.1
                    <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.success }}>Sauvegardé ✓</Text>
                  )}
                  <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.primary }}>{progress}%</Text>
                  <Ionicons name="pencil-outline" size={14} color={Colors.mutedForeground} />
                </View>
              </View>

              {stats.objective > 0 && (
                <>
                  <View style={{ height: 8, backgroundColor: Colors.cream, borderRadius: 4, overflow: "hidden" }}>
                    <LinearGradient
                      colors={[Colors.primary, `${Colors.primary}CC`]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ height: "100%", width: `${progress}%`, borderRadius: 4 }}
                    />
                  </View>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 6 }}>
                    {stats.month.toFixed(0)} € sur {stats.objective.toFixed(0)} €
                  </Text>
                </>
              )}
            </Pressable>

            {/* Stats grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {statCards.map(({ label, value, icon, color }) => (
                <View
                  key={label}
                  style={{
                    width: "47%",
                    backgroundColor: Colors.white,
                    borderRadius: 16,
                    padding: 16,
                    ...Shadows.card,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${color}15`, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>
                    {value.toFixed(0)} €
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Top services */}
            {stats.topServices.length > 0 && (
              <View style={{ backgroundColor: Colors.white, borderRadius: 16, padding: 16, ...Shadows.card }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <View style={{ width: 4, height: 20, backgroundColor: Colors.primary, borderRadius: 2 }} />
                  <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground }}>Top prestations</Text>
                </View>

                <View style={{ gap: 14 }}>
                  {stats.topServices.slice(0, 5).map((svc, i) => {
                    const pct = n(svc.percentage);
                    const rev = n(svc.revenue);
                    return (
                      <View key={svc.name}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 8 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: `${Colors.primary}18`, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ fontSize: 9, fontWeight: "900", color: Colors.primary }}>{i + 1}</Text>
                            </View>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground, flex: 1 }} numberOfLines={1}>
                              {svc.name}
                            </Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.primary }}>{rev.toFixed(0)} €</Text>
                            <Text style={{ fontSize: 10, color: Colors.mutedForeground }}>{svc.count} rdv</Text>
                          </View>
                        </View>
                        <View style={{ height: 6, backgroundColor: Colors.cream, borderRadius: 3, overflow: "hidden" }}>
                          <LinearGradient
                            colors={[Colors.primary, `${Colors.primary}CC`]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 3 }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={{ paddingVertical: 60, alignItems: "center", gap: 12 }}>
            <Ionicons name="bar-chart-outline" size={48} color={Colors.border} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Aucune donnée</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center" }}>
              Les statistiques apparaîtront une fois tes premières réservations effectuées
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Objective modal */}
      <Modal visible={showObjectiveModal} transparent animationType="slide" onRequestClose={() => setShowObjectiveModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlayDark }}>
          <View style={{
            backgroundColor: Colors.white,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            paddingBottom: insets.bottom + 24,
            gap: 16,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.foreground }}>Objectif mensuel</Text>
              <Pressable
                onPress={() => setShowObjectiveModal(false)}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.cream, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={18} color={Colors.foreground} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 18 }}>
              Définis ton objectif de revenu mensuel pour suivre ta progression.
            </Text>

            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: Colors.cream,
              borderRadius: 14,
              paddingHorizontal: 14,
              height: 44,
              borderWidth: 1.5,
              borderColor: Colors.border,
            }}>
              <Ionicons name="flag-outline" size={18} color={Colors.primary} />
              <TextInput
                value={objectiveInput}
                onChangeText={setObjectiveInput}
                placeholder="ex. 2000"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="decimal-pad"
                style={{ flex: 1, fontSize: 17, fontWeight: "700", color: Colors.foreground, padding: 0 }}
              />
              <Text style={{ fontSize: 17, fontWeight: "700", color: Colors.primary }}>€</Text>
            </View>

            <Pressable
              onPress={() => {
                const val = parseFloat(objectiveInput);
                if (!val || val <= 0) { setFinanceError("Entre un montant valide."); return; }
                objectiveMutation.mutate(val);
              }}
              disabled={objectiveMutation.isPending}
              style={{ height: 52, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", opacity: objectiveMutation.isPending ? 0.7 : 1 }}
            >
              {objectiveMutation.isPending ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.white }}>Enregistrer</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Export format picker modal */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.overlayDark, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: "100%", borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.foreground, marginBottom: 6 }}>Exporter les données</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 20 }}>Choisir le format :</Text>
            <View style={{ gap: 10 }}>
              <Pressable onPress={exportCSV} style={{ height: 48, borderRadius: 14, backgroundColor: `${Colors.primary}15`, borderWidth: 1, borderColor: `${Colors.primary}30`, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
                <Text style={{ fontWeight: "700", color: Colors.primary }}>CSV</Text>
              </Pressable>
              <Pressable onPress={exportPDF} style={{ height: 48, borderRadius: 14, backgroundColor: `${Colors.primary}15`, borderWidth: 1, borderColor: `${Colors.primary}30`, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
                <Ionicons name="document-outline" size={18} color={Colors.primary} />
                <Text style={{ fontWeight: "700", color: Colors.primary }}>PDF</Text>
              </Pressable>
              <Pressable onPress={() => setShowExportModal(false)} style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontWeight: "600", color: Colors.mutedForeground }}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {financeError && (
        <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 20, right: 20 }}>
          <ErrorMessage message={financeError} />
        </View>
      )}
    </View>
  );
}
