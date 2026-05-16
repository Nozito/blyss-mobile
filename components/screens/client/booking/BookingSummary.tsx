import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";

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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        borderWidth: 2,
        borderColor: selected ? "#FE5D9D" : "#EBE6E0",
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
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#09090B", marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: "#6D6D78" }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: selected ? "#FE5D9D" : "#F8F5F1",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </Pressable>
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
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#09090B", letterSpacing: -0.5 }}>
          Récapitulatif
        </Text>
        <Text style={{ fontSize: 14, color: "#6D6D78" }}>Vérifie que tout est bon</Text>
      </View>

      {/* Summary card */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: 20,
          gap: 16,
          ...Shadows.card,
        }}
      >
        {/* Prestation + price */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: "#6D6D78", marginBottom: 2 }}>Prestation</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#09090B" }}>
              {prestationName}
            </Text>
            <Text style={{ fontSize: 12, color: "#6D6D78", marginTop: 2 }}>
              avec {proName}
              {proCity ? ` · ${proCity}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
            <Text style={{ fontSize: 11, color: "#6D6D78", marginBottom: 2 }}>Total</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#09090B" }}>
              {prestationPrice.toFixed(2)}€
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: "#EBE6E0" }} />

        {/* Date / Time / Duration row */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#F8F5F1",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: "#6D6D78", marginBottom: 4 }}>Date</Text>
            <Text
              style={{ fontSize: 12, fontWeight: "700", color: "#09090B", textTransform: "capitalize" }}
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
            <Text style={{ fontSize: 10, color: "#6D6D78", marginBottom: 4 }}>Horaire</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#FE5D9D" }}>
              {selectedTime}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: "#F8F5F1",
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 10, color: "#6D6D78", marginBottom: 4 }}>Durée</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#09090B" }}>
              {formatDuration(prestationDuration)}
            </Text>
          </View>
        </View>
      </View>

      {/* Payment method */}
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: "#09090B" }}>Mode de paiement</Text>
        <View style={{ gap: 10 }}>
          <PaymentChoice
            selected={paymentMethod === "on_site"}
            onPress={() => onSelectPayment("on_site")}
            icon={<Ionicons name="card-outline" size={20} color="#FE5D9D" />}
            title="Payer sur place"
            subtitle="Espèces, carte bancaire"
          />
          {canPayOnline ? (
            <PaymentChoice
              selected={paymentMethod === "online"}
              onPress={() => onSelectPayment("online")}
              icon={<Ionicons name="phone-portrait-outline" size={20} color="#FE5D9D" />}
              title="Payer en ligne"
              subtitle="Carte, Apple Pay, Google Pay"
            />
          ) : (
            <PaymentChoice
              selected={false}
              onPress={() => {}}
              icon={<Ionicons name="phone-portrait-outline" size={20} color="#6D6D78" />}
              title="Payer en ligne"
              subtitle="Non disponible pour ce professionnel"
              disabled
            />
          )}
        </View>
      </View>
    </View>
  );
}
