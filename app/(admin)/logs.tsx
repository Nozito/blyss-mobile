import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/lib/api";

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
  info: { icon: "information-circle-outline" as const, color: "#3B82F6", bg: "#EFF6FF", label: "Info" },
  success: { icon: "checkmark-circle-outline" as const, color: "#22C55E", bg: "#F0FDF4", label: "Succès" },
  warning: { icon: "warning-outline" as const, color: "#F59E0B", bg: "#FFFBEB", label: "Attention" },
  error: { icon: "close-circle-outline" as const, color: "#EF4444", bg: "#FEF2F2", label: "Erreur" },
};

const DATE_FILTERS = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois" },
  { id: "all", label: "Tout" },
];

export default function AdminLogsScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");

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
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const stats = {
    total: logs.length,
    info: logs.filter((l) => l.type === "info").length,
    success: logs.filter((l) => l.type === "success").length,
    warning: logs.filter((l) => l.type === "warning").length,
    error: logs.filter((l) => l.type === "error").length,
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={Colors.admin} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 80,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300).springify()} className="mb-6">
        <Text className="text-2xl font-bold text-foreground">Logs Système</Text>
        <Text className="text-sm text-muted-foreground mt-1">{filtered.length} événement(s)</Text>
      </Animated.View>

      {/* Stats row */}
      <Animated.View entering={FadeInDown.duration(300).delay(60).springify()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
          <StatChip label="Total" value={stats.total} color={Colors.foreground} bg={Colors.muted} />
          <StatChip label="Info" value={stats.info} color="#3B82F6" bg="#EFF6FF" />
          <StatChip label="Succès" value={stats.success} color="#22C55E" bg="#F0FDF4" />
          <StatChip label="Attention" value={stats.warning} color="#F59E0B" bg="#FFFBEB" />
          <StatChip label="Erreurs" value={stats.error} color="#EF4444" bg="#FEF2F2" />
        </ScrollView>
      </Animated.View>

      {/* Filters */}
      <Animated.View entering={FadeInDown.duration(300).delay(100).springify()} className="mb-4 gap-3">
        <View className="flex-row items-center bg-card rounded-xl px-4 h-11 border border-border gap-3">
          <Ionicons name="search-outline" size={18} color={Colors.mutedForeground} />
          <TextInput
            className="flex-1 text-foreground text-sm"
            placeholder="Rechercher..."
            placeholderTextColor={Colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ id: "all", label: "Tous" }, ...Object.entries(TYPE_CONFIG).map(([id, c]) => ({ id, label: c.label }))].map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setTypeFilter(f.id)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: typeFilter === f.id ? Colors.admin : Colors.muted }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: typeFilter === f.id ? Colors.white : Colors.mutedForeground }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Date filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DATE_FILTERS.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setDateFilter(f.id)}
              className="px-4 py-2 rounded-full border"
              style={{
                backgroundColor: dateFilter === f.id ? `${Colors.admin}15` : Colors.card,
                borderColor: dateFilter === f.id ? Colors.admin : Colors.border,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: dateFilter === f.id ? Colors.admin : Colors.mutedForeground }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Log items */}
      <View className="gap-3">
        {filtered.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(140).springify()} className="items-center py-12">
            <Ionicons name="pulse-outline" size={48} color={Colors.border} />
            <Text className="text-muted-foreground mt-3">Aucun log trouvé</Text>
          </Animated.View>
        ) : (
          filtered.map((log, idx) => {
            const cfg = TYPE_CONFIG[log.type];
            return (
              <Animated.View
                key={log.id}
                entering={FadeInDown.duration(250).delay(140 + idx * 30).springify()}
                className="bg-card rounded-2xl p-4 border border-border"
                style={{ shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
              >
                <View className="flex-row items-start gap-3">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start justify-between mb-1">
                      <Text className="text-sm font-semibold text-foreground flex-1 mr-2">{log.action}</Text>
                      <View className="px-2 py-0.5 rounded-lg" style={{ backgroundColor: cfg.bg }}>
                        <Text className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text className="text-xs text-muted-foreground leading-relaxed mb-2">{log.description}</Text>
                    <View className="flex-row items-center gap-3 flex-wrap">
                      {log.user_name && (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="person-outline" size={11} color={Colors.mutedForeground} />
                          <Text className="text-xs text-muted-foreground">{log.user_name}</Text>
                        </View>
                      )}
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="time-outline" size={11} color={Colors.mutedForeground} />
                        <Text className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("fr-FR")}
                        </Text>
                      </View>
                      {log.ip_address && (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="pulse-outline" size={11} color={Colors.mutedForeground} />
                          <Text className="text-xs text-muted-foreground">{log.ip_address}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function StatChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View className="rounded-xl px-4 py-3 border border-border" style={{ backgroundColor: bg }}>
      <Text className="text-xs mb-0.5" style={{ color }}>{label}</Text>
      <Text className="text-2xl font-black" style={{ color }}>{value}</Text>
    </View>
  );
}
