import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "@/contexts/NotificationContext";
import { notificationsApi, type ClientNotificationSettings } from "@/lib/api";
import { Shadows } from "@/constants/shadows";
import { Colors } from "@/constants/colors";

type Tab = "activity" | "preferences";
type PrefKey = keyof ClientNotificationSettings;

const NOTIF_CFG: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; bg: string }> = {
  new_booking:       { icon: "checkmark-circle-outline", color: "#34C759", bg: "rgba(52,199,89,.12)" },
  booking_confirmed: { icon: "checkmark-circle-outline", color: "#007AFF", bg: "rgba(0,122,255,.12)" },
  booking_cancelled: { icon: "alert-circle-outline",     color: "#FF3B30", bg: "rgba(255,59,48,.12)" },
  booking_reminder:  { icon: "time-outline",             color: "#FF9500", bg: "rgba(255,149,0,.12)" },
  message_received:  { icon: "chatbubble-outline",       color: "#5856D6", bg: "rgba(88,86,214,.12)" },
  payment_received:  { icon: "card-outline",             color: "#34C759", bg: "rgba(52,199,89,.12)" },
  promotional:       { icon: "gift-outline",             color: "#FF2D55", bg: "rgba(255,45,85,.12)" },
  late_alert:        { icon: "warning-outline",          color: "#FF9500", bg: "rgba(255,149,0,.12)" },
  default:           { icon: "notifications-outline",    color: "#8E8E93", bg: "rgba(142,142,147,.12)" },
};

function formatRelTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "hier";
  if (days < 7) return `${days}j`;
  return new Date(dateString).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function groupByDay(notifications: Array<{ id: number; type: string; message: string; is_read: boolean; created_at: string }>) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
  const groups: { label: string; items: typeof notifications }[] = [
    { label: "Aujourd'hui", items: [] },
    { label: "Hier", items: [] },
    { label: "Cette semaine", items: [] },
    { label: "Plus ancien", items: [] },
  ];
  for (const n of notifications) {
    const d = new Date(n.created_at); d.setHours(0, 0, 0, 0);
    if (d >= todayStart) groups[0].items.push(n);
    else if (d >= yesterdayStart) groups[1].items.push(n);
    else if (d >= weekStart) groups[2].items.push(n);
    else groups[3].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

interface PrefItem {
  key: PrefKey;
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconBg: string;
  iconColor: string;
}

const PREF_SECTIONS: Array<{ title: string; items: PrefItem[] }> = [
  {
    title: "Rendez-vous",
    items: [
      { key: "reminders", label: "Confirmations & rappels", subtitle: "La veille et 1h avant ton rendez-vous", icon: "notifications-outline", iconBg: "#FE5D9D20", iconColor: "#FE5D9D" },
      { key: "changes",   label: "Modifications & annulations", subtitle: "Si l'experte change ou annule ton créneau", icon: "calendar-outline", iconBg: "#F59E0B20", iconColor: "#F59E0B" },
      { key: "late",      label: "Retard de l'experte", subtitle: "Si ton rendez-vous prend du retard", icon: "time-outline", iconBg: "#06B6D420", iconColor: "#06B6D4" },
    ],
  },
  {
    title: "Messages",
    items: [
      { key: "messages", label: "Nouveaux messages", subtitle: "Quand une experte t'envoie un message", icon: "chatbubble-outline", iconBg: "#10B98120", iconColor: "#10B981" },
    ],
  },
  {
    title: "Promotions",
    items: [
      { key: "offers",        label: "Offres & codes promo", subtitle: "Exclusivités et promotions de tes expertes", icon: "gift-outline", iconBg: "#8B5CF620", iconColor: "#8B5CF6" },
      { key: "email_summary", label: "Résumé par email", subtitle: "Récap' hebdo de tes rendez-vous", icon: "mail-outline", iconBg: "#6B728020", iconColor: "#6B7280" },
    ],
  },
];

export default function ClientNotificationsScreen() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [tab, setTab] = useState<Tab>("activity");
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [preferences, setPreferences] = useState<ClientNotificationSettings>({
    reminders: true, changes: true, messages: true,
    late: true, offers: true, email_summary: false,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    notificationsApi.getSettings()
      .then((res) => { if (res.success && res.data) setPreferences(res.data); })
      .finally(() => setPrefsLoading(false));
  }, []);

  const togglePref = async (key: PrefKey) => {
    if (savingKey) return;
    const next = !preferences[key];
    const prev = preferences;
    setPreferences((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    setSaveSuccess(false);
    try {
      const res = await notificationsApi.updateSettings({ [key]: next });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        setPreferences(prev);
      }
    } catch {
      setPreferences(prev);
      Alert.alert("Erreur", "Impossible de mettre à jour la préférence");
    } finally {
      setSavingKey(null);
    }
  };

  const markAllAsRead = () => {
    notifications.filter((n) => !n.is_read).forEach((n) => {
      markAsRead(n.id);
      notificationsApi.markAsRead(String(n.id)).catch(() => {});
    });
  };

  const grouped = useMemo(() => groupByDay(notifications), [notifications]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>

        {/* Header */}
        <View style={{ paddingTop: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>Notifications</Text>
        </View>

        {/* Segmented control */}
        <View style={{ flexDirection: "row", backgroundColor: Colors.muted, borderRadius: 14, padding: 4, marginBottom: 20 }}>
          {([["activity", "Activité"], ["preferences", "Préférences"]] as [Tab, string][]).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                backgroundColor: tab === id ? "#fff" : "transparent",
                shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
                shadowOpacity: tab === id ? 0.08 : 0, shadowRadius: 4,
                elevation: tab === id ? 2 : 0,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: tab === id ? Colors.foreground : Colors.mutedForeground }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "activity" ? (
          notifications.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="notifications-outline" size={26} color={Colors.mutedForeground} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Aucune notification</Text>
              <Text style={{ fontSize: 13, color: Colors.mutedForeground, textAlign: "center", maxWidth: 220, lineHeight: 18 }}>
                Tes notifications apparaîtront ici en temps réel.
              </Text>
            </View>
          ) : (
            <FlatList
              data={grouped}
              keyExtractor={(item) => item.label}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item: group }) => (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    {group.label}
                  </Text>
                  <View style={{ gap: 6 }}>
                    {group.items.map((notif) => {
                      const cfg = NOTIF_CFG[notif.type] ?? NOTIF_CFG.default;
                      return (
                        <Pressable
                          key={notif.id}
                          onPress={() => { if (!notif.is_read) markAsRead(notif.id); }}
                          style={{
                            flexDirection: "row", alignItems: "flex-start", gap: 12,
                            padding: 14, borderRadius: 16,
                            backgroundColor: notif.is_read ? Colors.muted : "#fff",
                            borderWidth: notif.is_read ? 0 : 1,
                            borderColor: "#FE5D9D1A",
                            ...(notif.is_read ? {} : Shadows.card),
                          }}
                        >
                          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: cfg.bg, opacity: notif.is_read ? 0.55 : 1 }}>
                            <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                          </View>
                          <View style={{ flex: 1, paddingTop: 2 }}>
                            <Text style={{ fontSize: 13, lineHeight: 18, color: notif.is_read ? Colors.mutedForeground : Colors.foreground, fontWeight: notif.is_read ? "400" : "600" }} numberOfLines={2}>
                              {notif.message}
                            </Text>
                            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginTop: 6, fontWeight: "500" }}>
                              {formatRelTime(notif.created_at)}
                            </Text>
                          </View>
                          {!notif.is_read && (
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FE5D9D", marginTop: 6, flexShrink: 0 }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            />
          )
        ) : prefsLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={[1]}
            keyExtractor={() => "prefs"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={() => (
              <View>
                {/* Bandeau info */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#FE5D9D15", borderRadius: 12, padding: 14, marginBottom: 24 }}>
                  <Ionicons name="notifications-outline" size={18} color="#FE5D9D" />
                  <Text style={{ flex: 1, fontSize: 13, color: "#FE5D9D", lineHeight: 18 }}>
                    Choisis les alertes que tu souhaites recevoir.{" "}
                    Tu peux modifier tes préférences à tout moment.
                  </Text>
                </View>

                {/* Sections */}
                {PREF_SECTIONS.map((section) => (
                  <View key={section.title} style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                      {section.title}
                    </Text>
                    <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border }}>
                      {section.items.map((item, idx) => (
                        <View
                          key={item.key}
                          style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14, borderBottomWidth: idx < section.items.length - 1 ? 1 : 0, borderBottomColor: "#F3F4F6" }}
                        >
                          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: item.iconBg, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name={item.icon} size={20} color={item.iconColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>{item.label}</Text>
                            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>{item.subtitle}</Text>
                          </View>
                          <Switch
                            value={preferences[item.key]}
                            onValueChange={() => togglePref(item.key)}
                            trackColor={{ false: "#E5E7EB", true: "#FE5D9D" }}
                            thumbColor="#fff"
                            disabled={savingKey === item.key}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}

                {/* Système */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    Système
                  </Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border }}>
                    <Pressable
                      onPress={() => Linking.openSettings()}
                      style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="settings-outline" size={20} color="#6B7280" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>Réglages système</Text>
                        <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>Activer les notifications pour Blyss</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>

                {saveSuccess && (
                  <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Préférences à jour ✓</Text>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
