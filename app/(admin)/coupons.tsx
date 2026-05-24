import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Switch, Share, RefreshControl,
  Animated,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { adminApi, AdminCoupon } from "@/lib/api";

const BG     = "#0B0E14";
const CARD   = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT   = "#F8FAFC";
const MUTED  = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type DiscountType = "percent" | "fixed";
type CouponStatus = "active" | "expired" | "disabled";

const PLAN_OPTS   = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };

const STATUS_CFG: Record<CouponStatus, { label: string; color: string; bg: string }> = {
  active:   { label: "Actif",     color: "#4ADE80", bg: "rgba(74,222,128,0.12)"  },
  expired:  { label: "Expiré",    color: MUTED,     bg: "rgba(255,255,255,0.05)" },
  disabled: { label: "Désactivé", color: "#F87171", bg: "rgba(248,113,113,0.10)" },
};

function parsePlans(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }
  return [];
}

function couponStatus(c: AdminCoupon): CouponStatus {
  if (!c.is_active) return "disabled";
  if (c.expires_at && new Date(c.expires_at) < new Date()) return "expired";
  if (c.max_uses != null && c.used_count >= c.max_uses) return "expired";
  return "active";
}

// ── Create bottom-sheet modal ─────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode]                 = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [plans, setPlans]               = useState<string[]>(["start", "serenite", "signature"]);
  const [expiresAt, setExpiresAt]       = useState("");
  const [maxUses, setMaxUses]           = useState("");

  const translateY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY,     { toValue: 0, damping: 24, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY,     { toValue: 400, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const createMut = useMutation({
    mutationFn: () => adminApi.createCoupon({
      code:             code.trim().toUpperCase(),
      discount_type:    discountType,
      discount_value:   parseFloat(discountValue) || 0,
      applicable_plans: plans,
      expires_at:       expiresAt || undefined,
      max_uses:         maxUses ? parseInt(maxUses) : undefined,
    }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      Alert.alert("Créé !", `Coupon ${code.toUpperCase()} créé avec succès.`);
      close();
    },
    onError: () => Alert.alert("Erreur", "Impossible de créer le coupon."),
  });

  const togglePlan = (p: string) =>
    setPlans((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const generate = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const isValid = code.trim().length > 0 && parseFloat(discountValue) > 0 && plans.length > 0;

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end", opacity: overlayOpacity }}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <Animated.View style={{ backgroundColor: "#131720", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: BORDER, transform: [{ translateY }] }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: "center", marginBottom: 20 }} />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: TEXT }}>Nouveau coupon</Text>
              <Pressable onPress={close} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: CARD, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={MUTED} />
              </Pressable>
            </View>

            {/* Code */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Code</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="EX: BLYSS20" placeholderTextColor={MUTED} autoCapitalize="characters"
                style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, height: 48, fontSize: 17, fontWeight: "900", color: ACCENT, letterSpacing: 2, borderWidth: 1, borderColor: BORDER }} />
              <Pressable onPress={generate} style={{ height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(249,115,22,0.12)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="shuffle-outline" size={20} color={ACCENT} />
              </Pressable>
            </View>

            {/* Type */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Type de réduction</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, backgroundColor: CARD, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: BORDER }}>
              {(["percent", "fixed"] as DiscountType[]).map((t) => {
                const active = discountType === t;
                return (
                  <Pressable key={t} onPress={() => { setDiscountType(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={{ flex: 1, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: active ? ACCENT : "transparent" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#fff" : MUTED }}>
                      {t === "percent" ? "Pourcentage %" : "Montant fixe €"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Value */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Valeur ({discountType === "percent" ? "%" : "€"})
            </Text>
            <TextInput value={discountValue} onChangeText={setDiscountValue} placeholder={discountType === "percent" ? "20" : "5.00"} placeholderTextColor={MUTED} keyboardType="decimal-pad"
              style={{ backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, height: 48, fontSize: 20, fontWeight: "900", color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 20 }} />

            {/* Plans */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Plans concernés</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {PLAN_OPTS.map((p) => {
                const selected = plans.includes(p);
                return (
                  <Pressable key={p} onPress={() => { togglePlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center", borderColor: selected ? ACCENT : BORDER, backgroundColor: selected ? "rgba(249,115,22,0.12)" : CARD }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? ACCENT : MUTED }}>{PLAN_LABELS[p]}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Expiry */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Date expiration (YYYY-MM-DD, optionnel)
            </Text>
            <TextInput value={expiresAt} onChangeText={setExpiresAt} placeholder="2025-12-31" placeholderTextColor={MUTED}
              style={{ backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, height: 48, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 20 }} />

            {/* Max uses */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: MUTED, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Utilisations max (optionnel)
            </Text>
            <TextInput value={maxUses} onChangeText={setMaxUses} placeholder="100" placeholderTextColor={MUTED} keyboardType="number-pad"
              style={{ backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 16, height: 48, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 28 }} />

            <Pressable
              onPress={() => { if (isValid) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); createMut.mutate(); } }}
              disabled={createMut.isPending || !isValid}
              style={{ height: 54, borderRadius: 16, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: (createMut.isPending || !isValid) ? 0.5 : 1 }}
            >
              {createMut.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : (<><Ionicons name="pricetag-outline" size={18} color="#fff" /><Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>Créer le coupon</Text></>)}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Coupon card ───────────────────────────────────────────────────────────────
function CouponCard({
  coupon, index, onToggle, onDelete, onShare,
}: {
  coupon: AdminCoupon & { applicable_plans: string[] };
  index: number;
  onToggle: (id: number, active: boolean) => void;
  onDelete: (c: AdminCoupon) => void;
  onShare:  (code: string) => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 55),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const st    = couponStatus(coupon);
  const stCfg = STATUS_CFG[st];
  const usedCount = coupon.used_count ?? 0;
  const progress  = coupon.max_uses != null && coupon.max_uses > 0 ? Math.min(usedCount / coupon.max_uses, 1) : null;

  return (
    <Animated.View style={{
      backgroundColor: CARD, borderRadius: 20, borderWidth: 1,
      borderColor: st === "active" ? "rgba(74,222,128,0.2)" : BORDER,
      overflow: "hidden", marginBottom: 12,
      opacity, transform: [{ translateY }],
    }}>
      <View style={{ padding: 18 }}>
        {/* Top row: code + toggle */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onShare(coupon.code); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: ACCENT, letterSpacing: 2 }}>{coupon.code}</Text>
            <Ionicons name="copy-outline" size={14} color={MUTED} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: stCfg.bg }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: stCfg.color, letterSpacing: 0.5 }}>{stCfg.label}</Text>
            </View>
            <Switch
              value={coupon.is_active}
              onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onToggle(coupon.id, v); }}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(249,115,22,0.5)" }}
              thumbColor={coupon.is_active ? ACCENT : "rgba(255,255,255,0.4)"}
              ios_backgroundColor="rgba(255,255,255,0.1)"
            />
          </View>
        </View>

        {/* Discount + plans */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.15)", borderWidth: 1, borderColor: "rgba(249,115,22,0.25)" }}>
            <Text style={{ fontSize: 15, fontWeight: "900", color: ACCENT }}>
              -{coupon.discount_value}{coupon.discount_type === "percent" ? "%" : "€"}
            </Text>
          </View>
          {coupon.applicable_plans.map((p: string) => (
            <View key={p} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: MUTED }}>{PLAN_LABELS[p] ?? p}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: MUTED }}>Utilisations</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT }}>{usedCount} / {coupon.max_uses}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${progress * 100}%` as any,
                backgroundColor: progress >= 1 ? "#F87171" : progress >= 0.8 ? "#FBBF24" : "#4ADE80" }} />
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            {progress === null && <Text style={{ fontSize: 11, color: MUTED }}>{usedCount} utilisation{usedCount > 1 ? "s" : ""}</Text>}
            {coupon.expires_at ? (
              <Text style={{ fontSize: 11, color: new Date(coupon.expires_at) < new Date() ? "#F87171" : MUTED }}>
                Expire · {new Date(coupon.expires_at).toLocaleDateString("fr-FR")}
              </Text>
            ) : (
              <Text style={{ fontSize: 11, color: MUTED }}>Pas d'expiration</Text>
            )}
          </View>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onDelete(coupon); }}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(248,113,113,0.10)", borderWidth: 1, borderColor: "rgba(248,113,113,0.18)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="trash-outline" size={16} color="#F87171" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminCouponsScreen() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const [showCreate, setShowCreate]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");
  const [refreshing, setRefreshing]     = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn:  () => adminApi.getCoupons(),
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteCoupon(id),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: () => Alert.alert("Erreur", "Suppression impossible."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => adminApi.toggleCoupon(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const raw     = (data?.data as AdminCoupon[] | undefined) ?? [];
  const coupons = raw.map((c) => ({ ...c, applicable_plans: parsePlans(c.applicable_plans) }));
  const filtered = statusFilter === "all" ? coupons : coupons.filter((c) => couponStatus(c) === statusFilter);

  const handleShare  = async (code: string) => { await Share.share({ message: code, title: `Coupon ${code}` }); };
  const handleDelete = (c: AdminCoupon) =>
    Alert.alert("Supprimer", `Supprimer le coupon ${c.code} ? Cette action est irréversible.`, [
      { text: "Annuler",   style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate(c.id) },
    ]);

  const STATUS_FILTERS = [
    { key: "all"      as const, label: "Tous",       color: ACCENT },
    { key: "active"   as const, label: "Actifs",     color: "#4ADE80" },
    { key: "expired"  as const, label: "Expirés",    color: MUTED },
    { key: "disabled" as const, label: "Désactivés", color: "#F87171" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Filter strip */}
      <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <Pressable key={f.key}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatusFilter(f.key); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: active ? f.color : CARD, borderColor: active ? f.color : BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : MUTED }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="pricetag-outline" size={32} color="rgba(255,255,255,0.15)" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 6 }}>Aucun coupon</Text>
              <Text style={{ fontSize: 13, color: MUTED }}>
                {statusFilter === "all" ? "Créez votre premier coupon avec le bouton +." : "Rien à afficher pour ce filtre."}
              </Text>
            </View>
          ) : (
            filtered.map((c, i) => (
              <CouponCard key={c.id} coupon={c} index={i}
                onToggle={(id, active) => toggleMut.mutate({ id, active })}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setShowCreate(true); }}
        style={({ pressed }) => [{
          position: "absolute", bottom: insets.bottom + 24, right: 24,
          width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT,
          alignItems: "center", justifyContent: "center",
          shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 12,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        }]}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </View>
  );
}
