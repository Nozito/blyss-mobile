import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { proApi, ProNotificationSettings } from "@/lib/api";
import { Colors } from "@/constants/colors";

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

const SECTIONS: Array<{ title: string; items: NotifItem[] }> = [
  {
    title: "Rendez-vous & Clientes",
    items: [
      {
        key: "new_reservation",
        label: "Nouvelles réservations",
        subtitle: "Dès qu'une cliente réserve un créneau",
        icon: "notifications-outline",
        iconBg: "#FE5D9D20",
        iconColor: "#FE5D9D",
      },
      {
        key: "cancel_change",
        label: "Changements & annulations",
        subtitle: "Modification d'horaire ou annulation par la cliente",
        icon: "calendar-outline",
        iconBg: "#F59E0B20",
        iconColor: "#F59E0B",
      },
      {
        key: "daily_reminder",
        label: "Rappels du jour",
        subtitle: "Récap' de tes rendez-vous du jour le matin",
        icon: "star-outline",
        iconBg: "#06B6D420",
        iconColor: "#06B6D4",
      },
      {
        key: "client_message",
        label: "Messages clientes",
        subtitle: "Quand une cliente t'envoie un message",
        icon: "chatbubble-outline",
        iconBg: "#10B98120",
        iconColor: "#10B981",
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
        iconBg: "#8B5CF620",
        iconColor: "#8B5CF6",
      },
      {
        key: "activity_summary",
        label: "Résumé d'activité",
        subtitle: "Aperçu de ton CA et rendez-vous en fin de journée",
        icon: "trending-up-outline",
        iconBg: "#FE5D9D20",
        iconColor: "#FE5D9D",
      },
    ],
  },
];

export default function ProNotificationsScreen() {
  const insets = useSafeAreaInsets();
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.foreground }}>
          Notifications
        </Text>
        <Text style={{ fontSize: 13, color: Colors.mutedForeground }}>
          Préférences de réception
        </Text>
      </View>

      {/* Sections toggles */}
      {SECTIONS.map((section) => (
        <View key={section.title} style={{ marginBottom: 24 }}>
          <Text style={{
            fontSize: 11, fontWeight: "700",
            color: Colors.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
          }}>
            {section.title}
          </Text>
          <View style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: Colors.border,
          }}>
            {section.items.map((item, idx) => (
              <View
                key={item.key}
                style={{
                  flexDirection: "row", alignItems: "center",
                  padding: 16, gap: 14,
                  borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                  borderBottomColor: "#F3F4F6",
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
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                    {item.subtitle}
                  </Text>
                </View>
                <Switch
                  value={prefs[item.key]}
                  onValueChange={(val) => updatePref(item.key, val)}
                  trackColor={{ false: "#E5E7EB", true: "#FE5D9D" }}
                  thumbColor="#fff"
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
          color: Colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}>
          Système
        </Text>
        <View style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: Colors.border,
        }}>
          <Pressable
            onPress={() => Linking.openSettings()}
            style={{
              flexDirection: "row", alignItems: "center",
              padding: 16, gap: 14,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: "#F3F4F6",
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
                Réglages système
              </Text>
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
                Activer les notifications pour Blyss
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      {saveSuccess && (
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, color: Colors.success }}>
            Préférences à jour ✓
          </Text>
        </View>
      )}
      {saveError && (
        <View style={{ alignItems: "center", paddingVertical: 8, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
          <Text style={{ fontSize: 14, color: "#EF4444" }}>
            Impossible de sauvegarder — réessaie
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
