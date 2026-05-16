import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import MapView, { Marker, Callout, PROVIDER_DEFAULT, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Specialist } from "./SpecialistCard";

const PARIS: Region = {
  latitude: 48.8566,
  longitude: 2.3522,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface Props {
  specialists: Specialist[];
}

// ── Custom marker pin ─────────────────────────────────────────────────────────

function MarkerPin({ item }: { item: Specialist }) {
  const photo = item.profile_image_url
    ? item.profile_image_url.startsWith("http")
      ? item.profile_image_url
      : `${API_URL}${item.profile_image_url}`
    : null;

  return (
    <View style={styles.pinWrap}>
      {/* Circle photo */}
      <View style={styles.pinCircle}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View style={styles.pinFallback}>
            <Text style={styles.pinInitial}>{item.first_name?.[0] ?? "?"}</Text>
          </View>
        )}
      </View>

      {/* Price / rating badge */}
      <View style={styles.badge}>
        {item.min_price != null ? (
          <Text style={styles.badgeText}>~{item.min_price}€</Text>
        ) : item.rating > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Ionicons name="star" size={7} color="#fff" />
            <Text style={styles.badgeText}>{item.rating != null ? Number(item.rating).toFixed(1) : "–"}</Text>
          </View>
        ) : null}
      </View>

      {/* Pin tail */}
      <View style={styles.pinTail} />
    </View>
  );
}

// ── Callout content ───────────────────────────────────────────────────────────

function CalloutCard({ item }: { item: Specialist }) {
  const photo = item.profile_image_url
    ? item.profile_image_url.startsWith("http")
      ? item.profile_image_url
      : `${API_URL}${item.profile_image_url}`
    : null;

  return (
    <View style={styles.callout}>
      <View style={styles.calloutRow}>
        {/* Photo */}
        <View style={styles.calloutPhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View style={[styles.calloutPhoto, styles.calloutPhotoFallback]}>
              <Text style={styles.calloutInitial}>{item.first_name?.[0] ?? "?"}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={styles.calloutName} numberOfLines={1}>{item.business_name}</Text>
          <Text style={styles.calloutSpecialty} numberOfLines={1}>{item.specialty}</Text>

          {item.rating > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }}>
              <Ionicons name="star" size={11} color="#FBBF24" />
              <Text style={styles.calloutRating}>{item.rating != null ? Number(item.rating).toFixed(1) : "–"}</Text>
              {item.reviews_count > 0 && (
                <Text style={styles.calloutReviews}>· {item.reviews_count} avis</Text>
              )}
            </View>
          )}

          {item.city ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }}>
              <Ionicons name="location-outline" size={11} color="#6D6D78" />
              <Text style={styles.calloutCity} numberOfLines={1}>{item.city}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.calloutBtn}>
        <Text style={styles.calloutBtnText}>Voir le profil →</Text>
      </View>
    </View>
  );
}

// ── Main MapView screen ───────────────────────────────────────────────────────

export function SpecialistsMapView({ specialists }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) {
          if (!cancelled) setRegion(PARIS);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.12,
            longitudeDelta: 0.12,
          });
        }
      } catch {
        if (!cancelled) setRegion(PARIS);
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Filter specialists that have coordinates
  const mapped = specialists.filter(
    (s) => s.lat != null && s.lng != null
  ) as (Specialist & { lat: number; lng: number })[];

  if (locating) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FE5D9D" />
        <Text style={styles.loaderText}>Localisation en cours…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={region ?? PARIS}
        showsUserLocation
        showsMyLocationButton={Platform.OS === "android"}
      >
        {mapped.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            tracksViewChanges={false}
            onCalloutPress={() =>
              router.push({ pathname: "/specialist/[id]", params: { id: item.id } })
            }
          >
            <MarkerPin item={item} />
            <Callout tooltip>
              <CalloutCard item={item} />
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* "Aucun marqueur" hint */}
      {mapped.length === 0 && !locating && (
        <View style={styles.noMarkers}>
          <View style={styles.noMarkersCard}>
            <Ionicons name="location-outline" size={20} color="#6D6D78" />
            <Text style={styles.noMarkersText}>
              {specialists.length === 0
                ? "Aucune experte dans cette zone"
                : "Les expertes de cette liste n'ont pas encore de position GPS"}
            </Text>
          </View>
        </View>
      )}

      {/* My location button (iOS) */}
      {Platform.OS === "ios" && region && (
        <Pressable
          onPress={() => mapRef.current?.animateToRegion(region, 600)}
          style={styles.locBtn}
        >
          <Ionicons name="locate-outline" size={20} color="#FE5D9D" />
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFEAF1",
  },
  loaderText: {
    fontSize: 14,
    color: "#6D6D78",
    fontWeight: "500",
  },

  // Marker pin
  pinWrap: {
    alignItems: "center",
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "#FE5D9D",
    backgroundColor: "#FFE6F0",
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  pinFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFE6F0",
  },
  pinInitial: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FE5D9D",
  },
  badge: {
    marginTop: 2,
    backgroundColor: "#FE5D9D",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: "center",
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FE5D9D",
    marginTop: -1,
  },

  // Callout
  callout: {
    width: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#EBE6E0",
  },
  calloutRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  calloutPhoto: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFE6F0",
    flexShrink: 0,
  },
  calloutPhotoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  calloutInitial: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FE5D9D",
  },
  calloutName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#09090B",
  },
  calloutSpecialty: {
    fontSize: 11,
    color: "#FE5D9D",
    fontWeight: "500",
    marginTop: 1,
  },
  calloutRating: {
    fontSize: 11,
    fontWeight: "700",
    color: "#09090B",
  },
  calloutReviews: {
    fontSize: 11,
    color: "#6D6D78",
  },
  calloutCity: {
    fontSize: 11,
    color: "#6D6D78",
    flex: 1,
  },
  calloutBtn: {
    backgroundColor: "#FE5D9D",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  calloutBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  // No markers overlay
  noMarkers: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  noMarkersCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 300,
  },
  noMarkersText: {
    fontSize: 12,
    color: "#6D6D78",
    fontWeight: "500",
    flex: 1,
  },

  // My location button
  locBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
