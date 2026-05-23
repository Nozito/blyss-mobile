import React, { useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, Modal, Switch,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Share } from "react-native";
import { adminApi } from "@/lib/api";
import { useRouter } from "expo-router";

const BG = "#0B0E14";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.09)";
const TEXT = "#F8FAFC";
const MUTED = "rgba(248,250,252,0.45)";
const ACCENT = "#F97316";

type DiscountType = "percent" | "fixed";
type CouponStatus = "active" | "expired" | "disabled";

interface Coupon {
  id: number; code: string; discount_type: DiscountType; discount_value: number;
  applicable_plans: string[]; expires_at?: string | null; max_uses?: number | null;
  uses_count: number; is_active: boolean; created_at: string;
}

const PLAN_OPTS = ["start", "serenite", "signature"] as const;
const PLAN_LABELS: Record<string, string> = { start: "Start", serenite: "Sérénité", signature: "Signature" };

function couponStatus(c: Coupon): CouponStatus {
  if (!c.is_active) return "disabled";
  if (c.expires_at && new Date(c.expires_at) < new Date()) return "expired";
  if (c.max_uses != null && c.uses_count >= c.max_uses) return "expired";
  return "active";
}

const STATUS_CFG: Record<CouponStatus, { label: string; color: string; bg: string }> = {
  active:   { label: "Actif",    color: "#4ADE80", bg: "rgba(74,222,128,0.12)" },
  expired:  { label: "Expiré",   color: MUTED,     bg: "rgba(255,255,255,0.05)" },
  disabled: { label: "Désactivé",color: "#F87171", bg: "rgba(248,113,113,0.10)" },
};

// ── Create modal ─────────────────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [plans, setPlans] = useState<string[]>(["start", "serenite", "signature"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const createMut = useMutation({
    mutationFn: () => adminApi.createCoupon({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 0,
      applicable_plans: plans,
      expires_at: expiresAt || undefined,
      max_uses: maxUses ? parseInt(maxUses) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      Alert.alert("✅ Créé", `Coupon ${code.toUpperCase()} créé avec succès.`);
      onClose();
    },
    onError: () => Alert.alert("Erreur", "Impossible de créer le coupon."),
  });

  const togglePlan = (p: string) =>
    setPlans((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const generate = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
        <ScrollView
          style={{ backgroundColor: "#131720", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: BORDER }}
          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          onStartShouldSetResponder={() => true}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: TEXT }}>Nouveau coupon</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={MUTED} /></Pressable>
          </View>

          {/* Code */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Code</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <TextInput
              value={code} onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="EX: BLYSS20"
              placeholderTextColor={MUTED}
              autoCapitalize="characters"
              style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, height: 46, fontSize: 15, fontWeight: "700", color: ACCENT, letterSpacing: 1, borderWidth: 1, borderColor: BORDER }}
            />
            <Pressable onPress={generate} style={{ height: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(249,115,22,0.12)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="shuffle-outline" size={18} color={ACCENT} />
            </Pressable>
          </View>

          {/* Type */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Type de réduction</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
            {(["percent", "fixed"] as DiscountType[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setDiscountType(t)}
                style={{ flex: 1, height: 44, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center",
                  borderColor: discountType === t ? ACCENT : BORDER,
                  backgroundColor: discountType === t ? "rgba(249,115,22,0.12)" : CARD }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: discountType === t ? ACCENT : MUTED }}>
                  {t === "percent" ? "Pourcentage (%)" : "Montant fixe (€)"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Value */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Valeur ({discountType === "percent" ? "%" : "€"})
          </Text>
          <TextInput
            value={discountValue} onChangeText={setDiscountValue}
            placeholder={discountType === "percent" ? "20" : "5.00"}
            placeholderTextColor={MUTED}
            keyboardType="decimal-pad"
            style={{ backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, height: 46, fontSize: 16, fontWeight: "700", color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 18 }}
          />

          {/* Plans */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Plans concernés</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
            {PLAN_OPTS.map((p) => {
              const selected = plans.includes(p);
              return (
                <Pressable
                  key={p}
                  onPress={() => togglePlan(p)}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: "center",
                    borderColor: selected ? ACCENT : BORDER,
                    backgroundColor: selected ? "rgba(249,115,22,0.12)" : CARD }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: selected ? ACCENT : MUTED }}>{PLAN_LABELS[p]}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Expiry */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Date expiration (YYYY-MM-DD, optionnel)
          </Text>
          <TextInput
            value={expiresAt} onChangeText={setExpiresAt}
            placeholder="2025-12-31"
            placeholderTextColor={MUTED}
            style={{ backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, height: 46, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 18 }}
          />

          {/* Max uses */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Utilisations max (optionnel)
          </Text>
          <TextInput
            value={maxUses} onChangeText={setMaxUses}
            placeholder="100"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            style={{ backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, height: 46, fontSize: 14, color: TEXT, borderWidth: 1, borderColor: BORDER, marginBottom: 24 }}
          />

          <Pressable
            onPress={() => createMut.mutate()}
            disabled={createMut.isPending || !code.trim() || !discountValue || plans.length === 0}
            style={{ height: 52, borderRadius: 16, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
              opacity: (createMut.isPending || !code.trim() || !discountValue || plans.length === 0) ? 0.5 : 1 }}
          >
            {createMut.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="pricetag-outline" size={18} color="#fff" /><Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Créer le coupon</Text></>}
          </Pressable>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminCouponsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => adminApi.getCoupons(),
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.deleteCoupon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
    onError: () => Alert.alert("Erreur", "Suppression impossible."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => adminApi.toggleCoupon(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const coupons = (data?.data as Coupon[] | undefined) ?? [];
  const filtered = statusFilter === "all" ? coupons : coupons.filter((c) => couponStatus(c) === statusFilter);

  const copyCode = async (code: string) => {
    await Share.share({ message: code, title: `Coupon ${code}` });
  };

  const confirmDelete = (c: Coupon) =>
    Alert.alert("Supprimer", `Supprimer le coupon ${c.code} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteMut.mutate(c.id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="chevron-back" size={20} color={TEXT} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: TEXT, letterSpacing: -0.5 }}>Coupons</Text>
            <Text style={{ fontSize: 12, color: MUTED }}>{coupons.length} coupon(s)</Text>
          </View>
          <Pressable
            onPress={() => setShowCreate(true)}
            style={{ height: 40, paddingHorizontal: 16, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Créer</Text>
          </Pressable>
        </View>

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
          {(["all", "active", "expired", "disabled"] as const).map((f) => {
            const cfg = f !== "all" ? STATUS_CFG[f] : null;
            const active = statusFilter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setStatusFilter(f)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                  backgroundColor: active ? (cfg?.color ?? ACCENT) : CARD,
                  borderColor: active ? (cfg?.color ?? ACCENT) : BORDER }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? (f === "active" ? "#000" : "#fff") : MUTED }}>
                  {f === "all" ? "Tous" : cfg?.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <Ionicons name="pricetag-outline" size={48} color="rgba(255,255,255,0.08)" />
            <Text style={{ fontSize: 14, color: MUTED, marginTop: 12 }}>Aucun coupon</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filtered.map((c) => {
              const st = couponStatus(c);
              const stCfg = STATUS_CFG[st];
              return (
                <View key={c.id} style={{ backgroundColor: CARD, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: st === "active" ? "rgba(74,222,128,0.2)" : BORDER }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    {/* Code */}
                    <Pressable onPress={() => copyCode(c.code)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18, fontWeight: "900", color: ACCENT, letterSpacing: 1 }}>{c.code}</Text>
                      <Ionicons name="copy-outline" size={14} color={MUTED} />
                    </Pressable>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: stCfg.bg }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: stCfg.color }}>{stCfg.label}</Text>
                      </View>
                      <Switch
                        value={c.is_active}
                        onValueChange={(v) => toggleMut.mutate({ id: c.id, active: v })}
                        trackColor={{ false: "rgba(255,255,255,0.1)", true: "rgba(249,115,22,0.5)" }}
                        thumbColor={c.is_active ? ACCENT : "rgba(255,255,255,0.4)"}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.12)" }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: ACCENT }}>
                        -{c.discount_value}{c.discount_type === "percent" ? "%" : "€"}
                      </Text>
                    </View>
                    {c.applicable_plans.map((p) => (
                      <View key={p} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: MUTED }}>{PLAN_LABELS[p] ?? p}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ gap: 3 }}>
                      <Text style={{ fontSize: 11, color: MUTED }}>
                        Utilisations : {c.uses_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}
                      </Text>
                      {c.expires_at && (
                        <Text style={{ fontSize: 11, color: MUTED }}>
                          Expire : {new Date(c.expires_at).toLocaleDateString("fr-FR")}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => confirmDelete(c)}
                      style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(248,113,113,0.10)", alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#F87171" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
    </View>
  );
}
