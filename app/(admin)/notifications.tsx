import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { adminApi } from "@/lib/api";

interface AppUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: "pro" | "client";
}

const NOTIFICATION_TYPES_PRO = [
  { value: "new_booking", label: "Nouvelle réservation", icon: "calendar-outline" as const, color: "#22C55E" },
  { value: "booking_cancelled", label: "Annulation/Modification", icon: "alert-circle-outline" as const, color: "#EF4444" },
  { value: "booking_reminder", label: "Rappel quotidien", icon: "time-outline" as const, color: "#3B82F6" },
  { value: "message_received", label: "Message client", icon: "chatbubble-outline" as const, color: "#8B5CF6" },
  { value: "payment_received", label: "Alerte paiement", icon: "card-outline" as const, color: "#10B981" },
  { value: "activity_summary", label: "Résumé d'activité", icon: "bar-chart-outline" as const, color: "#6366F1" },
];

const NOTIFICATION_TYPES_CLIENT = [
  { value: "booking_reminder", label: "Rappels", icon: "notifications-outline" as const, color: "#3B82F6" },
  { value: "booking_confirmed", label: "Changements RDV", icon: "checkmark-circle-outline" as const, color: "#22C55E" },
  { value: "message_received", label: "Messages", icon: "chatbubble-outline" as const, color: "#8B5CF6" },
  { value: "promotional", label: "Offres promo", icon: "gift-outline" as const, color: Colors.primary },
];

const TEMPLATES: Record<string, { title: string; message: string }> = {
  new_booking: { title: "Nouvelle réservation", message: "Tu as une nouvelle réservation !" },
  booking_cancelled: { title: "Réservation modifiée", message: "Une réservation a été modifiée ou annulée." },
  booking_reminder: { title: "Rappel de rendez-vous", message: "N'oublie pas ton RDV demain !" },
  message_received: { title: "Nouveau message", message: "Tu as reçu un nouveau message." },
  payment_received: { title: "Paiement reçu", message: "Un paiement a été reçu." },
  activity_summary: { title: "Résumé de la journée", message: "Voici le résumé de ton activité." },
  booking_confirmed: { title: "Réservation confirmée", message: "Ta réservation est confirmée !" },
  promotional: { title: "Offre spéciale", message: "-20% sur ta prochaine prestation ! 💅" },
};

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [type, setType] = useState("new_booking");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "pro" | "client">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [recentSent, setRecentSent] = useState<Array<{ user: string; title: string }>>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await adminApi.getUsers?.();
        const data = (res?.data || []) as AppUser[];
        setUsers(data);
        setFilteredUsers(data);
      } catch {}
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    let f = users;
    if (roleFilter !== "all") f = f.filter((u) => u.role === roleFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }
    setFilteredUsers(f);
  }, [searchQuery, roleFilter, users]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const notifTypes = selectedUser?.role === "pro" ? NOTIFICATION_TYPES_PRO : NOTIFICATION_TYPES_CLIENT;

  const applyTemplate = (t: string) => {
    const tmpl = TEMPLATES[t];
    if (tmpl) { setTitle(tmpl.title); setMessage(tmpl.message); }
  };

  const handleSend = async () => {
    if (!selectedUserId || !title.trim() || !message.trim()) {
      Alert.alert("Erreur", "Sélectionne un utilisateur et remplis tous les champs.");
      return;
    }
    setIsLoading(true);
    try {
      await adminApi.sendNotification?.({ user_id: selectedUserId, type, title, message });
      const user = users.find((u) => u.id === selectedUserId);
      setRecentSent((prev) => [
        { user: `${user?.first_name} ${user?.last_name}`, title },
        ...prev.slice(0, 4),
      ]);
      setTitle("");
      setMessage("");
      Alert.alert("✅ Envoyé", "Notification envoyée avec succès !");
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer la notification.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 80,
        paddingHorizontal: 20,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center gap-4">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center"
            style={{ backgroundColor: Colors.admin }}
          >
            <Ionicons name="flash-outline" size={28} color={Colors.white} />
          </View>
          <View>
            <Text className="text-2xl font-bold text-foreground">Notifications</Text>
            <Text className="text-sm text-muted-foreground">Envoi en temps réel</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 bg-card rounded-xl p-3 border border-border items-center">
          <Text className="text-xs text-muted-foreground">Utilisateurs</Text>
          <Text className="text-2xl font-black text-foreground">{users.length}</Text>
        </View>
        <View className="flex-1 bg-card rounded-xl p-3 border-2 items-center" style={{ borderColor: `${Colors.admin}30` }}>
          <Text className="text-xs" style={{ color: Colors.admin }}>Envoyées</Text>
          <Text className="text-2xl font-black" style={{ color: Colors.admin }}>{recentSent.length}</Text>
        </View>
      </View>

      {/* Step 1: Select user */}
      <View className="bg-card rounded-2xl p-5 border border-border mb-4">
        <Text className="text-base font-bold text-foreground mb-4 flex-row">
          1. Destinataire
        </Text>

        {/* Search */}
        <View className="flex-row items-center bg-muted rounded-xl px-4 h-11 border border-border gap-3 mb-3">
          <Ionicons name="search-outline" size={18} color={Colors.mutedForeground} />
          <TextInput
            className="flex-1 text-foreground text-sm"
            placeholder="Rechercher..."
            placeholderTextColor={Colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Role filter */}
        <View className="flex-row gap-2 mb-3">
          {[{ id: "all" as const, label: "Tous" }, { id: "pro" as const, label: "Pros" }, { id: "client" as const, label: "Clients" }].map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setRoleFilter(f.id)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: roleFilter === f.id ? Colors.admin : Colors.muted }}
            >
              <Text className="text-xs font-semibold" style={{ color: roleFilter === f.id ? Colors.white : Colors.mutedForeground }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* User list */}
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {filteredUsers.length === 0 ? (
            <Text className="text-center text-muted-foreground py-6 text-sm">Aucun utilisateur</Text>
          ) : (
            filteredUsers.map((u) => {
              const selected = selectedUserId === u.id;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => { setSelectedUserId(u.id); setType(u.role === "pro" ? "new_booking" : "booking_reminder"); applyTemplate(u.role === "pro" ? "new_booking" : "booking_reminder"); }}
                  className="flex-row items-center gap-3 p-3 rounded-2xl mb-2"
                  style={{ backgroundColor: selected ? Colors.admin : Colors.muted }}
                >
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: selected ? "rgba(255,255,255,0.2)" : `${Colors.admin}15` }}
                  >
                    <Text className="text-sm font-bold" style={{ color: selected ? Colors.white : Colors.admin }}>
                      {u.first_name[0]}{u.last_name[0]}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold" style={{ color: selected ? Colors.white : Colors.foreground }}>
                      {u.first_name} {u.last_name}
                    </Text>
                    <Text className="text-xs" style={{ color: selected ? "rgba(255,255,255,0.7)" : Colors.mutedForeground }}>
                      {u.email}
                    </Text>
                  </View>
                  <View
                    className="px-2 py-1 rounded-lg"
                    style={{ backgroundColor: selected ? "rgba(255,255,255,0.2)" : u.role === "pro" ? `${Colors.pro}18` : `${Colors.primary}18` }}
                  >
                    <Text className="text-xs font-bold" style={{ color: selected ? Colors.white : u.role === "pro" ? Colors.pro : Colors.primary }}>
                      {u.role}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Step 2: Type */}
      {selectedUser && (
        <View className="bg-card rounded-2xl p-5 border border-border mb-4">
          <Text className="text-base font-bold text-foreground mb-4">2. Type</Text>
          <View className="flex-row flex-wrap gap-2">
            {notifTypes.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => { setType(t.value); applyTemplate(t.value); }}
                className="flex-row items-center gap-2 px-3 py-2.5 rounded-xl border"
                style={{
                  backgroundColor: type === t.value ? `${t.color}15` : Colors.muted,
                  borderColor: type === t.value ? t.color : Colors.border,
                  borderWidth: type === t.value ? 2 : 1,
                }}
              >
                <Ionicons name={t.icon} size={14} color={type === t.value ? t.color : Colors.mutedForeground} />
                <Text className="text-xs font-semibold" style={{ color: type === t.value ? t.color : Colors.mutedForeground }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Step 3: Content */}
      {selectedUser && (
        <View className="bg-card rounded-2xl p-5 border border-border mb-4">
          <Text className="text-base font-bold text-foreground mb-4">3. Contenu</Text>

          <View className="mb-3">
            <Text className="text-xs font-semibold text-muted-foreground mb-2">Titre</Text>
            <TextInput
              className="bg-muted rounded-xl px-4 h-12 text-foreground text-sm border border-border"
              placeholder="Titre de la notification"
              placeholderTextColor={Colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          <View>
            <Text className="text-xs font-semibold text-muted-foreground mb-2">Message</Text>
            <TextInput
              className="bg-muted rounded-xl px-4 py-3 text-foreground text-sm border border-border"
              placeholder="Contenu du message"
              placeholderTextColor={Colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              style={{ minHeight: 90 }}
            />
            <Text className="text-xs text-muted-foreground mt-1 text-right">{message.length}/500</Text>
          </View>
        </View>
      )}

      {/* Send button */}
      <View className="mb-6">
        <Pressable
          onPress={handleSend}
          disabled={isLoading || !selectedUserId || !title || !message}
          className="h-14 rounded-2xl items-center justify-center flex-row gap-2"
          style={{
            backgroundColor: Colors.admin,
            opacity: (!selectedUserId || !title || !message || isLoading) ? 0.5 : 1,
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color={Colors.white} />
              <Text className="text-white font-bold text-base">Envoyer la notification</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Recent sent */}
      {recentSent.length > 0 && (
        <View className="bg-card rounded-2xl p-5 border border-border">
          <Text className="text-sm font-bold text-foreground mb-3">Récemment envoyées</Text>
          <View className="gap-2">
            {recentSent.map((n, idx) => (
              <View key={idx} className="p-3 rounded-xl bg-muted border border-border">
                <Text className="text-xs font-bold text-foreground">{n.user}</Text>
                <Text className="text-xs text-muted-foreground">{n.title}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
