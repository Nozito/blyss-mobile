import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, Animated, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/lib/api";
import { ADMIN } from "@/constants/adminTheme";
import { safeBack } from "@/lib/navigation";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const BG     = ADMIN.bg;
const CARD   = ADMIN.surface;
const BORDER = ADMIN.border;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;
const MUTED  = ADMIN.surfaceHover;

interface Log {
  id: number;
  action: string;
  description: string;
  user_name?: string;
  ip_address?: string;
  type: "info" | "success" | "warning" | "error";
  created_at: string;
}

const TYPE_CONFIG = {
  info:    { icon: "information-circle-outline" as const, color: Colors.info,        bg: ADMIN.infoBg,        label: "Info" },
  success: { icon: "checkmark-circle-outline"   as const, color: Colors.success,     bg: ADMIN.successBg,     label: "Succès" },
  warning: { icon: "warning-outline"            as const, color: Colors.warning,     bg: ADMIN.warningBg,     label: "Attention" },
  error:   { icon: "close-circle-outline"       as const, color: Colors.destructive, bg: ADMIN.dangerBg, label: "Erreur" },
};

const DATE_FILTERS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week",  label: "Cette semaine" },
  { id: "month", label: "Ce mois" },
  { id: "all",   label: "Tout" },
];

function LogRow({ log }: { log: Log }) {
  const cfg = TYPE_CONFIG[log.type];
  return (
    <View style={{
      backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: BORDER,
          }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: cfg.bg, flexShrink: 0 }}>
          <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT1, flex: 1, marginRight: 10 }} numberOfLines={2}>
              {log.action}
            </Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: cfg.bg }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: TEXT2, lineHeight: 18, marginBottom: 8 }} numberOfLines={2}>
            {log.description}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            {log.user_name && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="person-outline" size={11} color={TEXT3} />
                <Text style={{ fontSize: 11, color: TEXT2 }}>{log.user_name}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={11} color={TEXT3} />
              <Text style={{ fontSize: 11, color: TEXT2 }}>
                {new Date(log.created_at).toLocaleString("fr-FR")}
              </Text>
            </View>
            {log.ip_address && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="globe-outline" size={11} color={TEXT3} />
                <Text style={{ fontSize: 11, color: TEXT2 }}>{log.ip_address}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function StatChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: bg, borderWidth: 1, borderColor: BORDER }}>
      <Text style={{ fontSize: 10, color, fontWeight: "600", marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "700", color }}>{value}</Text>
    </View>
  );
}

function SkeletonRow() {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ height: 80, borderRadius: 14, backgroundColor: CARD, marginBottom: 10, opacity: anim }} />;
}

export default function AdminLogsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [logs, setLogs]               = useState<Log[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter]   = useState("all");
  // "all" par défaut — "today" comme défaut donnait une liste vide dès que
  // l'activité du jour était faible, ce qui se lit comme "les logs ne
  // marchent pas" plutôt que comme un filtre actif.
  const [dateFilter, setDateFilter]   = useState("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await adminApi.getLogs({ date: dateFilter });
      setLogs((res?.data || []) as Log[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    const matchesType   = typeFilter === "all" || log.type === typeFilter;
    const q             = searchQuery.toLowerCase();
    const matchesSearch = !q || log.action.toLowerCase().includes(q) || log.description.toLowerCase().includes(q) || log.user_name?.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const stats = {
    total:   logs.length,
    info:    logs.filter((l) => l.type === "info").length,
    success: logs.filter((l) => l.type === "success").length,
    warning: logs.filter((l) => l.type === "warning").length,
    error:   logs.filter((l) => l.type === "error").length,
  };

  const listHeader = (
    <View style={{ paddingTop: insets.top, paddingBottom: 16 }}>
        <AnimatedPressable
          onPress={() => safeBack(router)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 }}
        >
          <Ionicons name="chevron-back" size={18} color={ADMIN.accent} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: ADMIN.accent }}>Retour</Text>
        </AnimatedPressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: Colors.info }} />
          <Text style={{ fontSize: 22, fontWeight: "700", color: TEXT1, letterSpacing: -0.5 }}>Logs Système</Text>
        </View>
        <Text style={{ fontSize: 13, color: TEXT2, marginBottom: 16, paddingLeft: 14 }}>{filtered.length} événement(s)</Text>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: MUTED, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: BORDER, gap: 10, marginBottom: 12 }}>
          <Ionicons name="search-outline" size={18} color={TEXT2} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher…"
            placeholderTextColor={TEXT3}
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            style={{ flex: 1, fontSize: 14, color: TEXT1 }}
          />
          {searchQuery.length > 0 && (
            <AnimatedIconButton onPress={() => setSearchQuery("")} accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={16} color={TEXT2} />
            </AnimatedIconButton>
          )}
        </View>

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
          {[{ id: "all", label: "Tous" }, ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label }))].map((f) => {
            const active = typeFilter === f.id;
            return (
              <AnimatedPressable
                key={f.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setTypeFilter(f.id); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? ADMIN.accentBg : MUTED,
                  borderColor: active ? ADMIN.accent : BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? ADMIN.accent : TEXT2 }}>{f.label}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/* Date filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.id;
            return (
              <AnimatedPressable
                key={f.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setDateFilter(f.id); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? ADMIN.accentBg : MUTED,
                  borderColor: active ? ADMIN.accent : BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? ADMIN.accent : TEXT2 }}>{f.label}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        data={loading || loadError ? [] : filtered}
        keyExtractor={(log) => String(log.id)}
        renderItem={({ item }) => <LogRow log={item} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={9}
        ListHeaderComponent={
          <View>
            {listHeader}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              <StatChip label="Total"     value={stats.total}   color={TEXT1}              bg={CARD} />
              <StatChip label="Info"      value={stats.info}    color={Colors.info}        bg={ADMIN.infoBg} />
              <StatChip label="Succès"    value={stats.success} color={Colors.success}     bg={ADMIN.successBg} />
              <StatChip label="Attention" value={stats.warning} color={Colors.warning}     bg={ADMIN.warningBg} />
              <StatChip label="Erreurs"   value={stats.error}   color={Colors.destructive} bg={ADMIN.dangerBg} />
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
            </View>
          ) : loadError ? (
            <View style={{ alignItems: "center", paddingVertical: 60, gap: 12 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="cloud-offline-outline" size={32} color={TEXT3} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1 }}>Impossible de charger les logs</Text>
              <AnimatedPressable onPress={fetchLogs} style={{ paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: ADMIN.accentBg, borderWidth: 1, borderColor: ADMIN.accent }}>
                <Text style={{ color: ADMIN.accent, fontWeight: "700" }}>Réessayer</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="pulse-outline" size={32} color={TEXT3} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 6 }}>Aucun log trouvé</Text>
              <Text style={{ fontSize: 13, color: TEXT2 }}>Modifiez les filtres pour voir d'autres résultats.</Text>
            </View>
          )
        }
      />
    </View>
  );
}
