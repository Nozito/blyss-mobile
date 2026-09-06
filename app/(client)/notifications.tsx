import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Switch,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { notificationsApi, type ClientNotificationSettings } from "@/lib/api";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { ThreadList } from "@/components/screens/shared/ThreadList";

type Tab = "messages" | "preferences";
type PrefKey = keyof ClientNotificationSettings;

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
    {
      title: "Messages",
      items: [
        { key: "messages", label: "Nouveaux messages", subtitle: "Quand une pro te répond", icon: "chatbubble-ellipses-outline", iconBg: withAlpha(colors.primary, 0.13), iconColor: colors.primary },
      ],
    },
  ];
}

export default function ClientNotificationsScreen() {
  const colors = useThemeColors();
  const PREF_SECTIONS = useMemo(() => getPrefSections(colors), [colors]);
  const [tab, setTab] = useState<Tab>("messages");
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

  const listHeader = (
    <View>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 0, paddingBottom: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>Notifications</Text>
      </View>

      {/* Segmented control */}
      <View style={{ flexDirection: "row", backgroundColor: colors.muted, borderRadius: 14, padding: 4, marginBottom: 20 }}>
        {([["messages", "Messages"], ["preferences", "Préférences"]] as [Tab, string][]).map(([id, label]) => (
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
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>

        {tab === "messages" ? (
          <>
            {listHeader}
            <ThreadList />
          </>
        ) : prefsLoading ? (
          <View style={{ flex: 1 }}>
            {listHeader}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          </View>
        ) : prefsError ? (
          <View style={{ flex: 1 }}>
            {listHeader}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Ionicons name="wifi-outline" size={32} color={colors.mutedForeground} />
              <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}>
                Impossible de charger les préférences.
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={[1]}
            keyExtractor={() => "prefs"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={listHeader}
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
