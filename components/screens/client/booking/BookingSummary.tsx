import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";
import { Colors, withAlpha } from "@/constants/colors";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

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
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h${mins}`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
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
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderWidth: 2,
        borderColor: selected ? Colors.primary : Colors.border,
        opacity: disabled ? 0.5 : 1,
        ...Shadows.card,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "#FFE6F0",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.foreground, marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.mutedForeground }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: selected ? Colors.primary : Colors.cream,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
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
}: Props) {
  const dateLabel = selectedDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <View style={{ gap: 20 }}>
      {/* Header */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: Colors.foreground, letterSpacing: -0.5 }}>
          Récapitulatif
        </Text>
        <Text style={{ fontSize: 14, color: Colors.mutedForeground }}>Vérifie que tout est bon</Text>
      </View>

      {/* Summary card */}
      <View
        style={{
          backgroundColor: Colors.white,
          borderRadius: 20,
          padding: 20,
          gap: 16,
          ...Shadows.card,
        }}
      >
        {/* Prestation + price */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 2 }}>Prestation</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
              {prestationName}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.mutedForeground, marginTop: 2 }}>
              avec {proName}
              {proCity ? ` · ${proCity}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
            <Text style={{ fontSize: 11, color: Colors.mutedForeground, marginBottom: 2 }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.foreground }}>
              {prestationPrice.toFixed(2)}€
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: Colors.border }} />

        {/* Date / Time / Duration row */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.cream,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 4 }}>Date</Text>
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground, textTransform: "capitalize" }}
            >
              {dateLabel}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#FFE6F0",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 4 }}>Horaire</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.primary }}>
              {selectedTime}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.cream,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: Colors.mutedForeground, marginBottom: 4 }}>Durée</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>
              {formatDuration(prestationDuration)}
            </Text>
          </View>
        </View>
      </View>

      {/* Payment method */}
      {canPayOnline ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground }}>Mode de paiement</Text>
          <View style={{ gap: 10 }}>
            <PaymentChoice
              selected={paymentMethod === "on_site"}
              onPress={() => onSelectPayment("on_site")}
              icon={<Ionicons name="card-outline" size={20} color={Colors.primary} />}
              title="Payer sur place"
              subtitle="Espèces, carte bancaire"
            />
            <PaymentChoice
              selected={paymentMethod === "online"}
              onPress={() => onSelectPayment("online")}
              icon={<Ionicons name="phone-portrait-outline" size={20} color={Colors.primary} />}
              title="Payer en ligne"
              subtitle="Carte, Apple Pay, Google Pay"
            />
          </View>
        </View>
      ) : (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          backgroundColor: "#FFF8EC", borderRadius: 14,
          padding: 14, borderWidth: 1, borderColor: withAlpha("#F39C12", 0.25),
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: Colors.warningLight,
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.warningText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 2 }}>
              Paiement sur place
            </Text>
            <Text style={{ fontSize: 12, color: Colors.warningTextDark, lineHeight: 17 }}>
              Ce professionnel n'accepte pas le paiement en ligne. Le règlement se fait directement lors du rendez-vous.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
