import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, FlatList,
  ActivityIndicator, Linking, RefreshControl, TextInput, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminApi } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SkeletonBox } from "@/components/ui/SkeletonBox";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const BG     = ADMIN.bg;
const CARD   = ADMIN.surface;
const BORDER = ADMIN.border;
const TEXT1  = ADMIN.text;
const TEXT2  = ADMIN.textSub;
const TEXT3  = ADMIN.textMuted;

interface PendingPro {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string | null;
  city?: string | null;
  activity_name?: string | null;
  bio?: string | null;
  profile_photo?: string | null;
  pro_specialties?: string[] | null;
  created_at: string;
  gallery?: Array<{ id: number; url: string; thumbnail: string }>;
}

function ProSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ backgroundColor: CARD, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <SkeletonBox width={52} height={52} borderRadius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBox width="50%" height={13} borderRadius={6} />
              <SkeletonBox width="70%" height={10} borderRadius={5} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <SkeletonBox width="45%" height={40} borderRadius={12} />
            <SkeletonBox width="45%" height={40} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ProDetailModal({
  pro,
  onClose,
  onApprove,
  onReject,
}: {
  pro: PendingPro;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setRejectError("Le motif du refus est requis.");
      return;
    }
    onReject(rejectReason.trim());
  };

  const name = `${pro.first_name} ${pro.last_name}`;
  const gallery = pro.gallery ?? [];

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: "#111118", borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "92%" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 12, marginBottom: 4 }} />
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <LinearGradient
              colors={["#1a0a00", "#2c1400"]}
              style={{ paddingHorizontal: 24, paddingVertical: 20 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${Colors.admin}25`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.admin }}>
                    {pro.first_name[0]?.toUpperCase()}{pro.last_name[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: TEXT1, marginBottom: 4 }}>{name}</Text>
                  {pro.activity_name && (
                    <Text style={{ fontSize: 13, color: TEXT2 }}>{pro.activity_name}</Text>
                  )}
                  {pro.city && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                      <Ionicons name="location-outline" size={11} color={TEXT3} />
                      <Text style={{ fontSize: 11, color: TEXT3 }}>{pro.city}</Text>
                    </View>
                  )}
                </View>
                <AnimatedIconButton onPress={onClose} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="close" size={16} color={TEXT2} />
                </AnimatedIconButton>
              </View>
            </LinearGradient>

            <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
              {/* Contact */}
              <View style={{ gap: 10 }}>
                <AnimatedPressable
                  onPress={() => pro.phone_number && void Linking.openURL(`tel:${pro.phone_number}`)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER }}
                >
                  <Ionicons name="call-outline" size={18} color={Colors.info} />
                  <Text style={{ fontSize: 14, color: pro.phone_number ? TEXT1 : TEXT3 }}>
                    {pro.phone_number ?? "Non renseigné"}
                  </Text>
                </AnimatedPressable>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BORDER }}>
                  <Ionicons name="mail-outline" size={18} color={Colors.info} />
                  <Text style={{ fontSize: 14, color: TEXT1 }}>{pro.email}</Text>
                </View>
              </View>

              {/* Bio */}
              {pro.bio && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: BORDER }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Bio</Text>
                  <Text style={{ fontSize: 13, color: TEXT2, lineHeight: 20 }}>{pro.bio}</Text>
                </View>
              )}

              {/* Specialties */}
              {(pro.pro_specialties ?? []).length > 0 && (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Spécialités</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {(pro.pro_specialties ?? []).map((s) => (
                      <View key={s} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: `${Colors.pro}18`, borderWidth: 1, borderColor: `${Colors.pro}30` }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.pro }}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Gallery */}
              {gallery.length > 0 && (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Galerie ({gallery.length})</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {gallery.map((img) => (
                      <View key={img.id} style={{ width: 88, height: 88, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="image-outline" size={24} color={TEXT3} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Reject input */}
              {showReject && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.destructive, textTransform: "uppercase", letterSpacing: 0.8 }}>Motif du refus</Text>
                  <TextInput
                    value={rejectReason}
                    onChangeText={(t) => { setRejectReason(t); setRejectError(null); }}
                    placeholder="Ex: Profil incomplet, photos insuffisantes..."
                    placeholderTextColor={TEXT3}
                    multiline
                    numberOfLines={3}
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: `${Colors.destructive}40`, padding: 14, fontSize: 13, color: TEXT1, minHeight: 80, textAlignVertical: "top" }}
                  />
                  {rejectError && <ErrorMessage message={rejectError} />}
                </View>
              )}

              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                {!showReject ? (
                  <>
                    <AnimatedPressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setShowReject(true);
                      }}
                      style={{ flex: 1, height: 50, borderRadius: 15, borderWidth: 1.5, borderColor: Colors.destructive, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={Colors.destructive} />
                      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.destructive }}>Refuser</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                        onApprove();
                      }}
                      style={{ flex: 1, height: 50, borderRadius: 15, backgroundColor: Colors.success, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />
                      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Valider</Text>
                    </AnimatedPressable>
                  </>
                ) : (
                  <>
                    <AnimatedPressable
                      onPress={() => { setShowReject(false); setRejectError(null); setRejectReason(""); }}
                      style={{ flex: 1, height: 50, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "600", color: TEXT2 }}>Annuler</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
                        handleReject();
                      }}
                      style={{ flex: 1, height: 50, borderRadius: 15, backgroundColor: Colors.destructive, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                    >
                      <Ionicons name="send-outline" size={16} color={Colors.white} />
                      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Envoyer</Text>
                    </AnimatedPressable>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ProValidationScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<PendingPro | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-pros-pending"],
    queryFn: () => adminApi.getPros({ status: "pending" }),
  });

  const pros: PendingPro[] = ((data?.data as PendingPro[] | undefined) ?? []);

  const approveMut = useMutation({
    mutationFn: (id: number) => adminApi.approvePro(id),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["admin-pros-pending"] });
    },
    onError: () => setActionError("Impossible de valider ce profil."),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => adminApi.rejectPro(id, { reason }),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["admin-pros-pending"] });
    },
    onError: () => setActionError("Impossible de refuser ce profil."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <Text style={{ fontSize: 30, fontWeight: "900", color: TEXT1, letterSpacing: -0.8, marginBottom: 4 }}>Validation Pros</Text>
        {!isLoading && (
          <Text style={{ fontSize: 12, color: TEXT2 }}>
            {pros.length} profil{pros.length !== 1 ? "s" : ""} en attente
          </Text>
        )}
        {actionError && <View style={{ marginTop: 10 }}><ErrorMessage message={actionError} /></View>}
      </View>

      {isLoading ? (
        <ProSkeleton />
      ) : (
        <FlatList
          data={pros}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 80 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.admin} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title="Aucune validation en attente ✓"
              description="Tous les profils pros ont été traités."
            />
          }
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelected(item); setActionError(null); }}
              style={{ backgroundColor: CARD, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: `${Colors.admin}20`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.admin }}>
                    {item.first_name[0]?.toUpperCase()}{item.last_name[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: TEXT1, marginBottom: 3 }}>{item.first_name} {item.last_name}</Text>
                  <Text style={{ fontSize: 12, color: TEXT2 }}>{item.activity_name ?? item.email}</Text>
                  {item.city && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={10} color={TEXT3} />
                      <Text style={{ fontSize: 11, color: TEXT3 }}>{item.city}</Text>
                    </View>
                  )}
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: `${Colors.warning}18`, borderWidth: 1, borderColor: `${Colors.warning}30` }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.warning }}>EN ATTENTE</Text>
                </View>
              </View>

              {item.phone_number && (
                <AnimatedPressable
                  onPress={() => void Linking.openURL(`tel:${item.phone_number}`)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}
                >
                  <Ionicons name="call-outline" size={13} color={Colors.info} />
                  <Text style={{ fontSize: 12, color: Colors.info }}>{item.phone_number}</Text>
                </AnimatedPressable>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <AnimatedPressable
                  onPress={() => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    setSelected(item);
                  }}
                  style={{ flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: Colors.destructive, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.destructive }}>Refuser</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setActionError(null);
                    approveMut.mutate(item.id);
                  }}
                  disabled={approveMut.isPending}
                  style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: Colors.success, alignItems: "center", justifyContent: "center", opacity: approveMut.isPending ? 0.6 : 1 }}
                >
                  {approveMut.isPending
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.white }}>Valider</Text>}
                </AnimatedPressable>
              </View>
            </AnimatedPressable>
          )}
        />
      )}

      {selected && (
        <ProDetailModal
          pro={selected}
          onClose={() => setSelected(null)}
          onApprove={() => {
            setActionError(null);
            approveMut.mutate(selected.id);
          }}
          onReject={(reason) => rejectMut.mutate({ id: selected.id, reason })}
        />
      )}
    </View>
  );
}
