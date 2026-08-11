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
import { resolveMediaUrl } from "@/lib/media";
import { AnimatedIconButton, AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { safeBack } from "@/lib/navigation";

const QUICK_REPLIES_BEFORE = ["Confirmer l'adresse", "Disponible plus tôt ?", "Quel est le prix exact ?"];
const QUICK_REPLIES_AFTER = ["Je serai en retard", "Confirmer l'adresse", "J'ai une allergie à signaler"];

// Regroupe les bulles comme iMessage : un nouveau "groupe" démarre quand
// l'émetteur change ou quand plus de 5 minutes séparent deux messages —
// c'est ce même écart qui déclenche l'horodatage centré au-dessus.
const GROUP_GAP_MS = 5 * 60 * 1000;

// Le canevas de conversation reprend la palette neutre de Messages —
// blanc/noir plein et gris système — plutôt que le fond rosé de l'app.
// Seule la bulle envoyée garde la couleur de marque (à la place du bleu
// iMessage) ; tout le reste (texte, séparateurs, bulle reçue) reste neutre,
// exactement comme iMessage reste neutre quel que soit le thème du contact.
const CANVAS_LIGHT = "#FFFFFF";
const CANVAS_DARK = "#000000";
const RECEIVED_BUBBLE_LIGHT = "#E9E9EB";
const RECEIVED_BUBBLE_DARK = "#26262A";
const NEUTRAL_TEXT = "#8E8E93"; // iOS secondaryLabel, identique clair/sombre
const HAIRLINE_LIGHT = "rgba(60,60,67,0.29)";
const HAIRLINE_DARK = "rgba(84,84,88,0.6)";

const TAIL = 11; // taille du nub ; la majeure partie est tuckée sous la bulle (voir marginHorizontal négatif)

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

  const canvasBg = isDark ? CANVAS_DARK : CANVAS_LIGHT;
  const receivedBg = isDark ? RECEIVED_BUBBLE_DARK : RECEIVED_BUBBLE_LIGHT;
  const hairline = isDark ? HAIRLINE_DARK : HAIRLINE_LIGHT;
  const bodyText = isDark ? "#FFFFFF" : "#000000";

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
  const canSend = !!draft.trim() || !!pickedPhoto;

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
      <SafeAreaView style={{ flex: 1, backgroundColor: canvasBg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !thread) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: canvasBg, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 }}>
        <Ionicons name="chatbubble-outline" size={32} color={NEUTRAL_TEXT} />
        <Text style={{ color: NEUTRAL_TEXT, textAlign: "center" }}>Conversation introuvable.</Text>
      </SafeAreaView>
    );
  }

  const subtitle = thread.reservationStatus === "completed"
    ? "Rendez-vous terminé"
    : thread.reservationStatus
    ? "Rendez-vous à venir"
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: canvasBg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top}>
        {/* Header — barre translucide façon Messages, avatar+nom centrés */}
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={{ paddingTop: insets.top }}>
          <View style={[styles.headerRow, { borderBottomColor: hairline }]}>
            <AnimatedIconButton
              onPress={() => safeBack(router, user?.role === "pro" ? "/(pro)/dashboard" : "/(client)")}
              style={styles.headerSideButton}
            >
              <Ionicons name="chevron-back" size={26} color={colors.primary} />
            </AnimatedIconButton>

            <View style={styles.headerCenter}>
              <Avatar uri={thread.otherPhoto} name={thread.otherName} size={30} />
              <Text style={[styles.headerName, { color: bodyText }]} numberOfLines={1}>
                {thread.otherName}
              </Text>
              {!!subtitle && (
                <Text style={[styles.headerSubtitle, { color: NEUTRAL_TEXT }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>

            <AnimatedIconButton onPress={handleReport} style={styles.headerSideButton} accessibilityLabel="Signaler">
              <Ionicons name="flag-outline" size={19} color={NEUTRAL_TEXT} />
            </AnimatedIconButton>
          </View>

          {/* Rendez-vous épinglé — carte grise neutre façon "shared content" iMessage */}
          {thread.lastReservationId && (
            <Pressable
              onPress={() => router.push(`/booking/${thread.lastReservationId}` as never)}
              style={({ pressed }) => [
                styles.pinCard,
                { backgroundColor: isDark ? RECEIVED_BUBBLE_DARK : RECEIVED_BUBBLE_LIGHT, opacity: pressed ? 0.6 : 1 },
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
          style={{ backgroundColor: canvasBg }}
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
            const bubbleColor = isMine ? colors.primary : receivedBg;

            return (
              <View>
                {showDivider && (
                  <Text style={[styles.divider, { color: NEUTRAL_TEXT }]}>
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
                  <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                    {/* Nub, côté gauche — uniquement pour un message reçu (bulle à gauche,
                        la queue sort donc encore plus à gauche, vers le bord de l'écran). */}
                    {!isMine && isGroupEnd && (
                      <View
                        style={[
                          styles.tail,
                          { backgroundColor: bubbleColor, borderBottomLeftRadius: TAIL },
                        ]}
                      />
                    )}
                    {/* Bulle */}
                    <View
                      style={[
                        styles.bubble,
                        {
                          backgroundColor: bubbleColor,
                          padding: photoUri ? 5 : 11,
                          borderBottomRightRadius: isMine && isGroupEnd ? 4 : 18,
                          borderBottomLeftRadius: !isMine && isGroupEnd ? 4 : 18,
                        },
                      ]}
                    >
                      {photoUri && (
                        <RNImage source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                      )}
                      {item.body && (
                        <Text
                          style={[
                            styles.bubbleText,
                            { color: isMine ? colors.onColor : bodyText },
                            photoUri ? { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 2 } : null,
                          ]}
                        >
                          {item.body}
                        </Text>
                      )}
                    </View>
                    {/* Nub, côté droit — uniquement pour un message envoyé (bulle à droite,
                        la queue sort donc encore plus à droite, vers le bord de l'écran).
                        Seul le coin qui pointe vers l'extérieur est arrondi ; les autres
                        sont tuckés sous/contre la bulle — c'est ce qui donne l'effet "queue". */}
                    {isMine && isGroupEnd && (
                      <View
                        style={[
                          styles.tail,
                          { backgroundColor: bubbleColor, borderBottomRightRadius: TAIL },
                        ]}
                      />
                    )}
                  </View>
                  {isGroupEnd && (
                    <Text
                      style={[
                        styles.bubbleTime,
                        { color: NEUTRAL_TEXT, alignSelf: isMine ? "flex-end" : "flex-start" },
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
              <Ionicons name="chatbubble-ellipses-outline" size={28} color={NEUTRAL_TEXT} />
              <Text style={{ color: NEUTRAL_TEXT, fontSize: 13 }}>Dis bonjour à {thread.otherName} 👋</Text>
            </View>
          }
        />

        {/* Suggestions — bande de réponses rapides façon iMessage */}
        {messages.length < 6 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: canvasBg }}
            contentContainerStyle={styles.chipsRow}
          >
            {quickReplies.map((q) => (
              <Pressable
                key={q}
                onPress={() => { void Haptics.selectionAsync(); setDraft(q); }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isDark ? RECEIVED_BUBBLE_DARK : RECEIVED_BUBBLE_LIGHT,
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
          <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", backgroundColor: canvasBg }}>
            <View style={{ position: "relative" }}>
              <RNImage source={{ uri: pickedPhoto }} style={{ width: 56, height: 56, borderRadius: 12 }} />
              <Pressable
                onPress={() => setPickedPhoto(null)}
                style={[styles.photoRemove, { backgroundColor: bodyText }]}
              >
                <Ionicons name="close" size={12} color={canvasBg} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Composer — barre translucide, champ pilule, bouton "+" et flèche façon iMessage */}
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={{ paddingBottom: insets.bottom }}>
          <View style={[styles.composerRow, { borderTopColor: hairline }]}>
            <Pressable onPress={handlePickPhoto} hitSlop={8} style={styles.plusButton}>
              <Ionicons name="add-circle" size={30} color={NEUTRAL_TEXT} />
            </Pressable>
            <View style={[styles.inputWrap, { backgroundColor: isDark ? RECEIVED_BUBBLE_DARK : RECEIVED_BUBBLE_LIGHT, borderColor: hairline }]}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={NEUTRAL_TEXT}
                multiline
                style={[styles.input, { color: bodyText }]}
              />
            </View>
            {canSend && (
              <AnimatedPressable
                onPress={handleSend}
                disabled={sending}
                style={[styles.sendButton, { backgroundColor: colors.primary }]}
              >
                {sending ? <ActivityIndicator size="small" color={colors.onColor} /> : <Ionicons name="arrow-up" size={17} color={colors.onColor} />}
              </AnimatedPressable>
            )}
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
  headerName: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
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
  bubbleText: { fontSize: 16.5, lineHeight: 21 },
  bubbleTime: { fontSize: 10.5, marginTop: 3, marginHorizontal: 4 },
  photo: { width: 208, height: 208, borderRadius: 14 },
  tail: { width: TAIL, height: TAIL, marginHorizontal: -6 },

  chipsRow: { gap: 8, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  chip: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },

  photoRemove: {
    position: "absolute", top: -6, right: -6, borderRadius: 10,
    width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },

  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  plusButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1,
    borderRadius: 18,
    minHeight: 34,
    maxHeight: 110,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sendButton: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
});
