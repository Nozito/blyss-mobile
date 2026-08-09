import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Switch,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNotifications } from "@/contexts/NotificationContext";
import { notificationsApi, type ClientNotificationSettings } from "@/lib/api";
import { Shadows } from "@/constants/shadows";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "activity" | "preferences";
type PrefKey = keyof ClientNotificationSettings;

// booking_confirmed, message_received, and late_alert removed — no backend
// code path ever emits those types, so they always fell through to
// "default" anyway. Also added the real types that previously had no entry
// (and therefore rendered with the generic bell): no_show, slot_available,
// recall.
const NOTIF_CFG: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; bg: string }> = {
  new_booking:       { icon: "checkmark-circle-outline", color: "#34C759", bg: "rgba(52,199,89,.12)" },
  booking_cancelled: { icon: "alert-circle-outline",     color: "#FF3B30", bg: "rgba(255,59,48,.12)" },
  booking_reminder:  { icon: "time-outline",             color: "#FF9500", bg: "rgba(255,149,0,.12)" },
  post_appointment:  { icon: "star-outline",              color: "#5856D6", bg: "rgba(88,86,214,.12)" },
  payment_received:  { icon: "card-outline",             color: "#34C759", bg: "rgba(52,199,89,.12)" },
  promotional:       { icon: "gift-outline",             color: "#FF2D55", bg: "rgba(255,45,85,.12)" },
  no_show:           { icon: "close-circle-outline",     color: "#FF3B30", bg: "rgba(255,59,48,.12)" },
  slot_available:    { icon: "calendar-outline",         color: "#34C759", bg: "rgba(52,199,89,.12)" },
  recall:            { icon: "refresh-outline",          color: "#5856D6", bg: "rgba(88,86,214,.12)" },
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

function groupByDay(notifications: Array<{ id: number; type: string; message: string; is_read: boolean; created_at: string; data?: Record<string, unknown> }>) {
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

function getPrefSections(colors: ReturnType<typeof useThemeColors>): Array<{ title: string; items: PrefItem[] }> {
  return [
    {
      title: "Rendez-vous",
      items: [
        { key: "reminders", label: "Confirmations & rappels", subtitle: "La veille et 1h avant ton rendez-vous", icon: "notifications-outline", iconBg: withAlpha(colors.primary, 0.13), iconColor: colors.primary },
        { key: "changes",   label: "Modifications & annulations", subtitle: "Si l'experte change ou annule ton créneau", icon: "calendar-outline", iconBg: withAlpha(colors.warning, 0.13), iconColor: colors.warning },
        // "late" (Retard de l'experte) removed — no backend code path ever
        // sends a late_alert notification, so the toggle controlled nothing.
      ],
    },
  ];
}

export default function ClientNotificationsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const PREF_SECTIONS = useMemo(() => getPrefSections(colors), [colors]);
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [tab, setTab] = useState<Tab>("activity");
  const listRef = useRef(null);
  useScrollToTop(listRef);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [preferences, setPreferences] = useState<ClientNotificationSettings>({
    reminders: true, changes: true, messages: true,
    late: true, offers: false, email_summary: false,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [prefsError, setPrefsError] = useState(false);

  useEffect(() => {
    notificationsApi.getSettings()
      .then((res) => { if (res.success && res.data) setPreferences(res.data); })
      .catch(() => setPrefsError(true))
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
      if (__DEV__) console.log("Impossible de mettre à jour la préférence");
    } finally {
      setSavingKey(null);
    }
  };

  const markAllAsRead = () => {
    notifications.filter((n) => !n.is_read).forEach((n) => {
      markAsRead(n.id);
      notificationsApi.markAsRead(Number(n.id)).catch(() => {}); // BLYSS-FIX: 3.1
    });
  };

  const grouped = useMemo(() => groupByDay(notifications), [notifications]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 0, paddingBottom: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>Notifications</Text>
          {tab === "activity" && unreadCount > 0 && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                markAllAsRead();
              }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>Tout marquer comme lu</Text>
            </Pressable>
          )}
        </View>

        {/* Segmented control */}
        <View style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: 14, padding: 4, marginBottom: 20 }}>
          {([["activity", "Activité"], ["preferences", "Préférences"]] as [Tab, string][]).map(([id, label]) => (
            <AnimatedPressable
              key={id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setTab(id);
              }}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                backgroundColor: tab === id ? colors.white : "transparent",
                shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
                shadowOpacity: tab === id ? 0.08 : 0, shadowRadius: 4,
                elevation: tab === id ? 2 : 0,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: tab === id ? colors.foreground : colors.mutedForeground }}>
                {label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        {tab === "activity" ? (
          notifications.length === 0 ? (
            <EmptyState
              icon="notifications-outline"
              title="Aucune notification"
              description="Tes notifications apparaîtront ici en temps réel."
            />
          ) : (
            <FlatList
              ref={listRef}
              data={grouped}
              keyExtractor={(item) => item.label}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item: group }) => (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    {group.label}
                  </Text>
                  <View style={{ gap: 6 }}>
                    {group.items.map((notif) => {
                      const cfg = NOTIF_CFG[notif.type] ?? NOTIF_CFG.default;
                      return (
                        <AnimatedPressable
                          key={notif.id}
                          onPress={() => {
                            if (!notif.is_read) {
                              // markAsRead(context) ne met à jour que le state local — sans
                              // l'appel API ci-dessous (déjà fait par markAllAsRead, oublié
                              // ici), la notification redevenait "non lue" au prochain
                              // rechargement de la liste depuis le serveur.
                              markAsRead(notif.id);
                              notificationsApi.markAsRead(Number(notif.id)).catch(() => {});
                            }
                            // Sans cette navigation, taper une notif depuis la liste in-app
                            // ne faisait rien d'autre que la marquer lue — la fonctionnalité
                            // la plus attendue d'un centre de notifications (aller voir le
                            // rendez-vous concerné) était absente.
                            const reservationId = notif.data?.reservation_id;
                            if (reservationId != null) {
                              router.push(`/booking/${String(reservationId)}` as never);
                            }
                          }}
                          style={{
                            flexDirection: "row", alignItems: "flex-start", gap: 12,
                            padding: 14, borderRadius: 16,
                            backgroundColor: notif.is_read ? colors.muted : colors.white,
                            borderWidth: notif.is_read ? 0 : 1,
                            borderColor: withAlpha(colors.primary, 0.10),
                            ...(notif.is_read ? {} : Shadows.card),
                          }}
                        >
                          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0, backgroundColor: cfg.bg, opacity: notif.is_read ? 0.55 : 1 }}>
                            <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                          </View>
                          <View style={{ flex: 1, paddingTop: 2 }}>
                            <Text style={{ fontSize: 13, lineHeight: 18, color: notif.is_read ? colors.mutedForeground : colors.foreground, fontWeight: notif.is_read ? "400" : "600" }} numberOfLines={2}>
                              {notif.message}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6, fontWeight: "500" }}>
                              {formatRelTime(notif.created_at)}
                            </Text>
                          </View>
                          {!notif.is_read && (
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6, flexShrink: 0 }} />
                          )}
                        </AnimatedPressable>
                      );
                    })}
                  </View>
                </View>
              )}
            />
          )
        ) : prefsLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : prefsError ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Ionicons name="wifi-outline" size={32} color={colors.mutedForeground} />
            <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}>
              Impossible de charger les préférences.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={[1]}
            keyExtractor={() => "prefs"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={() => (
              <View>
                {/* Bandeau info */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: withAlpha(colors.primary, 0.08), borderRadius: 12, padding: 14, marginBottom: 24 }}>
                  <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.primary, lineHeight: 18 }}>
                    Choisis les alertes que tu souhaites recevoir.{" "}
                    Tu peux modifier tes préférences à tout moment.
                  </Text>
                </View>

                {/* Sections */}
                {PREF_SECTIONS.map((section) => (
                  <View key={section.title} style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                      {section.title}
                    </Text>
                    <View style={{ backgroundColor: colors.white, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                      {section.items.map((item, idx) => (
                        <View
                          key={item.key}
                          style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14, borderBottomWidth: idx < section.items.length - 1 ? 1 : 0, borderBottomColor: colors.muted }}
                        >
                          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: item.iconBg, alignItems: "center", justifyContent: "center" }}>
                            <Ionicons name={item.icon} size={20} color={item.iconColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{item.label}</Text>
                            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{item.subtitle}</Text>
                          </View>
                          <Switch
                            value={preferences[item.key]}
                            onValueChange={() => togglePref(item.key)}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={colors.onColor}
                            disabled={savingKey === item.key}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}

                {/* Système */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    Système
                  </Text>
                  <View style={{ backgroundColor: colors.white, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
                    <AnimatedPressable
                      onPress={() => Linking.openSettings()}
                      style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Réglages système</Text>
                        <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>Activer les notifications pour Blyss</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                    </AnimatedPressable>
                  </View>
                </View>

                {saveSuccess && (
                  <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Préférences à jour ✓</Text>
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
