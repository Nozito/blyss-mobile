import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollToTop } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { proApi, ProNotificationSettings } from "@/lib/api";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

const DEFAULT_PREFS: ProNotificationSettings = {
  new_reservation: true,
  cancel_change: true,
  daily_reminder: true,
  client_message: true,
  payment_alert: true,
  activity_summary: false,
};

type PrefKey = keyof ProNotificationSettings;

interface NotifItem {
  key: PrefKey;
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconBg: string;
  iconColor: string;
}

function getSections(colors: ReturnType<typeof useThemeColors>): Array<{ title: string; items: NotifItem[] }> {
  return [
    {
      title: "Rendez-vous & Clientes",
      items: [
        {
          key: "new_reservation",
          label: "Nouvelles réservations",
          subtitle: "Dès qu'une cliente réserve un créneau",
          icon: "notifications-outline",
          iconBg: withAlpha(colors.primary, 0.13),
          iconColor: colors.primary,
        },
        {
          key: "cancel_change",
          label: "Changements & annulations",
          subtitle: "Modification d'horaire ou annulation par la cliente",
          icon: "calendar-outline",
          iconBg: withAlpha(colors.warning, 0.13),
          iconColor: colors.warning,
        },
        {
          key: "daily_reminder",
          label: "Rappels du jour",
          subtitle: "Récap' de tes rendez-vous du jour le matin",
          icon: "star-outline",
          iconBg: withAlpha("#06B6D4", 0.13),
          iconColor: "#06B6D4",
        },
      ],
    },
    {
      title: "Paiement & Activité",
      items: [
        {
          key: "payment_alert",
          label: "Acomptes & garanties",
          subtitle: "Quand un paiement ou acompte est encaissé",
          icon: "card-outline",
          iconBg: withAlpha(colors.pro, 0.13),
          iconColor: colors.pro,
        },
        {
          key: "activity_summary",
          label: "Résumé d'activité",
          subtitle: "Aperçu de ton CA et rendez-vous en fin de journée",
          icon: "trending-up-outline",
          iconBg: withAlpha(colors.primary, 0.13),
          iconColor: colors.primary,
        },
      ],
    },
  ];
}

export default function ProNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const SECTIONS = useMemo(() => getSections(colors), [colors]);
  const scrollRef = useRef(null);
  useScrollToTop(scrollRef);
  const [prefs, setPrefs] = useState<ProNotificationSettings>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    proApi.getNotificationSettings().then((res) => {
      if (res.success && res.data) setPrefs(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const updatePref = async (key: PrefKey, value: boolean) => {
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSaveSuccess(false);
    setSaveError(false);
    const res = await proApi.updateNotificationSettings({ [key]: value });
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      setPrefs(prev);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingHorizontal: 20,
        paddingBottom: 100,
      }}
      automaticallyAdjustContentInsets={false}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
          Notifications
        </Text>
        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
          Préférences de réception
        </Text>
      </View>

      {/* Sections toggles */}
      {SECTIONS.map((section) => (
        <View key={section.title} style={{ marginBottom: 24 }}>
          <Text style={{
            fontSize: 11, fontWeight: "700",
            color: colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
          }}>
            {section.title}
          </Text>
          <View style={{
            backgroundColor: colors.white,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            {section.items.map((item, idx) => (
              <View
                key={item.key}
                style={{
                  flexDirection: "row", alignItems: "center",
                  padding: 16, gap: 14,
                  borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                  borderBottomColor: colors.muted,
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: item.iconBg,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                    {item.subtitle}
                  </Text>
                </View>
                <Switch
                  value={prefs[item.key]}
                  onValueChange={(val) => updatePref(item.key, val)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.onColor}
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Section Système */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{
          fontSize: 11, fontWeight: "700",
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}>
          Système
        </Text>
        <View style={{
          backgroundColor: colors.white,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <AnimatedPressable
            onPress={() => Linking.openSettings()}
            style={{
              flexDirection: "row", alignItems: "center",
              padding: 16, gap: 14,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: colors.muted,
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="settings-outline" size={20} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                Réglages système
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                Activer les notifications pour Blyss
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </AnimatedPressable>
        </View>
      </View>

      {/* Footer */}
      {saveSuccess && (
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, color: colors.success }}>
            Préférences à jour ✓
          </Text>
        </View>
      )}
      {saveError && (
        <View style={{ alignItems: "center", paddingVertical: 8, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
          <Text style={{ fontSize: 14, color: colors.destructive }}>
            Impossible de sauvegarder — réessaie
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
