import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/lib/api";

const A_BG     = "#F4F4F5";
const A_BORDER = "#E4E4E7";

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
  info:    { icon: "information-circle-outline" as const, color: Colors.info,        bg: `${Colors.info}15`,        label: "Info" },
  success: { icon: "checkmark-circle-outline"   as const, color: Colors.success,     bg: `${Colors.success}15`,     label: "Succès" },
  warning: { icon: "warning-outline"            as const, color: Colors.warning,     bg: `${Colors.warning}15`,     label: "Attention" },
  error:   { icon: "close-circle-outline"       as const, color: Colors.destructive, bg: `${Colors.destructive}12`, label: "Erreur" },
};

const DATE_FILTERS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week",  label: "Cette semaine" },
  { id: "month", label: "Ce mois" },
  { id: "all",   label: "Tout" },
];

function StatChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: bg, borderWidth: 1, borderColor: A_BORDER }}>
      <Text style={{ fontSize: 10, color, fontWeight: "600", marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "900", color }}>{value}</Text>
    </View>
  );
}

function SkeletonRow() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ height: 80, borderRadius: 14, backgroundColor: A_BORDER, marginBottom: 10, opacity: anim }} />;
}

export default function AdminLogsScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs]               = useState<Log[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [dateFilter, setDateFilter]   = useState("today");

  useEffect(() => {
    fetchLogs();
  }, [dateFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getLogs?.({ date: dateFilter });
      setLogs((res?.data || []) as Log[]);
    } catch {
      // display empty state
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: A_BG }}>
      {/* Header card */}
      <View style={{ backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: A_BORDER, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: Colors.info }} />
          <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>Logs Système</Text>
        </View>
        <Text style={{ fontSize: 13, color: Colors.mutedForeground, marginBottom: 16, paddingLeft: 14 }}>{filtered.length} événement(s)</Text>

        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: A_BG, borderRadius: 12, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: A_BORDER, gap: 10, marginBottom: 12 }}>
          <Ionicons name="search-outline" size={18} color={Colors.mutedForeground} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher…"
            placeholderTextColor={Colors.mutedForeground}
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            style={{ flex: 1, fontSize: 14, color: Colors.foreground }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={Colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
          {[{ id: "all", label: "Tous" }, ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label }))].map((f) => {
            const active = typeFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setTypeFilter(f.id); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? Colors.admin : A_BG,
                  borderColor: active ? Colors.admin : A_BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? Colors.white : Colors.mutedForeground }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Date filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setDateFilter(f.id); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? `${Colors.admin}15` : A_BG,
                  borderColor: active ? Colors.admin : A_BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? Colors.admin : Colors.mutedForeground }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
          <StatChip label="Total"     value={stats.total}   color={Colors.foreground}  bg={Colors.card} />
          <StatChip label="Info"      value={stats.info}    color={Colors.info}        bg={`${Colors.info}15`} />
          <StatChip label="Succès"    value={stats.success} color={Colors.success}     bg={`${Colors.success}15`} />
          <StatChip label="Attention" value={stats.warning} color={Colors.warning}     bg={`${Colors.warning}15`} />
          <StatChip label="Erreurs"   value={stats.error}   color={Colors.destructive} bg={`${Colors.destructive}12`} />
        </ScrollView>

        {/* Log items */}
        {loading ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: A_BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="pulse-outline" size={32} color={A_BORDER} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground, marginBottom: 6 }}>Aucun log trouvé</Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>Modifiez les filtres pour voir d'autres résultats.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((log) => {
              const cfg = TYPE_CONFIG[log.type];
              return (
                <View
                  key={log.id}
                  style={{
                    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: A_BORDER,
                    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: cfg.bg, flexShrink: 0 }}>
                      <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.foreground, flex: 1, marginRight: 10 }} numberOfLines={2}>
                          {log.action}
                        </Text>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: cfg.bg }}>
                          <Text style={{ fontSize: 10, fontWeight: "800", color: cfg.color }}>{cfg.label}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: Colors.mutedForeground, lineHeight: 18, marginBottom: 8 }} numberOfLines={2}>
                        {log.description}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                        {log.user_name && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="person-outline" size={11} color={Colors.mutedForeground} />
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{log.user_name}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="time-outline" size={11} color={Colors.mutedForeground} />
                          <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                            {new Date(log.created_at).toLocaleString("fr-FR")}
                          </Text>
                        </View>
                        {log.ip_address && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="globe-outline" size={11} color={Colors.mutedForeground} />
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>{log.ip_address}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
