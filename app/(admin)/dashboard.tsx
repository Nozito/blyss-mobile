import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  "http://localhost:3001";

interface Stats {
  totalUsers: number;
  totalPros: number;
  totalClients: number;
  totalBookings: number;
  todayBookings: number;
  totalRevenue: number;
  monthRevenue: number;
  activeUsers: number;
  bookingsByStatus: Record<string, number>;
  changes: {
    clients: number | null;
    pros: number | null;
    users: number | null;
    revenue: number | null;
    bookings: number | null;
  };
}

interface ActivityItem {
  type: "booking" | "user" | "payment";
  title: string;
  description: string;
  time: string;
}

interface HealthStatus {
  status: "ok" | "degraded";
  db: "ok" | "error";
}

function ChangeBadge({ val }: { val: number | null }) {
  if (val === null) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 10,
          backgroundColor: "#F3F4F6",
          borderWidth: 1,
          borderColor: "#E5E7EB",
        }}
      >
        <Ionicons name="remove" size={10} color="#6B7280" />
        <Text style={{ fontSize: 10, fontWeight: "700", color: "#6B7280" }}>
          Nouveau
        </Text>
      </View>
    );
  }
  const positive = val >= 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: positive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
        borderWidth: 1,
        borderColor: positive ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
      }}
    >
      <Ionicons
        name={positive ? "trending-up" : "trending-down"}
        size={12}
        color={positive ? "#16A34A" : "#DC2626"}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: positive ? "#16A34A" : "#DC2626",
        }}
      >
        {val > 0 ? "+" : ""}
        {val}%
      </Text>
    </View>
  );
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/admin/dashboard/stats`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(`HTTP ${res.status} — ${body?.message ?? "Erreur"}`);
      }
      return res.json() as Promise<{
        success: boolean;
        stats: Stats;
        recentActivity: ActivityItem[];
      }>;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ["admin-health"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("health error");
      return res.json() as Promise<HealthStatus>;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const stats: Stats | null = data?.stats ?? null;
  const changes = stats?.changes ?? {
    clients: null,
    pros: null,
    users: null,
    revenue: null,
    bookings: null,
  };
  const recentActivity: ActivityItem[] = data?.recentActivity ?? [];
  const bookingsByStatus: Record<string, number> =
    stats?.bookingsByStatus ?? {};

  const apiOk = healthData?.status === "ok";
  const dbOk = healthData?.db === "ok";
  const wsOk = apiOk;

  const statCards = [
    {
      title: "Clients",
      value: stats?.totalClients ?? 0,
      changeVal: changes.clients,
      icon: "person-add-outline" as const,
      gradientColors: ["#8B5CF6", "#7C3AED"] as [string, string],
      bgColor: "rgba(139,92,246,0.1)",
    },
    {
      title: "Professionnels",
      value: stats?.totalPros ?? 0,
      changeVal: changes.pros,
      icon: "briefcase-outline" as const,
      gradientColors: ["#F97316", "#D97706"] as [string, string],
      bgColor: "rgba(249,115,22,0.1)",
    },
    {
      title: "Utilisateurs",
      value: stats?.totalUsers ?? 0,
      changeVal: changes.users,
      icon: "people-outline" as const,
      gradientColors: ["#3B82F6", "#4F46E5"] as [string, string],
      bgColor: "rgba(59,130,246,0.1)",
    },
    {
      title: "CA du mois",
      value: `${(stats?.monthRevenue ?? 0).toLocaleString("fr-FR")}€`,
      changeVal: changes.revenue,
      icon: "trending-up-outline" as const,
      gradientColors: ["#22C55E", "#10B981"] as [string, string],
      bgColor: "rgba(34,197,94,0.1)",
    },
  ];

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={{ marginBottom: 24 }}
      >
        <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>
          Administration
        </Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: Colors.foreground,
            letterSpacing: -0.5,
          }}
        >
          Dashboard
        </Text>
        <Text style={{ fontSize: 14, color: Colors.mutedForeground, marginTop: 2 }}>
          Bonjour, {user?.first_name} 👋
        </Text>
      </View>

      {isLoading ? (
        <View
          style={{ alignItems: "center", justifyContent: "center", height: 300 }}
        >
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text
            style={{
              fontSize: 14,
              color: Colors.mutedForeground,
              marginTop: 12,
            }}
          >
            Chargement du dashboard...
          </Text>
        </View>
      ) : error ? (
        <View
          style={{ alignItems: "center", justifyContent: "center", padding: 32 }}
        >
          <Ionicons name="close-circle-outline" size={40} color={Colors.destructive} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: Colors.foreground,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Impossible de charger les données
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: Colors.mutedForeground,
              textAlign: "center",
              marginTop: 8,
              fontFamily: "monospace",
              backgroundColor: Colors.muted,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            {(error as Error).message}
          </Text>
        </View>
      ) : (
        <>
          {/* Stats Grid */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {statCards.map((card, index) => (
              <View
                key={index}
                style={{
                  width: "47%",
                  borderRadius: 24,
                  backgroundColor: Colors.card,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  overflow: "hidden",
                  padding: 20,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: card.bgColor,
                  }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <LinearGradient
                    colors={card.gradientColors}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={card.icon} size={22} color="#fff" />
                  </LinearGradient>
                  <ChangeBadge val={card.changeVal} />
                </View>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: Colors.foreground,
                    letterSpacing: -1,
                    marginBottom: 4,
                  }}
                >
                  {card.value}
                </Text>
                <Text
                  style={{ fontSize: 13, color: Colors.mutedForeground, fontWeight: "500" }}
                >
                  {card.title}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: `${Colors.mutedForeground}99`,
                    marginTop: 2,
                  }}
                >
                  vs mois précédent
                </Text>
              </View>
            ))}
          </View>

          {/* Recent Activity */}
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${Colors.primary}1A`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="pulse-outline"
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: Colors.foreground,
                  }}
                >
                  Activité Récente
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: `${Colors.muted}80`,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ fontSize: 11, color: Colors.mutedForeground, fontWeight: "500" }}
                >
                  Dernières 24h
                </Text>
              </View>
            </View>

            {recentActivity.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    backgroundColor: Colors.muted,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={32}
                    color={`${Colors.mutedForeground}4D`}
                  />
                </View>
                <Text style={{ color: Colors.mutedForeground, textAlign: "center" }}>
                  Aucune activité récente
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {recentActivity.slice(0, 8).map((activity, index) => {
                  const actBg =
                    activity.type === "booking"
                      ? "rgba(139,92,246,0.1)"
                      : activity.type === "user"
                      ? "rgba(59,130,246,0.1)"
                      : "rgba(34,197,94,0.1)";
                  const actColor =
                    activity.type === "booking"
                      ? "#7C3AED"
                      : activity.type === "user"
                      ? "#2563EB"
                      : "#16A34A";
                  const actIcon =
                    activity.type === "booking"
                      ? ("calendar-outline" as const)
                      : activity.type === "user"
                      ? ("person-add-outline" as const)
                      : ("cash-outline" as const);
                  return (
                    <View
                      key={index}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: `${Colors.muted}80`,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: actBg,
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Ionicons name={actIcon} size={20} color={actColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: "600",
                            color: Colors.foreground,
                            fontSize: 14,
                          }}
                          numberOfLines={1}
                        >
                          {activity.title}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: Colors.mutedForeground,
                          }}
                          numberOfLines={1}
                        >
                          {activity.description}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.mutedForeground,
                          fontWeight: "500",
                          flexShrink: 0,
                        }}
                      >
                        {activity.time}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Stats du jour */}
          <View
            style={{ marginBottom: 16 }}
          >
            <LinearGradient
              colors={[
                `${Colors.primary}1A`,
                "rgba(139,92,246,0.1)",
                "transparent",
              ]}
              style={{
                borderRadius: 24,
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 20,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${Colors.primary}33`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: Colors.foreground,
                  }}
                >
                  Statistiques
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {[
                  {
                    label: "RDV aujourd'hui",
                    sub:
                      changes.bookings !== null
                        ? `${changes.bookings >= 0 ? "+" : ""}${changes.bookings}% vs hier`
                        : null,
                    subColor:
                      (changes.bookings ?? 0) >= 0 ? "#16A34A" : "#DC2626",
                    value: String(stats?.todayBookings ?? 0),
                    valueSize: 28,
                  },
                  {
                    label: "Revenus totaux",
                    sub: "Tous temps",
                    subColor: `${Colors.mutedForeground}99`,
                    value: `${(stats?.totalRevenue ?? 0).toLocaleString("fr-FR")}€`,
                    valueSize: 20,
                    valueColor: "#16A34A",
                  },
                  {
                    label: "Utilisateurs actifs",
                    sub: "7 derniers jours",
                    subColor: `${Colors.mutedForeground}99`,
                    value: String(stats?.activeUsers ?? 0),
                    valueSize: 28,
                  },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: `${Colors.card}80`,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 14,
                          color: Colors.mutedForeground,
                          fontWeight: "500",
                        }}
                      >
                        {row.label}
                      </Text>
                      {row.sub && (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: row.subColor,
                            marginTop: 2,
                          }}
                        >
                          {row.sub}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: row.valueSize,
                        fontWeight: "900",
                        color: row.valueColor ?? Colors.foreground,
                        letterSpacing: -0.5,
                      }}
                    >
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          {/* Réservations par statut */}
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "rgba(139,92,246,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#7C3AED"
                />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: Colors.foreground,
                }}
              >
                Réservations
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {[
                {
                  key: "pending",
                  label: "En attente",
                  color: "#D97706",
                  bg: "rgba(245,158,11,0.1)",
                },
                {
                  key: "confirmed",
                  label: "Confirmées",
                  color: "#2563EB",
                  bg: "rgba(59,130,246,0.1)",
                },
                {
                  key: "completed",
                  label: "Terminées",
                  color: "#16A34A",
                  bg: "rgba(34,197,94,0.1)",
                },
                {
                  key: "cancelled",
                  label: "Annulées",
                  color: "#DC2626",
                  bg: "rgba(239,68,68,0.1)",
                },
              ].map(({ key, label, color, bg }) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: bg,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "500", color }}>
                    {label}
                  </Text>
                  <Text
                    style={{ fontSize: 18, fontWeight: "900", color }}
                  >
                    {bookingsByStatus[key] ?? 0}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Statut Système */}
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: apiOk
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(239,68,68,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={apiOk ? "checkmark-circle-outline" : "close-circle-outline"}
                  size={20}
                  color={apiOk ? "#16A34A" : "#DC2626"}
                />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: Colors.foreground,
                }}
              >
                Statut Système
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {[
                { label: "API", ok: apiOk },
                { label: "Base de données", ok: dbOk },
                { label: "WebSocket", ok: wsOk },
              ].map(({ label, ok }) => (
                <View
                  key={label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: `${Colors.muted}80`,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="wifi-outline"
                      size={14}
                      color={ok ? "#16A34A" : "#DC2626"}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        color: Colors.mutedForeground,
                        fontWeight: "500",
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: ok === undefined ? "#9CA3AF" : ok ? "#22C55E" : "#EF4444",
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: ok === undefined ? "#9CA3AF" : ok ? "#16A34A" : "#DC2626",
                      }}
                    >
                      {ok === undefined ? "…" : ok ? "Opérationnel" : "Dégradé"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        {/* Quick access to new admin screens */}
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 }}>
            Accès rapide
          </Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {[
              { icon: "card-outline" as const, label: "Paiements", route: "/(admin)/payments" },
              { icon: "pulse-outline" as const, label: "Logs", route: "/(admin)/logs" },
              { icon: "notifications-outline" as const, label: "Notifications", route: "/(admin)/notifications" },
            ].map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={{
                  flex: 1,
                  minWidth: "28%",
                  backgroundColor: Colors.card,
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${Colors.admin}15`, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.icon} size={20} color={Colors.admin} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.foreground, textAlign: "center" }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        </>
      )}
    </ScrollView>
  );
}
