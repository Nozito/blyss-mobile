import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  StyleSheet,
  TextInput,
} from "react-native";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useStripe,
  CardField,
  type CardFieldInput,
} from "@stripe/stripe-react-native";
import { paymentMethodsApi, type SavedCard } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";

const BRAND_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  visa:       "card-outline",
  mastercard: "card-outline",
  amex:       "card-outline",
};

const BRAND_COLORS: Record<string, string> = {
  visa:       "#1A1F71",
  mastercard: "#EB001B",
  amex:       "#007BC1",
};

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { confirmSetupIntent } = useStripe();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [cardholderName, setCardholderName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedCard | null>(null);

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodsApi.getAll(),
    staleTime: 30_000,
  });

  const cards = (data?.data as SavedCard[] | undefined) ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => paymentMethodsApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["payment-methods"] });
      const prev = qc.getQueryData(["payment-methods"]);
      qc.setQueryData(["payment-methods"], (old: unknown) => {
        const o = old as { data?: SavedCard[] } | undefined;
        return { ...o, data: (o?.data ?? []).filter((c) => c.id !== id) };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      qc.setQueryData(["payment-methods"], ctx?.prev);
      setListError("Impossible de supprimer la carte.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => paymentMethodsApi.setDefault(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["payment-methods"] });
      const prev = qc.getQueryData(["payment-methods"]);
      qc.setQueryData(["payment-methods"], (old: unknown) => {
        const o = old as { data?: SavedCard[] } | undefined;
        return { ...o, data: (o?.data ?? []).map((c) => ({ ...c, is_default: c.id === id })) };
      });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      qc.setQueryData(["payment-methods"], ctx?.prev);
      setListError("Impossible de changer la carte par défaut.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });

  // ── Ajout carte via Stripe SetupIntent ────────────────────────────────────
  const handleAddCard = useCallback(async () => {
    setCardError(null);
    if (!cardDetails?.complete) {
      setCardError("Remplis tous les champs de la carte.");
      return;
    }
    setAddLoading(true);
    try {
      const { clientSecret } = await paymentMethodsApi.createSetupIntent();

      const { setupIntent, error } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: "Card",
        paymentMethodData: {
          billingDetails: { name: cardholderName || undefined },
        },
      });

      if (error) {
        setCardError(error.localizedMessage ?? error.message);
        return;
      }

      if (setupIntent?.status === "Succeeded") {
        await paymentMethodsApi.confirmSetup(setupIntent.paymentMethodId ?? "");
        qc.invalidateQueries({ queryKey: ["payment-methods"] });
        setAddModalOpen(false);
        setCardDetails(null);
        setCardholderName("");
      }
    } catch {
      setCardError("Réessaie dans quelques instants.");
    } finally {
      setAddLoading(false);
    }
  }, [cardDetails, cardholderName, confirmSetupIntent, qc]);

  const confirmDelete = useCallback((item: SavedCard) => {
    setListError(null);
    setDeleteTarget(item);
  }, []);

  // ── Render carte ──────────────────────────────────────────────────────────
  const renderCard = useCallback(({ item }: { item: SavedCard }) => {
    const brandColor = BRAND_COLORS[item.brand] ?? Colors.primary;
    const isDeleting = deleteMutation.isPending && deleteMutation.variables === item.id;
    const isSettingDefault = setDefaultMutation.isPending && setDefaultMutation.variables === item.id;

    return (
      <Card elevated style={styles.cardRow}>
        <View style={[styles.brandBar, { backgroundColor: brandColor }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Ionicons name={BRAND_ICONS[item.brand] ?? "card-outline"} size={28} color={brandColor} />
            <View style={{ marginLeft: 12 }}>
              <View style={styles.cardTitle}>
                <Text style={styles.cardNumber}>
                  {item.brand.toUpperCase()} •••• {item.last4}
                </Text>
                {item.is_default && <Badge variant="default" size="sm">Par défaut</Badge>}
              </View>
              <Text style={styles.cardMeta}>
                {item.cardholder_name ? `${item.cardholder_name} — ` : ""}
                Expire {item.exp_month}/{item.exp_year}
              </Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            {!item.is_default && (
              <Pressable onPress={() => setDefaultMutation.mutate(item.id)} style={styles.actionBtn} disabled={isSettingDefault}>
                {isSettingDefault
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Ionicons name="checkmark-circle-outline" size={22} color={Colors.primary} />}
              </Pressable>
            )}
            <Pressable onPress={() => confirmDelete(item)} style={styles.actionBtn} disabled={isDeleting}>
              {isDeleting
                ? <ActivityIndicator size="small" color={Colors.destructive} />
                : <Ionicons name="trash-outline" size={22} color={Colors.destructive} />}
            </Pressable>
          </View>
        </View>
      </Card>
    );
  }, [deleteMutation, setDefaultMutation, confirmDelete]);

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <AnimatedIconButton onPress={() => router.push("/(client)/(profile)")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.foreground} />
        </AnimatedIconButton>
        <Text style={styles.title}>Moyens de paiement</Text>
        <Pressable onPress={() => setAddModalOpen(true)} style={styles.addBtn} accessibilityLabel="Ajouter une carte">
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </Pressable>
      </View>

      {listError && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <ErrorMessage message={listError} />
        </View>
      )}

      {/* Liste */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={56} color={Colors.border} />
              <Text style={styles.emptyTitle}>Aucune carte enregistrée</Text>
              <Text style={styles.emptySubtitle}>
                Ajoute une carte pour payer tes réservations en un tap
              </Text>
              <Pressable onPress={() => setAddModalOpen(true)} style={styles.emptyBtn}>
                <View style={styles.emptyBtnInner}>
                  <Ionicons name="add" size={18} color={Colors.white} />
                  <Text style={styles.emptyBtnText}>Ajouter une carte</Text>
                </View>
              </Pressable>
            </View>
          }
          renderItem={renderCard}
        />
      )}

      {/* Badge sécurité */}
      <View style={[styles.securityBadge, { marginBottom: insets.bottom + 8 }]}>
        <Ionicons name="lock-closed" size={13} color={Colors.mutedForeground} />
        <Text style={styles.securityText}>Paiements sécurisés par Stripe · Données chiffrées TLS 1.3</Text>
      </View>

      {/* Modal confirmation suppression */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: Colors.overlayDark, justifyContent: "flex-end", padding: 16 }}>
          <View style={{ backgroundColor: Colors.white, borderRadius: 24, padding: 24, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="trash-outline" size={20} color={Colors.destructiveText} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.foreground }}>Supprimer la carte</Text>
            </View>
            {deleteTarget && (
              <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>
                {`Supprimer ${deleteTarget.brand.toUpperCase()} •••• ${deleteTarget.last4} ?`}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); } }}
                style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: Colors.destructiveText, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.white }}>Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal ajout carte */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddModalOpen(false)}
      >
        <View style={[styles.modal, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ajouter une carte</Text>
            <Pressable onPress={() => setAddModalOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
            <Text style={styles.securityNoticeText}>
              Ton numéro de carte n'est jamais stocké sur nos serveurs. Il est chiffré et envoyé directement à Stripe.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Nom sur la carte</Text>
          <TextInput
            value={cardholderName}
            onChangeText={setCardholderName}
            placeholder="Jean Dupont"
            placeholderTextColor={Colors.mutedForeground}
            autoCapitalize="words"
            style={styles.nameInput}
          />

          <Text style={styles.fieldLabel}>Informations de carte</Text>
          <CardField
            postalCodeEnabled={false}
            placeholders={{ number: "1234 5678 9012 3456" }}
            cardStyle={{
              backgroundColor: "#f9f8f5",
              textColor: Colors.foreground,
              borderColor: "#e5e7eb",
              borderWidth: 1,
              borderRadius: 12,
              fontSize: 16,
            }}
            style={styles.cardField}
            onCardChange={(details) => setCardDetails(details)}
          />

          {cardError && (
            <View style={{ marginBottom: 12 }}>
              <ErrorMessage message={cardError} />
            </View>
          )}

          <Pressable
            onPress={handleAddCard}
            disabled={addLoading || !cardDetails?.complete}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <View style={[styles.confirmBtn, { opacity: !cardDetails?.complete ? 0.5 : 1 }]}>
              {addLoading
                ? <ActivityIndicator color={Colors.white} />
                : <>
                    <Ionicons name="lock-closed" size={16} color={Colors.white} />
                    <Text style={styles.confirmBtnText}>Ajouter la carte</Text>
                  </>}
            </View>
          </Pressable>

          <View style={styles.stripeBadge}>
            <Ionicons name="lock-closed" size={12} color={Colors.mutedForeground} />
            <Text style={styles.stripeBadgeText}>Propulsé par Stripe · PCI-DSS Level 1</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:                { flex: 1, backgroundColor: "#FFF5F8" },
  header:              { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  backBtn:             { padding: 4, marginRight: 8 },
  title:               { flex: 1, fontSize: 22, fontWeight: "700", color: Colors.foreground },
  addBtn:              { padding: 4 },
  cardRow:             { marginBottom: 12, overflow: "hidden", flexDirection: "row" },
  brandBar:            { width: 4, borderRadius: 2 },
  cardContent:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  cardInfo:            { flexDirection: "row", alignItems: "center", flex: 1 },
  cardTitle:           { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  cardNumber:          { fontSize: 15, fontWeight: "600", color: Colors.foreground },
  cardMeta:            { fontSize: 13, color: Colors.mutedForeground },
  cardActions:         { flexDirection: "row", gap: 4 },
  actionBtn:           { padding: 8, borderRadius: 8 },
  empty:               { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle:          { fontSize: 18, fontWeight: "700", color: Colors.foreground, marginTop: 16, marginBottom: 8 },
  emptySubtitle:       { fontSize: 14, color: Colors.mutedForeground, textAlign: "center", lineHeight: 20 },
  emptyBtn:            { marginTop: 24 },
  emptyBtnInner:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 32 },
  emptyBtnText:        { color: Colors.white, fontSize: 15, fontWeight: "700" },
  securityBadge:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingBottom: 4 },
  securityText:        { fontSize: 11, color: Colors.mutedForeground },
  modal:               { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24 },
  modalHeader:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  modalTitle:          { fontSize: 20, fontWeight: "700", color: Colors.foreground },
  closeBtn:            { padding: 4 },
  securityNotice:      { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.successLight, borderRadius: 10, padding: 12, marginBottom: 24 },
  securityNoticeText:  { flex: 1, fontSize: 13, color: "#166534", lineHeight: 18 },
  fieldLabel:          { fontSize: 14, fontWeight: "600", color: Colors.foreground, marginBottom: 8 },
  nameInput:           { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#f9f8f5", fontSize: 16, color: Colors.foreground, marginBottom: 16 },
  cardField:           { height: 52, marginBottom: 28 },
  confirmBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, borderRadius: 32, paddingVertical: 16, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  confirmBtnText:      { color: Colors.white, fontSize: 16, fontWeight: "700" },
  stripeBadge:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 16 },
  stripeBadgeText:     { fontSize: 11, color: Colors.mutedForeground },
});
