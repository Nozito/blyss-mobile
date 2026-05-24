import React, { useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type Target = "all" | "pros" | "clients" | "user_id";

const TARGET_OPTS: { value: Target; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { value: "all",     label: "Tous",         icon: "people-outline",    color: "#A78BFA" },
  { value: "pros",    label: "Pros",          icon: "briefcase-outline", color: ACCENT },
  { value: "clients", label: "Clients",       icon: "person-outline",    color: "#38BDF8" },
  { value: "user_id", label: "Utilisateur",   icon: "at-outline",        color: "#4ADE80" },
];

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [target, setTarget] = useState<Target>("all");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sentCount, setSentCount] = useState<number | null>(null);

  const sendMut = useMutation({
    mutationFn: () =>
      adminApi.sendPush({
        target,
        user_id: target === "user_id" ? parseInt(userId) : undefined,
        title: title.trim(),
        body: body.trim(),
      }),
    onSuccess: (res) => {
      // iOS only — graceful fallback on Android
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const sent = res.data?.sent ?? 0;
      setSentCount(sent);
      setTitle("");
      setBody("");
      Alert.alert("✅ Envoyée", `Push envoyée à ${sent} destinataire(s).`);
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Erreur", "Impossible d'envoyer la notification.");
    },
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0 &&
    (target !== "user_id" || userId.trim().length > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>Notifications</Text>
        <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Envoi push en temps réel</Text>
      </View>

      {/* Stats */}
      {sentCount !== null && (
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(74,222,128,0.10)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(74,222,128,0.2)" }}>
            <Text style={{ fontSize: 11, color: "#4ADE80", fontWeight: "600" }}>Dernière push</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#4ADE80", marginTop: 2 }}>{sentCount}</Text>
            <Text style={{ fontSize: 10, color: MUTED }}>destinataire(s)</Text>
          </View>
        </View>
      )}

      {/* Cible */}
      <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT, marginBottom: 14 }}>1. Cible</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {TARGET_OPTS.map((opt) => {
            const active = target === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setTarget(opt.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={{
                  flex: 1, minWidth: "44%", flexDirection: "row", alignItems: "center", gap: 8,
                  paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5,
                  backgroundColor: active ? `${opt.color}18` : "transparent",
                  borderColor: active ? opt.color : BORDER,
                }}
              >
                <Ionicons name={opt.icon} size={16} color={active ? opt.color : MUTED} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: active ? opt.color : MUTED }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {target === "user_id" && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              ID Utilisateur
            </Text>
            <TextInput
              value={userId}
              onChangeText={setUserId}
              placeholder="ex: 42"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingHorizontal: 14, height: 44, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER }}
            />
          </View>
        )}
      </View>

      {/* Contenu */}
      <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: TEXT, marginBottom: 14 }}>2. Contenu</Text>

        <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Titre</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Titre de la notification"
          placeholderTextColor={MUTED}
          maxLength={100}
          style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 14 }}
        />

        <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Message</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Corps de la notification..."
          placeholderTextColor={MUTED}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
          style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER, minHeight: 90 }}
        />
        <Text style={{ fontSize: 11, color: MUTED, textAlign: "right", marginTop: 4 }}>{body.length}/500</Text>
      </View>

      {/* Prévisualisation iOS */}
      {(title || body) && (
        <View style={{ backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Aperçu push</Text>
          <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>🌸</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED }}>Blyss · maintenant</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }} numberOfLines={1}>{title || "Titre…"}</Text>
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }} numberOfLines={2}>{body || "Message…"}</Text>
          </View>
        </View>
      )}

      {/* Envoyer */}
      <Pressable
        onPress={() => {
          if (!canSend) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          sendMut.mutate();
        }}
        disabled={sendMut.isPending || !canSend}
        style={{
          height: 56, borderRadius: 18, backgroundColor: ACCENT,
          alignItems: "center", justifyContent: "center",
          flexDirection: "row", gap: 10,
          opacity: (sendMut.isPending || !canSend) ? 0.5 : 1,
        }}
      >
        {sendMut.isPending
          ? <ActivityIndicator size="small" color="#fff" />
          : (
            <>
              <Ionicons name="send-outline" size={20} color="#fff" />
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>
                Envoyer{target === "all" ? " à tous" : target === "pros" ? " aux pros" : target === "clients" ? " aux clients" : ""}
              </Text>
            </>
          )}
      </Pressable>
    </ScrollView>
  );
}
