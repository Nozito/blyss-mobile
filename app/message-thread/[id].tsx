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
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useActionSheet } from "@/components/ui/ActionSheet";
import { messagesApi, type ChatMessage } from "@/lib/api";
import { useThemeColors, useIsDarkMode } from "@/hooks/useThemeColors";
import { withAlpha } from "@/constants/colors";
import { resolveMediaUrl } from "@/lib/media";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

const QUICK_REPLIES_BEFORE = ["Confirmer l'adresse", "Disponible plus tôt ?", "Quel est le prix exact ?"];
const QUICK_REPLIES_AFTER = ["Je serai en retard", "Confirmer l'adresse", "J'ai une allergie à signaler"];

// Regroupe les bulles comme iMessage : un nouveau "groupe" démarre quand
// l'émetteur change ou quand plus de 5 minutes séparent deux messages —
// c'est ce même écart qui déclenche l'horodatage centré au-dessus.
const GROUP_GAP_MS = 5 * 60 * 1000;

function formatBubbleTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDividerLabel(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Aujourd'hui ${time}`;
  if (isYesterday) return `Hier ${time}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ uri, name, size = 32 }: { uri?: string | null; name: string; size?: number }) {
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
      <Text style={{ fontSize: size * 0.42, fontWeight: "700", color: colors.primary }}>{initial}</Text>
    </View>
  );
}

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = Number(id);
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const showActionSheet = useActionSheet();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [draft, setDraft] = useState("");
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
    // Une fois le fil consulté (marqué lu côté serveur par GET /threads/:id),
    // rafraîchit la liste des fils pour que le badge non-lu se mette à jour.
    return () => {
      void queryClient.invalidateQueries({ queryKey: ["message-threads"] });
    };
  }, [queryClient]);

  const quickReplies = thread?.reservationStatus ? QUICK_REPLIES_AFTER : QUICK_REPLIES_BEFORE;

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickedPhoto(result.assets[0].uri);
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body && !pickedPhoto) return;
    if (sending) return;
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

  const handleReport = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    showActionSheet(
      {
        title: "Signaler cette conversation ?",
        message: "Un membre de l'équipe Blyss va l'examiner. Elle ne sera pas lue automatiquement sinon.",
        options: ["Annuler", "Signaler"],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 1,
      },
      async (idx) => {
        if (idx !== 1) return;
        const res = await messagesApi.reportThread(threadId);
        showToast(res.success ? "Merci, la conversation va être examinée." : (res.error ?? "Erreur"), res.success ? "success" : "error");
      }
    );
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

  const subtitle = thread.reservationStatus === "completed"
    ? "Rendez-vous terminé"
    : thread.reservationStatus
    ? "Rendez-vous à venir"
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top}>
        {/* Header — barre translucide façon Messages, avatar+nom centrés */}
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={{ paddingTop: insets.top }}>
          <View style={[styles.headerRow, { borderBottomColor: withAlpha(colors.border, 0.7) }]}>
            <AnimatedIconButton
              onPress={() => safeBack(router, user?.role === "pro" ? "/(pro)/dashboard" : "/(client)")}
              style={styles.headerSideButton}
            >
              <Ionicons name="chevron-back" size={26} color={colors.primary} />
            </AnimatedIconButton>

            <View style={styles.headerCenter}>
              <Avatar uri={thread.otherPhoto} name={thread.otherName} size={30} />
              <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
                {thread.otherName}
              </Text>
              {!!subtitle && (
                <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>

            <AnimatedIconButton onPress={handleReport} style={styles.headerSideButton} accessibilityLabel="Signaler">
              <Ionicons name="flag-outline" size={19} color={colors.mutedForeground} />
            </AnimatedIconButton>
          </View>

          {/* Rendez-vous épinglé — carte façon "shared content" iMessage */}
          {thread.lastReservationId && (
            <Pressable
              onPress={() => router.push(`/booking/${thread.lastReservationId}` as never)}
              style={({ pressed }) => [
                styles.pinCard,
                { backgroundColor: withAlpha(colors.primary, isDark ? 0.16 : 0.09), opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={[styles.pinText, { color: colors.primary }]}>Voir le rendez-vous</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </Pressable>
          )}
        </BlurView>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMine = item.sender_id === user?.id;
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const gapBefore = !prev || (new Date(item.created_at).getTime() - new Date(prev.created_at).getTime()) > GROUP_GAP_MS;
            const showDivider = !prev || gapBefore;
            const isGroupStart = showDivider || prev.sender_id !== item.sender_id;
            const gapAfter = !next || (new Date(next.created_at).getTime() - new Date(item.created_at).getTime()) > GROUP_GAP_MS;
            const isGroupEnd = gapAfter || next.sender_id !== item.sender_id;
            const photoUri = resolveMediaUrl(item.attachment_url);

            return (
              <View>
                {showDivider && (
                  <Text style={[styles.divider, { color: colors.mutedForeground }]}>
                    {formatDividerLabel(item.created_at)}
                  </Text>
                )}
                <View
                  style={{
                    alignSelf: isMine ? "flex-end" : "flex-start",
                    maxWidth: "78%",
                    marginTop: isGroupStart ? 10 : 2,
                  }}
                >
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: isMine ? colors.primary : colors.card,
                        borderWidth: isMine ? 0 : StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                        padding: photoUri ? 5 : 11,
                        borderBottomRightRadius: isMine ? (isGroupEnd ? 5 : 18) : 18,
                        borderBottomLeftRadius: isMine ? 18 : (isGroupEnd ? 5 : 18),
                      },
                      isMine ? styles.bubbleShadowMine : styles.bubbleShadowTheirs,
                    ]}
                  >
                    {photoUri && (
                      <RNImage source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                    )}
                    {item.body && (
                      <Text
                        style={[
                          styles.bubbleText,
                          { color: isMine ? colors.onColor : colors.foreground },
                          photoUri ? { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 2 } : null,
                        ]}
                      >
                        {item.body}
                      </Text>
                    )}
                  </View>
                  {isGroupEnd && (
                    <Text
                      style={[
                        styles.bubbleTime,
                        { color: colors.mutedForeground, alignSelf: isMine ? "flex-end" : "flex-start" },
                      ]}
                    >
                      {formatBubbleTime(item.created_at)}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Dis bonjour à {thread.otherName} 👋</Text>
            </View>
          }
        />

        {/* Suggestions — bande de réponses rapides façon iMessage */}
        {messages.length < 6 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {quickReplies.map((q) => (
              <Pressable
                key={q}
                onPress={() => { void Haptics.selectionAsync(); setDraft(q); }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Picked photo preview */}
        {pickedPhoto && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: "row" }}>
            <View style={{ position: "relative" }}>
              <RNImage source={{ uri: pickedPhoto }} style={{ width: 56, height: 56, borderRadius: 12 }} />
              <Pressable
                onPress={() => setPickedPhoto(null)}
                style={[styles.photoRemove, { backgroundColor: colors.foreground }]}
              >
                <Ionicons name="close" size={12} color={colors.background} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Composer — barre translucide, champ pilule, flèche façon iMessage */}
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={{ paddingBottom: insets.bottom }}>
          <View style={[styles.composerRow, { borderTopColor: withAlpha(colors.border, 0.7) }]}>
            <Pressable onPress={handlePickPhoto} hitSlop={8} style={styles.cameraButton}>
              <Ionicons name="camera-outline" size={21} color={colors.mutedForeground} />
            </Pressable>
            <View style={[styles.inputWrap, { backgroundColor: colors.muted }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
            <AnimatedPressable
              onPress={handleSend}
              disabled={sending || (!draft.trim() && !pickedPhoto)}
              style={[
                styles.sendButton,
                { backgroundColor: (draft.trim() || pickedPhoto) ? colors.primary : colors.disabled },
              ]}
            >
              {sending ? <ActivityIndicator size="small" color={colors.onColor} /> : <Ionicons name="arrow-up" size={17} color={colors.onColor} />}
            </AnimatedPressable>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSideButton: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 2 },
  headerName: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 11, fontWeight: "500" },

  pinCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pinText: { fontSize: 12, fontWeight: "700" },

  divider: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "600",
    marginVertical: 10,
  },

  bubble: {
    borderRadius: 18,
  },
  bubbleShadowMine: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  bubbleShadowTheirs: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
  },
  bubbleText: { fontSize: 15.5, lineHeight: 20 },
  bubbleTime: { fontSize: 10.5, marginTop: 3, marginHorizontal: 4 },
  photo: { width: 208, height: 208, borderRadius: 14 },

  chipsRow: { gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  photoRemove: {
    position: "absolute", top: -6, right: -6, borderRadius: 10,
    width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },

  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cameraButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    minHeight: 36,
    maxHeight: 110,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendButton: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
});
