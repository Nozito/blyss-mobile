import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { notificationsApi } from "@/lib/api";
import { Colors } from "@/constants/colors";

type Tab = "activity" | "preferences";

type Notification = {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const NOTIF_CFG: Record<string, { icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap; color: string; bg: string }> = {
  new_booking:       { icon: "checkmark-circle-outline", color: "#34C759", bg: "rgba(52,199,89,0.12)"    },
  booking_confirmed: { icon: "checkmark-circle-outline", color: "#007AFF", bg: "rgba(0,122,255,0.12)"    },
  booking_cancelled: { icon: "close-circle-outline",     color: "#FF3B30", bg: "rgba(255,59,48,0.12)"    },
  booking_reminder:  { icon: "time-outline",             color: "#FF9500", bg: "rgba(255,149,0,0.12)"    },
  message_received:  { icon: "chatbubble-outline",       color: "#5856D6", bg: "rgba(88,86,214,0.12)"    },
  payment_received:  { icon: "card-outline",             color: "#34C759", bg: "rgba(52,199,89,0.12)"    },
  promotional:       { icon: "gift-outline",             color: "#FF2D55", bg: "rgba(255,45,85,0.12)"    },
  late_alert:        { icon: "warning-outline",          color: "#FF9500", bg: "rgba(255,149,0,0.12)"    },
  email_summary:     { icon: "mail-outline",             color: "#8E8E93", bg: "rgba(142,142,147,0.12)"  },
  default:           { icon: "notifications-outline",    color: "#8E8E93", bg: "rgba(142,142,147,0.12)"  },
};

const PREF_ROWS = [
  {
    section: "Rendez-vous",
    items: [
      { key: "reminders",  title: "Rappels",          desc: "Rappels avant vos rendez-vous",    icon: "time-outline",             color: "#FF9500", bg: "rgba(255,149,0,0.12)"   },
      { key: "changes",    title: "Modifications",    desc: "Annulations et modifications RDV", icon: "calendar-outline",          color: "#007AFF", bg: "rgba(0,122,255,0.12)"   },
    ],
  },
  {
    section: "Communications",
    items: [
      { key: "messages",   title: "Messages",         desc: "Nouveaux messages reçus",          icon: "chatbubble-outline",        color: "#5856D6", bg: "rgba(88,86,214,0.12)"   },
      { key: "late",       title: "Alertes retard",   desc: "En cas de retard d'une cliente",   icon: "warning-outline",           color: "#FF3B30", bg: "rgba(255,59,48,0.12)"   },
      { key: "offers",     title: "Offres & promo",   desc: "Promotions et nouveautés Blyss",   icon: "gift-outline",              color: "#FF2D55", bg: "rgba(255,45,85,0.12)"   },
      { key: "email_summary", title: "Résumé email", desc: "Récap hebdomadaire par email",     icon: "mail-outline",              color: "#8E8E93", bg: "rgba(142,142,147,0.12)"  },
    ],
  },
] as const;

type PrefKey = "reminders" | "changes" | "messages" | "late" | "offers" | "email_summary";

function formatRelTime(dateString: string) {
  const date = new Date(dateString);
  const diffMs    = Date.now() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays  = Math.floor(diffMs / 86_400_000);
  if (diffMins  < 1)   return "maintenant";
  if (diffMins  < 60)  return `${diffMins} min`;
  if (diffHours < 24)  return `${diffHours}h`;
  if (diffDays  === 1) return "hier";
  if (diffDays  < 7)   return `${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function groupByDay(notifications: Notification[]) {
  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart      = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
  const groups = [
    { title: "Aujourd'hui",   data: [] as Notification[] },
    { title: "Hier",          data: [] as Notification[] },
    { title: "Cette semaine", data: [] as Notification[] },
    { title: "Plus ancien",   data: [] as Notification[] },
  ];
  for (const n of notifications) {
    const d = new Date(n.created_at); d.setHours(0, 0, 0, 0);
    if      (d >= todayStart)     groups[0].data.push(n);
    else if (d >= yesterdayStart) groups[1].data.push(n);
    else if (d >= weekStart)      groups[2].data.push(n);
    else                          groups[3].data.push(n);
  }
  return groups.filter((g) => g.data.length > 0);
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("activity");
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    reminders: true, changes: true, messages: true, late: true, offers: true, email_summary: false,
  });
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.getAll(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = (data?.data as Notification[] | undefined) ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const grouped = useMemo(() => groupByDay(notifications), [notifications]);

  const markAllRead = () => {
    notifications.filter((n) => !n.is_read).forEach((n) => markReadMutation.mutate(String(n.id)));
  };

  const togglePref = async (key: PrefKey) => {
    if (savingKey) return;
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    try {
      await notificationsApi.updateSettings({ [key]: next } as Record<string, boolean>);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      {/* ── HEADER ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            backgroundColor: Colors.muted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.foreground }}>
            Notifications
          </Text>
          <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 1 }}>
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
              : "Tout est lu"}
          </Text>
        </View>
        {unreadCount > 0 && tab === "activity" && (
          <Pressable
            onPress={markAllRead}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 36,
              paddingHorizontal: 12,
              borderRadius: 16,
              backgroundColor: `${Colors.primary}1A`,
            }}
          >
            <Ionicons name="checkmark-done-outline" size={14} color={Colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.primary }}>
              Tout lire
            </Text>
          </Pressable>
        )}
      </View>

      {/* ── TABS ── */}
      <View
        style={{
          flexDirection: "row",
          gap: 4,
          marginHorizontal: 20,
          padding: 4,
          borderRadius: 16,
          backgroundColor: Colors.muted,
          marginBottom: 20,
        }}
      >
        {(["activity", "preferences"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: tab === t ? Colors.card : "transparent",
              shadowColor: tab === t ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: tab === t ? 0.06 : 0,
              shadowRadius: 4,
              elevation: tab === t ? 1 : 0,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: tab === t ? Colors.foreground : Colors.mutedForeground,
              }}
            >
              {t === "activity" ? "Activité" : "Préférences"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── ACTIVITY TAB ── */}
      {tab === "activity" && (
        isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : grouped.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: Colors.muted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="notifications-outline" size={28} color={Colors.mutedForeground} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground, textAlign: "center" }}>
              Aucune notification
            </Text>
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", marginTop: 4 }}>
              Vous êtes à jour !
            </Text>
          </View>
        ) : (
          <SectionList
            sections={grouped}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section }) => (
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 8,
                  paddingTop: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.mutedForeground,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {section.title}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const cfg = NOTIF_CFG[item.type] ?? NOTIF_CFG.default;
              return (
                <Pressable
                  onPress={() => !item.is_read && markReadMutation.mutate(String(item.id))}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                    backgroundColor: item.is_read ? "transparent" : `${Colors.primary}08`,
                    borderBottomWidth: 1,
                    borderBottomColor: `${Colors.border}80`,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: cfg.bg,
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: Colors.foreground, lineHeight: 20 }}>
                      {item.message}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 3 }}>
                      {formatRelTime(item.created_at)}
                    </Text>
                  </View>
                  {!item.is_read && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: Colors.primary,
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        )
      )}

      {/* ── PREFERENCES TAB ── */}
      {tab === "preferences" && (
        <SectionList
          sections={PREF_ROWS.map((s) => ({ title: s.section, data: [...s.items] }))}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100, gap: 8 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: Colors.mutedForeground,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              {section.title}
            </Text>
          )}
          renderSectionFooter={() => (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.card,
                overflow: "hidden",
              }}
            />
          )}
          renderItem={({ item, index, section }) => {
            const isLast = index === section.data.length - 1;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: Colors.card,
                  borderRadius: 0,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: `${Colors.border}80`,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginTop: index === 0 ? 0 : -1,
                  borderTopLeftRadius: index === 0 ? 16 : 0,
                  borderTopRightRadius: index === 0 ? 16 : 0,
                  borderBottomLeftRadius: isLast ? 16 : 0,
                  borderBottomRightRadius: isLast ? 16 : 0,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: item.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2, lineHeight: 16 }}>
                    {item.desc}
                  </Text>
                </View>
                <Switch
                  value={prefs[item.key as PrefKey] ?? true}
                  onValueChange={() => togglePref(item.key as PrefKey)}
                  disabled={savingKey === item.key}
                  trackColor={{ true: Colors.primary, false: `${Colors.mutedForeground}40` }}
                  thumbColor="#fff"
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
