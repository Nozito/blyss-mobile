import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl, Platform, Animated, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

interface Stats {
  totalUsers: number; totalPros: number; totalClients: number;
  totalBookings: number; todayBookings: number;
  totalRevenue: number; monthRevenue: number; activeUsers: number;
  bookingsByStatus: Record<string, number>;
  changes: { clients: number | null; pros: number | null; revenue: number | null; bookings: number | null };
}
interface ActivityItem { type: string; title: string; description: string; time: string }
interface HealthStatus { status: "ok" | "degraded"; db: "ok" | "error" }

function n(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
}

function PulseDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.7, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, transform: [{ scale }], opacity }} />
    </View>
  );
}

const QUICK_ACTIONS = [
  { icon: "people-outline"    as const, symbol: "person.2" as const, label: "Utilisateurs", route: "/(admin)/users" },
  { icon: "calendar-outline"  as const, symbol: "calendar"  as const, label: "Réservations", route: "/(admin)/bookings" },
  { icon: "pricetag-outline"  as const, symbol: "tag"        as const, label: "Coupons",      route: "/(admin)/coupons" },
  { icon: "pulse-outline"     as const, symbol: "waveform"   as const, label: "Logs",         route: "/(admin)/logs" },
];

const ACTIVITY_CFG: Record<string, { color: string; label: string; bg: string }> = {
  booking: { color: Colors.pro,     label: "RDV",        bg: `${Colors.pro}18` },
  user:    { color: Colors.info,    label: "Inscription", bg: `${Colors.info}18` },
  payment: { color: Colors.success, label: "Paiement",    bg: `${Colors.success}18` },
};

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(
      () => setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })),
      30_000
    );
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn:  () => adminApi.getDashboardStats() as Promise<{ success: boolean; stats: Stats; recentActivity: ActivityItem[]; revenueHistory?: number[] }>,
    staleTime: 5 * 60_000, retry: false,
  });
  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn:  () => adminApi.getHealth() as unknown as Promise<HealthStatus>,
    staleTime: 30_000, refetchInterval: 60_000, retry: false,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const stats     = data?.stats ?? null;
  const activity  = data?.recentActivity ?? [];
  const sparkData = data?.revenueHistory ?? [];
  const byStatus  = stats?.bookingsByStatus ?? {};
  const apiOk     = healthData?.status === "ok";

  const maxSpark  = useMemo(() => Math.max(1, ...sparkData), [sparkData]);
  const totalSparkRevenue = useMemo(() => sparkData.reduce((s, v) => s + v, 0), [sparkData]);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
        <View style={{ padding: 20, gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ height: i === 1 ? 160 : i === 2 ? 80 : 64, borderRadius: 16, backgroundColor: `${Colors.muted}99` }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
    >
      {/* ── HERO ── */}
      <View>
        <LinearGradient
          colors={["#EA6000", "#F97316", "#FB923C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24, padding: 22,
            shadowColor: "#F97316", shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 20, elevation: 8, overflow: "hidden",
          }}
        >
          {/* Décors */}
          <View style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.10)" }} />
          <View style={{ position: "absolute", top: -16, right: -16, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <View style={{ position: "absolute", bottom: -30, left: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.06)" }} />

          <View style={{ gap: 18 }}>
            {/* Badges */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Admin Panel
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)" }}>
                <PulseDot color={apiOk ? "#A7F3D0" : "#FCA5A5"} />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                  {apiOk ? "Systèmes OK" : "Dégradé"}
                </Text>
              </View>
            </View>

            {/* Greeting */}
            <View>
              <Text style={{ fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: -0.5 }}>
                Bonjour {user?.first_name} 👋
              </Text>
              <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginTop: 4 }}>
                {today} · {clock}
              </Text>
            </View>

            {/* Divider + stats */}
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.18)" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[
                { label: "Utilisateurs",   value: stats?.totalUsers   ?? "—" },
                { label: "RDV aujourd'hui", value: stats?.todayBookings ?? "—" },
                { label: "CA mois",         value: `${(stats?.monthRevenue ?? 0).toLocaleString("fr-FR")}€` },
              ].map(({ label, value }) => (
                <View key={label} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>{value}</Text>
                  <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: "600", marginTop: 2 }}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── QUICK ACTIONS ── */}
      <View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {QUICK_ACTIONS.map(({ icon, symbol, label, route }) => (
            <Pressable
              key={route}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push(route as any); }}
              style={{
                flex: 1, borderRadius: 12, padding: 16,
                backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
                alignItems: "center", gap: 10,
                shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${Colors.admin}12`, alignItems: "center", justifyContent: "center" }}>
                {Platform.OS === "ios"
                  ? <SymbolView name={symbol} size={20} tintColor={Colors.admin} />
                  : <Ionicons name={icon} size={20} color={Colors.admin} />}
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.foreground }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── KPI GRID 2×2 ── */}
      <View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          {/* Clients */}
          {[
            { label: "Clients", sub: "Total inscrits",   color: Colors.primary, icon: "person-outline" as const,    iconBg: "#FFE8F3", value: stats?.totalClients  ?? 0 },
            { label: "Pros",    sub: "Pros actifs",       color: Colors.admin,   icon: "briefcase-outline" as const, iconBg: `${Colors.admin}1A`,   value: stats?.totalPros    ?? 0 },
          ].map(({ label, sub, color, icon, iconBg, value }) => (
            <View key={label} style={{ flex: 1, borderRadius: 12, padding: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
              <View style={{ position: "absolute", top: -16, right: -16, width: 64, height: 64, borderRadius: 32, backgroundColor: `${color}0D` }} />
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                  <Text style={{ fontSize: 9, color: Colors.mutedForeground, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 32, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>{n(value).toLocaleString("fr-FR")}</Text>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4, fontWeight: "500" }}>{sub}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { label: "RDV",    sub: "Aujourd'hui",      color: Colors.info,    icon: "calendar-outline" as const, iconBg: `${Colors.info}1A`,    value: stats?.todayBookings ?? 0 },
            { label: "CA",     sub: "Chiffre du mois",  color: Colors.success, icon: "cash-outline" as const,     iconBg: `${Colors.success}1A`, value: stats?.monthRevenue  ?? 0 },
          ].map(({ label, sub, color, icon, iconBg, value }) => (
            <View key={label} style={{ flex: 1, borderRadius: 12, padding: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
              <View style={{ position: "absolute", top: -16, right: -16, width: 64, height: 64, borderRadius: 32, backgroundColor: `${color}0D` }} />
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                  <Text style={{ fontSize: 9, color: Colors.mutedForeground, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
                </View>
                <View>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                    <Text style={{ fontSize: 32, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.5 }}>{n(value).toLocaleString("fr-FR")}</Text>
                    {label === "CA" && <Text style={{ fontSize: 20, fontWeight: "900", color }}> €</Text>}
                  </View>
                  <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginTop: 4, fontWeight: "500" }}>{sub}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── REVENUE CHART ── */}
      {sparkData.length > 1 && (
        <View>
          <View style={{ borderRadius: 12, padding: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 4, height: 20, backgroundColor: Colors.admin, borderRadius: 2 }} />
                <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground }}>Revenus — 30 jours</Text>
              </View>
              {totalSparkRevenue > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="cash-outline" size={14} color={Colors.admin} />
                  <Text style={{ fontSize: 12, fontWeight: "900", color: Colors.admin }}>
                    {totalSparkRevenue.toLocaleString("fr-FR")}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 120, paddingTop: 8 }}>
              {sparkData.slice(-14).map((v, i, arr) => {
                const isMax = v === maxSpark && v > 0;
                const barH  = Math.max((v / maxSpark) * 120, 8);
                return (
                  <View key={i} style={{ flex: 1, alignItems: "center" }}>
                    {isMax ? (
                      <LinearGradient
                        colors={[Colors.admin, `${Colors.admin}B3`]}
                        style={{ width: "100%", height: barH, borderRadius: 6, shadowColor: Colors.admin, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 }}
                      />
                    ) : (
                      <View style={{ width: "100%", height: barH, borderRadius: 6, backgroundColor: Colors.muted }} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* ── BOOKINGS BY STATUS ── */}
      {Object.keys(byStatus).length > 0 && (
        <View>
          <View style={{ borderRadius: 12, padding: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 4, height: 20, backgroundColor: Colors.admin, borderRadius: 2 }} />
                <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground }}>Réservations par statut</Text>
              </View>
              <Ionicons name="calendar" size={16} color={Colors.admin} />
            </View>
            <View style={{ gap: 14 }}>
              {[
                { key: "pending",   label: "En attente", color: Colors.warning },
                { key: "confirmed", label: "Confirmées",  color: Colors.info },
                { key: "completed", label: "Terminées",   color: Colors.success },
                { key: "cancelled", label: "Annulées",    color: Colors.destructive },
              ].map(({ key, label, color }, i) => {
                const count = byStatus[key] ?? 0;
                const total = Object.values(byStatus).reduce((s: number, v) => s + Number(v), 0);
                const pct   = total > 0 ? (count / total) * 100 : 0;
                return (
                  <View key={key}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: `${color}1A`, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 10, fontWeight: "900", color }}>{i + 1}</Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>{label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "900", color }}>{count}</Text>
                    </View>
                    <View style={{ height: 10, backgroundColor: Colors.muted, borderRadius: 5, overflow: "hidden" }}>
                      <LinearGradient
                        colors={[color, `${color}CC`]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 5 }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* ── ACTIVITÉ RÉCENTE ── */}
      {activity.length > 0 && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingHorizontal: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 4, height: 20, backgroundColor: Colors.admin, borderRadius: 2 }} />
              <Text style={{ fontSize: 14, fontWeight: "900", color: Colors.foreground, letterSpacing: -0.2 }}>Activité récente</Text>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {activity.slice(0, 5).map((item, i) => {
              const cfg = ACTIVITY_CFG[item.type] ?? ACTIVITY_CFG.booking;
              const initLetter = item.title[0]?.toUpperCase() ?? "?";
              return (
                <View
                  key={i}
                  style={{ borderRadius: 12, padding: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: cfg.color, alignItems: "center", justifyContent: "center", shadowColor: cfg.color, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 }}>
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>{initLetter}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontWeight: "700", fontSize: 14, color: Colors.foreground, flex: 1 }} numberOfLines={1}>{item.title}</Text>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: cfg.bg }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: cfg.color }}>{cfg.label}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 8, fontWeight: "500" }} numberOfLines={1}>{item.description}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="time-outline" size={12} color={Colors.mutedForeground} />
                        <Text style={{ fontSize: 11, color: Colors.mutedForeground, fontWeight: "600" }}>{item.time}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
