import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { withAlpha } from "@/constants/colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { formatDuration } from "@/lib/dateUtils";

interface Props {
  prestationName: string;
  prestationPrice: number;
  prestationDuration: number;
  proName: string;
  proCity: string | null;
  selectedDate: Date;
  selectedTime: string;
  paymentMethod: "online" | "on_site" | null;
  onSelectPayment: (method: "online" | "on_site") => void;
  canPayOnline: boolean;
  /** Acompte configuré par la pro — le paiement sur place n'est plus proposé. */
  mustPayOnline: boolean;
  depositPercentage: number;
  cancellationNoticeHours: number;
  cancellationPolicyAccepted: boolean;
  onToggleCancellationPolicy: () => void;
  onContactPro?: () => void;
  contactingPro?: boolean;
}

function PaymentChoice({
  selected,
  onPress,
  icon,
  title,
  subtitle,
  disabled,
}: {
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        opacity: disabled ? 0.5 : 1,
        ...Shadows.card,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: selected ? colors.primary : colors.cream,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
      </View>
    </AnimatedPressable>
  );
}

export function BookingSummary({
  prestationName,
  prestationPrice,
  prestationDuration,
  proName,
  proCity,
  selectedDate,
  selectedTime,
  paymentMethod,
  onSelectPayment,
  canPayOnline,
  mustPayOnline,
  depositPercentage,
  cancellationNoticeHours,
  cancellationPolicyAccepted,
  onToggleCancellationPolicy,
  onContactPro,
  contactingPro,
}: Props) {
  const colors = useThemeColors();
  const dateLabel = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <View style={{ gap: 20 }}>
      {/* Header */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 }}>
          Récapitulatif
        </Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Vérifie que tout est bon</Text>
      </View>

      {/* Summary card */}
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 20,
          padding: 20,
          gap: 16,
          ...Shadows.card,
        }}
      >
        {/* Prestation + price */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 2 }}>Prestation</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              {prestationName}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
              avec {proName}
              {proCity ? ` · ${proCity}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 2 }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>
              {prestationPrice.toFixed(2)}€
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border }} />

        {/* Date / Time / Duration row */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.cream,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground, marginBottom: 4 }}>Date</Text>
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, textTransform: "capitalize" }}
            >
              {dateLabel}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.primaryLight,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground, marginBottom: 4 }}>Horaire</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>
              {selectedTime}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.cream,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground, marginBottom: 4 }}>Durée</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
              {formatDuration(prestationDuration)}
            </Text>
          </View>
        </View>
      </View>

      {/* Une précision à donner avant de valider (allergie, adresse, etc.) */}
      {onContactPro && (
        <AnimatedPressable
          onPress={onContactPro}
          disabled={contactingPro}
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: colors.primaryLight, borderRadius: 14, padding: 14,
          }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.primary }}>
            Une précision pour {proName} avant de réserver ?
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </AnimatedPressable>
      )}

      {/* Conditions d'annulation — acceptation explicite requise pour continuer,
          pour éviter les litiges ("je ne savais pas que l'acompte ne serait
          pas remboursé"). */}
      <AnimatedPressable
        onPress={onToggleCancellationPolicy}
        style={{
          flexDirection: "row", alignItems: "flex-start", gap: 10,
          backgroundColor: colors.white, borderRadius: 14, padding: 14,
          borderWidth: 1, borderColor: cancellationPolicyAccepted ? colors.primary : colors.border,
        }}
      >
        <View
          style={{
            width: 22, height: 22, borderRadius: 6, marginTop: 1, flexShrink: 0,
            backgroundColor: cancellationPolicyAccepted ? colors.primary : colors.cream,
            alignItems: "center", justifyContent: "center",
            borderWidth: cancellationPolicyAccepted ? 0 : 1, borderColor: colors.border,
          }}
        >
          {cancellationPolicyAccepted && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
        <Text style={{ flex: 1, fontSize: 12, color: colors.foreground, lineHeight: 17 }}>
          J'ai pris connaissance des conditions d'annulation de {proName} : annulation possible{" "}
          {cancellationNoticeHours === 0 ? "jusqu'au rendez-vous" : `jusqu'à ${cancellationNoticeHours}h avant le rendez-vous`},
          au-delà l'annulation n'est plus possible depuis l'app.
          {paymentMethod === "online" && depositPercentage > 0 && depositPercentage < 100
            ? " L'acompte reste acquis au professionnel en cas d'annulation, seul le reste est remboursé."
            : ""}
        </Text>
      </AnimatedPressable>

      {/* Payment method */}
      {mustPayOnline ? (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          backgroundColor: colors.primaryLight, borderRadius: 14,
          padding: 14, borderWidth: 1, borderColor: withAlpha(colors.primary, 0.2),
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: colors.primaryLight,
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 2 }}>
              Acompte de {depositPercentage}% — paiement en ligne
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
              Ce professionnel demande un acompte pour confirmer le rendez-vous. Le reste se règle sur place.
            </Text>
          </View>
        </View>
      ) : canPayOnline ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Mode de paiement</Text>
          <View style={{ gap: 10 }}>
            <PaymentChoice
              selected={paymentMethod === "on_site"}
              onPress={() => onSelectPayment("on_site")}
              icon={<Ionicons name="card-outline" size={20} color={colors.primary} />}
              title="Payer sur place"
              subtitle="Espèces, carte bancaire"
            />
            <PaymentChoice
              selected={paymentMethod === "online"}
              onPress={() => onSelectPayment("online")}
              icon={<Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />}
              title="Payer en ligne"
              subtitle="Carte, Apple Pay, Google Pay"
            />
          </View>
        </View>
      ) : (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          backgroundColor: colors.warningLight, borderRadius: 14,
          padding: 14, borderWidth: 1, borderColor: withAlpha(colors.warning, 0.25),
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: colors.warningLight,
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warningText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.warningTextDark, marginBottom: 2 }}>
              Paiement sur place
            </Text>
            <Text style={{ fontSize: 12, color: colors.warningTextDark, lineHeight: 17 }}>
              Ce professionnel n'accepte pas le paiement en ligne. Le règlement se fait directement lors du rendez-vous.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
