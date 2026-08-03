import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { Circle, Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Specialist } from "./SpecialistCard";
import { Colors } from "@/constants/colors";
import { AnimatedIconButton } from "@/components/ui/AnimatedPressable";
import { resolveMediaUrl } from "@/lib/media";

// react-native-map-clustering types renderCluster's argument as `any` upstream —
// this describes the actual GeoJSON-like supercluster feature shape it passes.
interface ClusterFeature {
  id: string | number;
  geometry: { coordinates: [number, number] };
  onPress: () => void;
  properties: { point_count: number };
}


const PARIS: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 8,
  longitudeDelta: 8,
};


interface Props {
  specialists: Specialist[];
}


function MarkerPin({ item }: { item: Specialist }) {
  const photo = resolveMediaUrl(item.profile_image_url) ?? null;

  return (
    <View style={styles.pinWrap}>
      <View style={styles.pinCircle}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={styles.pinFallback}>
            <Text style={styles.pinInitial}>{item.first_name?.[0] ?? "?"}</Text>
          </View>
        )}
      </View>
      <View style={styles.badge}>
        {item.min_price != null ? (
          <Text style={styles.badgeText}>~{item.min_price}€</Text>
        ) : item.rating > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Ionicons name="star" size={7} color={Colors.white} />
            <Text style={styles.badgeText}>{item.rating != null ? Number(item.rating).toFixed(1) : "–"}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.pinTail} />
    </View>
  );
}


function ProBottomCard({
  item,
  slideAnim,
  onClose,
  onBook,
  onViewProfile,
}: {
  item: Specialist;
  slideAnim: Animated.Value;
  onClose: () => void;
  onBook: () => void;
  onViewProfile: () => void;
}) {
  const photo = resolveMediaUrl(item.profile_image_url) ?? null;

  return (
    <Animated.View style={[styles.bottomCard, { transform: [{ translateY: slideAnim }] }]}>
      <AnimatedIconButton onPress={onClose} style={styles.closeBtn} hitSlop={8} accessibilityLabel="Fermer">
        <Ionicons name="close" size={18} color={Colors.mutedForeground} />
      </AnimatedIconButton>

      {/* Avatar + infos */}
      <Pressable
        onPress={onViewProfile}
        style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
        accessibilityRole="button"
        accessibilityLabel={`Voir le profil de ${item.business_name}`}
      >
        <View style={styles.cardAvatar}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text style={styles.cardAvatarInitial}>{item.first_name?.[0]?.toUpperCase() ?? "?"}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.business_name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {item.city ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="location-outline" size={12} color={Colors.mutedForeground} />
                <Text style={styles.cardCity}>{item.city}</Text>
              </View>
            ) : null}
            {item.rating > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={styles.cardRating}>{Number(item.rating).toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {!item.address_visible && item.service_radius_km ? (
        <View style={styles.privacyNotice}>
          <Ionicons name="lock-closed-outline" size={13} color={Colors.mutedForeground} />
          <Text style={styles.privacyNoticeText}>
            Adresse non affichée publiquement — intervient dans un rayon de {item.service_radius_km} km
            {item.service_area_label ? ` (${item.service_area_label})` : ""}
          </Text>
        </View>
      ) : null}

      {/* Bouton Réserver */}
      <Pressable
        onPress={onBook}
        style={({ pressed }) => [
          styles.cardBtn,
          pressed && styles.cardBtnPressed,
        ]}
      >
        <View style={styles.cardBtnInner}>
          <Text style={styles.cardBtnText}>Réserver maintenant</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}


function computeRegion(mapped: (Specialist & { lat: number; lng: number })[]): Region {
  if (mapped.length === 0) return PARIS;
  const lats = mapped.map((s) => s.lat);
  const lngs = mapped.map((s) => s.lng);
  const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.5),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.5),
  };
}


export default function SpecialistsMapView({ specialists }: Props) {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [selectedPro, setSelectedPro] = useState<Specialist | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (selectedPro) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }).start();
    }
  }, [selectedPro]);

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start(() => setSelectedPro(null));
  };

  const mapped = specialists.filter((s) => s.lat != null && s.lng != null) as (Specialist & { lat: number; lng: number })[];
  const initialRegion = computeRegion(mapped);

  return (
    <View style={{ flex: 1 }}>
      <ClusteredMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === "android"}
        clusterColor={Colors.primary}
        clusterTextColor={Colors.white}
        clusterFontFamily="System"
        onPress={() => selectedPro && handleClose()}
        renderCluster={(cluster: ClusterFeature) => {
          const { geometry, onPress, properties } = cluster;
          const count: number = properties.point_count;
          const size = count < 5 ? 40 : count < 15 ? 50 : 60;
          return (
            <Marker
              key={`cluster-${cluster.id}`}
              coordinate={{ longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] }}
              onPress={onPress}
              tracksViewChanges={false}
            >
              <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
                <Text style={styles.clusterText}>{count}</Text>
              </View>
            </Marker>
          );
        }}
      >
        {mapped.map((item) =>
          // Address hidden: show only a coverage circle around the approximate public
          // point, never a precise pin — a pin here would defeat the whole point of
          // the pro's privacy choice.
          !item.address_visible && item.service_radius_km ? (
            <Circle
              key={`zone-${item.id}`}
              center={{ latitude: item.lat, longitude: item.lng }}
              radius={item.service_radius_km * 1000}
              strokeColor={Colors.primary}
              strokeWidth={1.5}
              fillColor={`${Colors.primary}22`}
            />
          ) : null
        )}
        {mapped.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            tracksViewChanges={false}
            onPress={() => { slideAnim.setValue(300); setSelectedPro(item); }}
          >
            <MarkerPin item={item} />
          </Marker>
        ))}
      </ClusteredMapView>

      {mapped.length === 0 && (
        <View style={styles.noMarkers}>
          <View style={styles.noMarkersCard}>
            <Ionicons name="location-outline" size={20} color={Colors.mutedForeground} />
            <Text style={styles.noMarkersText}>
              {specialists.length === 0 ? "Aucune experte dans cette zone" : "Les expertes de cette liste n'ont pas encore de position GPS"}
            </Text>
          </View>
        </View>
      )}

      {selectedPro && (
        <ProBottomCard
          item={selectedPro}
          slideAnim={slideAnim}
          onClose={handleClose}
          onBook={() => router.push({ pathname: "/booking", params: { proId: selectedPro.id } })}
          onViewProfile={() => router.push({
            pathname: "/specialist/[id]",
            params: { id: selectedPro.id, lat: String(selectedPro.lat), lng: String(selectedPro.lng) },
          })}
        />
      )}

      {Platform.OS === "ios" && (
        <AnimatedIconButton
          onPress={() => mapRef.current?.animateToRegion(initialRegion, 600)}
          style={styles.locBtn}
          accessibilityLabel="Centrer la carte sur ma position"
        >
          <Ionicons name="locate-outline" size={20} color={Colors.primary} />
        </AnimatedIconButton>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  cluster: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  clusterText: { color: Colors.white, fontWeight: "700", fontSize: 14 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: Colors.background },
  loaderText: { fontSize: 14, color: Colors.mutedForeground, fontWeight: "500" },
  pinWrap: { alignItems: "center" },
  pinCircle: {
    width: 44, height: 44, borderRadius: 22, overflow: "hidden",
    borderWidth: 2.5, borderColor: Colors.primary, backgroundColor: "#FFE6F0",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  pinFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFE6F0" },
  pinInitial: { fontSize: 18, fontWeight: "800", color: Colors.primary },
  badge: {
    marginTop: 2, backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, minWidth: 28, alignItems: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 2,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: Colors.white },
  pinTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: Colors.primary,
    marginTop: -1,
  },
  bottomCard: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
    gap: 14,
  },
  closeBtn: {
    position: "absolute", top: 12, right: 12, width: 28, height: 28,
    borderRadius: 14, backgroundColor: "#F4F4F5",
    alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  cardAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFE0EF",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    flexShrink: 0, borderWidth: 2, borderColor: Colors.primary,
  },
  cardAvatarInitial: { fontSize: 22, fontWeight: "800", color: Colors.primary },
  cardName: { fontSize: 16, fontWeight: "700", color: Colors.foreground },
  cardCity: { fontSize: 12, color: Colors.mutedForeground },
  cardRating: { fontSize: 12, fontWeight: "700", color: Colors.foreground },
  privacyNotice: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F4F4F5", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  privacyNoticeText: { fontSize: 11.5, color: Colors.mutedForeground, flex: 1, lineHeight: 15 },
  cardBtn: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  cardBtnPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  cardBtnInner: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 28,
  },
  cardBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: 0.4,
  },
  noMarkers: { position: "absolute", bottom: 100, left: 0, right: 0, alignItems: "center" },
  noMarkersCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    maxWidth: 300,
  },
  noMarkersText: { fontSize: 12, color: Colors.mutedForeground, fontWeight: "500", flex: 1 },
  locBtn: {
    position: "absolute", top: 16, right: 16, width: 44, height: 44,
    borderRadius: 22, backgroundColor: Colors.white,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
});
