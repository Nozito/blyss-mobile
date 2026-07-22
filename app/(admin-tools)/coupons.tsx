import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Modal, Switch, Share, RefreshControl,
  Animated, Platform,
} from "react-native";
import { useActionSheet } from "@/components/ui/ActionSheet";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { adminApi, AdminCoupon } from "@/lib/api";
import { Colors } from "@/constants/colors";
import { ADMIN } from "@/constants/adminTheme";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { safeBack } from "@/lib/navigation";
import { AnimatedPressable, AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const BG     = ADMIN.bg;
const CARD   = "rgba(255,255,255,0.05)";
const BORDER = ADMIN.border;
const TEXT1  = Colors.white;
const TEXT2  = "rgba(255,255,255,0.5)";
const TEXT3  = "rgba(255,255,255,0.28)";
const MUTED  = "rgba(255,255,255,0.07)";

type DiscountType = "percent" | "fixed";
type CouponStatus = "active" | "expired" | "disabled";

const PLAN_OPTS   = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };

const STATUS_CFG: Record<CouponStatus, { label: string; color: string }> = {
  active:   { label: "Actif",     color: Colors.success },
  expired:  { label: "Expiré",    color: TEXT2 },
  disabled: { label: "Désactivé", color: Colors.destructive },
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

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode]                   = useState("");
  const [discountType, setDiscountType]   = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [plans, setPlans]                 = useState<string[]>(["start", "serenite", "signature"]);
  const [expiresAt, setExpiresAt]         = useState("");
  const [maxUses, setMaxUses]             = useState("");
  const [createError, setCreateError]     = useState<string | null>(null);

  const translateY     = useRef(new Animated.Value(600)).current;
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
      close();
    },
    onError: () => setCreateError("Impossible de créer le coupon."),
  });

  const togglePlan = (p: string) =>
    setPlans((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const generate = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const isValid = code.trim().length > 0 && parseFloat(discountValue) > 0 && plans.length > 0;

  const inputStyle = {
    backgroundColor: MUTED, borderRadius: 14, paddingHorizontal: 16,
    height: 48, fontSize: 14, color: TEXT1, borderWidth: 1, borderColor: BORDER,
  } as const;

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end", opacity: overlayOpacity }}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <Animated.View style={{
          backgroundColor: "#111118", borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderTopWidth: 1, borderTopColor: BORDER,
          transform: [{ translateY }],
        }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: "center", marginBottom: 20 }} />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: TEXT1 }}>Nouveau coupon</Text>
              <AnimatedIconButton onPress={close} accessibilityLabel="Fermer" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: MUTED, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={TEXT2} />
              </AnimatedIconButton>
            </View>

            <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Code</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="EX: BLYSS20"
                placeholderTextColor={TEXT3}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ flex: 1, backgroundColor: MUTED, borderRadius: 14, paddingHorizontal: 16, height: 48, fontSize: 17, fontWeight: "900", color: ADMIN.accent, letterSpacing: 2, borderWidth: 1, borderColor: BORDER, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}
              />
              <AnimatedIconButton onPress={generate} accessibilityLabel="Générer un code aléatoire" style={{ height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: `${ADMIN.accent}15`, borderWidth: 1, borderColor: `${ADMIN.accent}35`, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="shuffle-outline" size={20} color={ADMIN.accent} />
              </AnimatedIconButton>
            </View>

            <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Type de réduction</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, backgroundColor: MUTED, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: BORDER }}>
              {(["percent", "fixed"] as DiscountType[]).map((t) => {
                const active = discountType === t;
                return (
                  <AnimatedPressable key={t}
                    onPress={() => { setDiscountType(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={{ flex: 1, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: active ? ADMIN.accent : "transparent" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: active ? Colors.white : TEXT2 }}>
                      {t === "percent" ? "Pourcentage %" : "Montant fixe €"}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Valeur ({discountType === "percent" ? "%" : "€"})
            </Text>
            <TextInput
              value={discountValue}
              onChangeText={setDiscountValue}
              placeholder={discountType === "percent" ? "20" : "5.00"}
              placeholderTextColor={TEXT3}
              keyboardType="decimal-pad"
              style={[inputStyle, { fontSize: 20, fontWeight: "900", marginBottom: 20 }]}
            />

            <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Plans concernés</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {PLAN_OPTS.map((p) => {
                const selected = plans.includes(p);
                return (
                  <AnimatedPressable key={p}
                    onPress={() => { togglePlan(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: "center", borderColor: selected ? ADMIN.accent : BORDER, backgroundColor: selected ? `${ADMIN.accent}15` : MUTED }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? ADMIN.accent : TEXT2 }}>{PLAN_LABELS[p]}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>

            <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Date expiration (YYYY-MM-DD, optionnel)
            </Text>
            <TextInput value={expiresAt} onChangeText={setExpiresAt} placeholder="2025-12-31" placeholderTextColor={TEXT3} style={[inputStyle, { marginBottom: 20 }]} />

            <Text style={{ fontSize: 10, fontWeight: "800", color: TEXT3, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Utilisations max (optionnel)
            </Text>
            <TextInput value={maxUses} onChangeText={setMaxUses} placeholder="100" placeholderTextColor={TEXT3} keyboardType="number-pad" style={[inputStyle, { marginBottom: 28 }]} />

            {createError && <View style={{ marginBottom: 12 }}><ErrorMessage message={createError} /></View>}

            <AnimatedPressable
              onPress={() => { if (isValid) { setCreateError(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); createMut.mutate(); } }}
              disabled={createMut.isPending || !isValid}
              style={{ height: 54, borderRadius: 16, backgroundColor: ADMIN.accent, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: (createMut.isPending || !isValid) ? 0.4 : 1 }}
            >
              {createMut.isPending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : (<><Ionicons name="pricetag-outline" size={18} color={Colors.white} /><Text style={{ fontSize: 15, fontWeight: "800", color: Colors.white }}>Créer le coupon</Text></>)}
            </AnimatedPressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Coupon Card ───────────────────────────────────────────────────────────────
function CouponCard({
  coupon, index, onToggle, onDelete, onShare, onLongPress,
}: {
  coupon: AdminCoupon & { applicable_plans: string[] };
  index: number;
  onToggle: (id: number, active: boolean) => void;
  onDelete: (c: AdminCoupon) => void;
  onShare:  (code: string) => void;
  onLongPress: (c: AdminCoupon) => void;
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
      backgroundColor: CARD, borderRadius: 16, borderWidth: 1,
      borderColor: st === "active" ? `${Colors.success}30` : BORDER,
      overflow: "hidden", marginBottom: 12,
      shadowColor: Colors.black, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 3,
      opacity, transform: [{ translateY }],
    }}>
      <AnimatedPressable
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}); onLongPress(coupon); }}
        delayLongPress={350}
        style={{ padding: 18 }}
      >
        {/* Top row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <AnimatedPressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onShare(coupon.code); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: ADMIN.accent, letterSpacing: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
              {coupon.code}
            </Text>
            <Ionicons name="copy-outline" size={14} color={TEXT2} />
          </AnimatedPressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, backgroundColor: `${stCfg.color}18` }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: stCfg.color, letterSpacing: 0.5 }}>{stCfg.label}</Text>
            </View>
            <Switch
              value={coupon.is_active}
              onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onToggle(coupon.id, v); }}
              trackColor={{ false: BORDER, true: ADMIN.accent }}
              thumbColor={Colors.white}
              ios_backgroundColor={BORDER}
            />
          </View>
        </View>

        {/* Discount + plans */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: `${ADMIN.accent}18`, borderWidth: 1, borderColor: `${ADMIN.accent}30` }}>
            <Text style={{ fontSize: 15, fontWeight: "900", color: ADMIN.accent }}>
              -{coupon.discount_value}{coupon.discount_type === "percent" ? "%" : "€"}
            </Text>
          </View>
          {coupon.applicable_plans.map((p: string) => (
            <View key={p} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: MUTED, borderWidth: 1, borderColor: BORDER }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: TEXT2 }}>{PLAN_LABELS[p] ?? p}</Text>
            </View>
          ))}
        </View>

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: TEXT2 }}>Utilisations</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: TEXT1 }}>{usedCount} / {coupon.max_uses}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: MUTED, overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${progress * 100}%` as any,
                backgroundColor: progress >= 1 ? Colors.destructive : progress >= 0.8 ? Colors.warning : Colors.success }} />
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 2 }}>
            {progress === null && <Text style={{ fontSize: 11, color: TEXT2 }}>{usedCount} utilisation{usedCount > 1 ? "s" : ""}</Text>}
            {coupon.expires_at ? (
              <Text style={{ fontSize: 11, color: new Date(coupon.expires_at) < new Date() ? Colors.destructive : TEXT2 }}>
                Expire · {new Date(coupon.expires_at).toLocaleDateString("fr-FR")}
              </Text>
            ) : (
              <Text style={{ fontSize: 11, color: TEXT2 }}>Pas d'expiration</Text>
            )}
          </View>
          <AnimatedIconButton
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onDelete(coupon); }}
            accessibilityLabel="Supprimer le coupon"
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.destructive}12`, borderWidth: 1, borderColor: `${Colors.destructive}28`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
          </AnimatedIconButton>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AdminCouponsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc     = useQueryClient();
  const [showCreate, setShowCreate]     = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");
  const [refreshing, setRefreshing]     = useState(false);
  const [couponError, setCouponError]   = useState<string | null>(null);
  const showActionSheet = useActionSheet();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn:  () => adminApi.getCoupons(),
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteCoupon(id),
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: () => setCouponError("Suppression impossible."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => adminApi.toggleCoupon(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const raw     = (data?.data as AdminCoupon[] | undefined) ?? [];
  const coupons = raw.map((c) => ({ ...c, applicable_plans: parsePlans(c.applicable_plans) }));
  const filtered = statusFilter === "all" ? coupons : coupons.filter((c) => couponStatus(c) === statusFilter);

  const handleShare  = async (code: string) => { await Share.share({ message: code, title: `Coupon ${code}` }); };
  const handleDelete = (c: AdminCoupon) => {
    setCouponError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    deleteMut.mutate(c.id);
  };

  const handleCouponLongPress = useCallback((coupon: AdminCoupon) => {
    const isActive = coupon.is_active;
    showActionSheet(
      { title: coupon.code, options: ["Annuler", "📋  Copier le code", isActive ? "⛔  Désactiver" : "✅  Activer", "🗑  Supprimer"], cancelButtonIndex: 0, destructiveButtonIndex: 3 },
      async (idx) => {
        if (idx === 1) { await Share.share({ message: coupon.code }); }
        else if (idx === 2) { toggleMut.mutate({ id: coupon.id, active: !isActive }); }
        else if (idx === 3) { handleDelete(coupon); }
      }
    );
  }, [toggleMut]);

  const STATUS_FILTERS = [
    { key: "all"      as const, label: "Tous",       color: ADMIN.accent },
    { key: "active"   as const, label: "Actifs",     color: Colors.success },
    { key: "expired"  as const, label: "Expirés",    color: TEXT2 },
    { key: "disabled" as const, label: "Désactivés", color: Colors.destructive },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <AnimatedPressable
          onPress={() => safeBack(router)}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 }}
        >
          {Platform.OS === "ios"
            ? <SymbolView name="chevron.left" size={16} tintColor={ADMIN.accent} />
            : <Ionicons name="chevron-back" size={18} color={ADMIN.accent} />}
          <Text style={{ fontSize: 15, fontWeight: "700", color: ADMIN.accent }}>Retour</Text>
        </AnimatedPressable>
        <Text style={{ fontSize: 28, fontWeight: "900", color: TEXT1, letterSpacing: -0.5, marginBottom: couponError ? 8 : 10 }}>Coupons</Text>
        {couponError && <View style={{ marginBottom: 8 }}><ErrorMessage message={couponError} /></View>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <AnimatedPressable key={f.key}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setStatusFilter(f.key); }}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? `${f.color}20` : MUTED, borderColor: active ? f.color : BORDER }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? f.color : TEXT2 }}>{f.label}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={ADMIN.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN.accent} />}
        >
          {filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="pricetag-outline" size={32} color={TEXT3} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 6 }}>Aucun coupon</Text>
              <Text style={{ fontSize: 13, color: TEXT2 }}>
                {statusFilter === "all" ? "Créez votre premier coupon avec le bouton +." : "Rien à afficher pour ce filtre."}
              </Text>
            </View>
          ) : (
            filtered.map((c, i) => (
              <CouponCard key={c.id} coupon={c} index={i}
                onToggle={(id, active) => toggleMut.mutate({ id, active })}
                onDelete={handleDelete}
                onShare={handleShare}
                onLongPress={handleCouponLongPress}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── FAB ── */}
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); setShowCreate(true); }}
        style={({ pressed }) => [{
          position: "absolute", bottom: insets.bottom + 20, right: 16,
          borderRadius: 28, overflow: "hidden",
          shadowColor: ADMIN.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        }]}
      >
        <LinearGradient
          colors={["#EA6000", Colors.admin]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={{ color: Colors.white, fontWeight: "800", fontSize: 14 }}>Nouveau coupon</Text>
        </LinearGradient>
      </Pressable>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </View>
  );
}
