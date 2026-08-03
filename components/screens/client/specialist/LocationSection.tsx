import React from "react";
import { View, Text } from "react-native";
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Colors, withAlpha } from "@/constants/colors";
import { Shadows } from "@/constants/shadows";

export interface ConditionItem {
  text: string;
  accepted: boolean;
}

export interface LocationSectionProps {
  city: string;
  addressVisible: boolean;
  addressLine: string | null;
  serviceAreaLabel: string | null;
  serviceRadiusKm: number | null;
  lat?: number | null;
  lng?: number | null;
  conditions: ConditionItem[] | null;
}

const PREVIEW_HEIGHT = 140;
const DEFAULT_RADIUS_METERS = 1200;

function metersToLatitudeDelta(meters: number) {
  return (meters / 111_320) * 2.4;
}

function MapPreview({
  lat,
  lng,
  addressVisible,
  serviceRadiusKm,
}: {
  lat: number;
  lng: number;
  addressVisible: boolean;
  serviceRadiusKm: number | null;
}) {
  const radiusMeters = (serviceRadiusKm ?? 1.2) * 1000;
  const delta = metersToLatitudeDelta(addressVisible ? DEFAULT_RADIUS_METERS : radiusMeters);

  return (
    <View style={{ height: PREVIEW_HEIGHT, width: "100%" }} pointerEvents="none">
      <MapView
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsCompass={false}
      >
        {addressVisible ? (
          <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor={Colors.primary} />
        ) : (
          <Circle
            center={{ latitude: lat, longitude: lng }}
            radius={radiusMeters}
            strokeColor={withAlpha(Colors.primary, 0.4)}
            strokeWidth={1.5}
            fillColor={withAlpha(Colors.primary, 0.12)}
          />
        )}
      </MapView>
    </View>
  );
}

function MapPlaceholder({ city }: { city: string }) {
  return (
    <View
      style={{
        height: PREVIEW_HEIGHT,
        width: "100%",
        backgroundColor: withAlpha(Colors.primary, 0.05),
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Ionicons name="map-outline" size={26} color={withAlpha(Colors.foreground, 0.35)} />
      {Boolean(city) && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.mutedForeground }}>{city}</Text>
      )}
    </View>
  );
}

function ConditionRow({
  condition,
  isLast,
}: {
  condition: ConditionItem;
  isLast: boolean;
}) {
  const color = condition.accepted ? Colors.success : Colors.destructive;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 11,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: Colors.border,
      }}
    >
      <Ionicons name={condition.accepted ? "checkmark-circle" : "close-circle"} size={15} color={color} />
      <Text style={{ fontSize: 13, color: Colors.foreground, flex: 1 }}>{condition.text}</Text>
    </View>
  );
}

export function LocationSection({
  city,
  addressVisible,
  addressLine,
  serviceAreaLabel,
  serviceRadiusKm,
  lat,
  lng,
  conditions,
}: LocationSectionProps) {
  const hasCoordinates = lat != null && lng != null;

  // Cette phrase n'a de sens que si le pro a choisi de ne pas afficher son
  // adresse publiquement — quand elle est visible, l'adresse elle-même suffit.
  const explanation = addressVisible
    ? addressLine
    : serviceAreaLabel
    ? `L'adresse exacte est communiquée 24h avant le rendez-vous — zone d'intervention : ${serviceAreaLabel}.`
    : "L'adresse exacte est communiquée 24h avant le rendez-vous.";

  const visibleConditions = (conditions ?? []).filter((c) => c.text.trim());
  const hasConditions = visibleConditions.length > 0;

  return (
    <View>
      <Text
        style={{
          fontSize: 17,
          fontWeight: "800",
          color: Colors.foreground,
          marginBottom: 12,
          letterSpacing: -0.3,
        }}
      >
        Localisation
      </Text>

      <View
        style={{
          backgroundColor: Colors.white,
          borderRadius: 16,
          overflow: "hidden",
          ...Shadows.card,
        }}
      >
        {hasCoordinates ? (
          <MapPreview lat={lat as number} lng={lng as number} addressVisible={addressVisible} serviceRadiusKm={serviceRadiusKm} />
        ) : (
          <MapPlaceholder city={city} />
        )}

        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Ionicons name="location-outline" size={15} color={Colors.foreground} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.foreground }}>
              {city || "Zone non renseignée"}
            </Text>
          </View>
          {Boolean(explanation) && (
            <Text style={{ fontSize: 13, color: Colors.mutedForeground, lineHeight: 19 }}>
              {explanation}
            </Text>
          )}

          {hasConditions && (
            <>
              <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 14 }} />

              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: Colors.mutedForeground,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginBottom: 4,
                }}
              >
                Conditions
              </Text>
              {visibleConditions.map((c, i) => (
                <ConditionRow key={`${c.text}-${i}`} condition={c} isLast={i === visibleConditions.length - 1} />
              ))}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
