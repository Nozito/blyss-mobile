import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image as RNImage,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { messagesApi, REPORT_REASONS, type ChatMessage } from "@/lib/api";
import { useThemeColors } from "@/hooks/useThemeColors";
import { resolveMediaUrl } from "@/lib/media";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

type QuickReply = { label: string; icon: React.ComponentProps<typeof Ionicons>["name"] };

const QUICK_REPLIES_BEFORE: QuickReply[] = [
  { label: "Confirmer l'adresse", icon: "location-outline" },
  { label: "Avez-vous un créneau plus tôt ?", icon: "time-outline" },
  { label: "Quel est le prix exact ?", icon: "pricetag-outline" },
];
const QUICK_REPLIES_AFTER: QuickReply[] = [
  { label: "Je serai en retard", icon: "time-outline" },
  { label: "Confirmer l'adresse", icon: "location-outline" },
  { label: "J'ai une allergie à signaler", icon: "alert-circle-outline" },
];

function formatMessageTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function Avatar({ uri, name, size = 34 }: { uri?: string | null; name: string; size?: number }) {
  const colors = useThemeColors();
  const resolved = resolveMediaUrl(uri);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: "700", color: colors.primary }}>{initial}</Text>
    </View>
  );
}

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = Number(id);
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [draft, setDraft] = useState("");
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReasonCode, setReportReasonCode] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["message-thread", threadId],
    queryFn: () => messagesApi.getThread(threadId),
    enabled: !!threadId,
  });

  const thread = data?.data;
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (thread?.messages) setMessages(thread.messages);
  }, [thread?.messages]);

  useEffect(() => {
    if (thread) setLocked(!!thread.isLocked);
  }, [thread]);

  useEffect(() => {
    // Une fois le fil consulté (marqué lu côté serveur par GET /threads/:id),
    // rafraîchit la liste des fils pour que le badge non-lu se mette à jour.
    return () => {
      void queryClient.invalidateQueries({ queryKey: ["message-threads"] });
    };
  }, [queryClient]);

  const quickReplies = thread?.reservationStatus ? QUICK_REPLIES_AFTER : QUICK_REPLIES_BEFORE;
  // Sous-titre du header — dérivé du statut réel de la réservation épinglée,
  // jamais inventé (pas de "répond généralement vite" sans donnée derrière).
  const headerSubtitle = thread?.reservationStatus === "completed"
    ? "Rendez-vous terminé"
    : thread?.reservationStatus
    ? "Rendez-vous à venir"
    : null;

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setPickedPhoto(result.assets[0].uri);
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body && !pickedPhoto) return;
    if (sending || locked) return;
    setSending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await messagesApi.sendMessage(threadId, { body: body || undefined, photoUri: pickedPhoto || undefined });
    setSending(false);
    if (res.success && res.data) {
      setMessages((prev) => [...prev, res.data as ChatMessage]);
      setDraft("");
      setPickedPhoto(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } else {
      showToast(res.error ?? "Impossible d'envoyer le message", "error");
    }
  };

  const openReportModal = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    setReportReasonCode(null);
    setReportDetails("");
    setReportModalVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReasonCode || reportSubmitting) return;
    setReportSubmitting(true);
    const res = await messagesApi.reportThread(threadId, reportReasonCode, reportDetails.trim() || undefined);
    setReportSubmitting(false);
    if (res.success) {
      setReportModalVisible(false);
      setLocked(true);
      showToast("Merci, la conversation va être examinée par l'équipe Blyss.", "success");
    } else {
      showToast(res.error ?? "Erreur lors du signalement", "error");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !thread) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 }}>
        <Ionicons name="chatbubble-outline" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>Conversation introuvable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <AnimatedIconButton
            onPress={() => safeBack(router, user?.role === "pro" ? "/(pro)/dashboard" : "/(client)")}
            style={{ padding: 6 }}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </AnimatedIconButton>
          <Avatar uri={thread.otherPhoto} name={thread.otherName} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
              {thread.otherName}
            </Text>
            {!!headerSubtitle && (
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>
                {headerSubtitle}
              </Text>
            )}
          </View>
          <AnimatedIconButton
            onPress={openReportModal}
            style={{ padding: 6 }}
            accessibilityLabel="Signaler cette conversation"
            accessibilityRole="button"
          >
            <Ionicons name="flag-outline" size={20} color={colors.mutedForeground} />
          </AnimatedIconButton>
        </View>

        {/* Lock banner — posé dès qu'un signalement (le nôtre ou celui de
            l'autre partie) a mis la conversation en attente d'examen. */}
        {locked && (
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              marginHorizontal: 12, marginTop: 10, padding: 12, borderRadius: 14,
              backgroundColor: colors.destructiveLight ?? colors.muted,
            }}
          >
            <Ionicons name="lock-closed-outline" size={16} color={colors.destructive} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.destructive, lineHeight: 17 }}>
              Cette conversation a été signalée et est en cours d'examen par l'équipe Blyss. L'envoi de messages est suspendu.
            </Text>
          </View>
        )}

        {/* Reservation pin */}
        {thread.lastReservationId && (
          <Pressable
            onPress={() => router.push(`/booking/${thread.lastReservationId}` as never)}
            accessibilityRole="button"
            accessibilityLabel="Voir le rendez-vous"
            style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              marginHorizontal: 12, marginTop: 10, padding: 12, borderRadius: 14,
              backgroundColor: colors.primaryLight,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="calendar-outline" size={15} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>Voir le rendez-vous</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.sender_id === user?.id;
            const photoUri = resolveMediaUrl(item.attachment_url);
            return (
              <View style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "80%", gap: 2 }}>
                <View
                  style={{
                    backgroundColor: isMine ? colors.primary : colors.card,
                    borderWidth: isMine ? 0 : 1,
                    borderColor: colors.border,
                    borderRadius: 18,
                    borderBottomRightRadius: isMine ? 5 : 18,
                    borderBottomLeftRadius: isMine ? 18 : 5,
                    padding: photoUri ? 6 : 12,
                    gap: 6,
                  }}
                >
                  {photoUri && (
                    <RNImage source={{ uri: photoUri }} style={{ width: 200, height: 200, borderRadius: 13 }} resizeMode="cover" />
                  )}
                  {item.body && (
                    <Text style={{ fontSize: 14, lineHeight: 19, color: isMine ? colors.onColor : colors.foreground, paddingHorizontal: photoUri ? 6 : 0, paddingBottom: photoUri ? 4 : 0 }}>
                      {item.body}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 10, color: colors.mutedForeground, alignSelf: isMine ? "flex-end" : "flex-start", marginHorizontal: 4 }}>
                  {formatMessageTime(item.created_at)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 72, paddingHorizontal: 40 }}>
              <View
                style={{
                  width: 60, height: 60, borderRadius: 30,
                  backgroundColor: colors.primaryLight,
                  alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 4, textAlign: "center" }}>
                Commence la conversation
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 }}>
                Pose une question ou envoie un message à {thread.otherName}.
              </Text>
            </View>
          }
        />

        {/* Quick replies — un coup de pouce pour démarrer, pas un menu permanent :
            disparaît dès que le fil contient un message. */}
        {messages.length === 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
            {quickReplies.map((q) => (
              <Pressable
                key={q.label}
                onPress={() => setDraft(q.label)}
                accessibilityRole="button"
                accessibilityLabel={q.label}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  borderWidth: 1.2, borderColor: colors.primary, borderRadius: 20,
                  paddingVertical: 6, paddingHorizontal: 12,
                }}
              >
                <Ionicons name={q.icon} size={13} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Picked photo preview */}
        {pickedPhoto && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row" }}>
            <View style={{ position: "relative" }}>
              <RNImage source={{ uri: pickedPhoto }} style={{ width: 60, height: 60, borderRadius: 12 }} />
              <Pressable
                onPress={() => setPickedPhoto(null)}
                accessibilityRole="button"
                accessibilityLabel="Retirer la photo"
                style={{ position: "absolute", top: -6, right: -6, backgroundColor: colors.foreground, borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" size={12} color={colors.background} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Composer */}
        {!locked && (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable
              onPress={handlePickPhoto}
              accessibilityRole="button"
              accessibilityLabel="Ajouter une photo"
              style={{ padding: 8 }}
            >
              <Ionicons name="camera-outline" size={22} color={colors.mutedForeground} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Écrire un message…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={{
                flex: 1, maxHeight: 100, fontSize: 14, color: colors.foreground,
                backgroundColor: colors.muted, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
              }}
            />
            <AnimatedPressable
              onPress={handleSend}
              disabled={sending || (!draft.trim() && !pickedPhoto)}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le message"
              accessibilityState={{ disabled: sending || (!draft.trim() && !pickedPhoto) }}
              style={{
                width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
                backgroundColor: (draft.trim() || pickedPhoto) ? colors.primary : colors.disabled,
              }}
            >
              {sending ? <ActivityIndicator size="small" color={colors.onColor} /> : <Ionicons name="arrow-up" size={18} color={colors.onColor} />}
            </AnimatedPressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} title="Signaler cette conversation" bottomSheet>
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 18 }}>
            Un membre de l'équipe Blyss va examiner cette conversation. L'envoi de messages sera suspendu pour les deux parties le temps de l'examen.
          </Text>

          <View style={{ gap: 8 }}>
            {REPORT_REASONS.map((reasonOption) => {
              const selected = reportReasonCode === reasonOption.code;
              return (
                <Pressable
                  key={reasonOption.code}
                  onPress={() => setReportReasonCode(reasonOption.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    borderWidth: 1.2, borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primaryLight : "transparent",
                    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
                  }}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: selected ? colors.primary : colors.foreground }}>
                    {reasonOption.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={reportDetails}
            onChangeText={setReportDetails}
            placeholder="Ajoute des précisions si besoin (optionnel)"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={{
              minHeight: 70, fontSize: 13, color: colors.foreground,
              backgroundColor: colors.muted, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
              textAlignVertical: "top",
            }}
          />

          <AnimatedPressable
            onPress={handleSubmitReport}
            disabled={!reportReasonCode || reportSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Confirmer le signalement"
            accessibilityState={{ disabled: !reportReasonCode || reportSubmitting }}
            style={{
              height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center",
              backgroundColor: reportReasonCode ? colors.destructive : colors.disabled,
            }}
          >
            {reportSubmitting ? (
              <ActivityIndicator size="small" color={colors.onColor} />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onColor }}>Signaler la conversation</Text>
            )}
          </AnimatedPressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
