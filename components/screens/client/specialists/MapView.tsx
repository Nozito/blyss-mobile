import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Specialist } from "./SpecialistCard";


const PARIS: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 8,
  longitudeDelta: 8,
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


// ── Pro bottom card ───────────────────────────────────────────────────────────


function ProBottomCard({
  item,
  slideAnim,
  onClose,
  onViewProfile,
  onBook,
}: {
  item: Specialist;
  slideAnim: Animated.Value;
  onClose: () => void;
  onViewProfile: () => void;
  onBook: () => void;
}) {
  const photo = item.profile_image_url
    ? item.profile_image_url.startsWith("http")
      ? item.profile_image_url
      : `${API_URL}${item.profile_image_url}`
    : null;


  return (
    <Animated.View style={[styles.bottomCard, { transform: [{ translateY: slideAnim }] }]}>
      {/* Close button */}
      <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
        <Ionicons name="close" size={18} color="#6D6D78" />
      </Pressable>


      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {/* Avatar */}
        <View style={styles.cardAvatar}>
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text style={styles.cardAvatarInitial}>{item.first_name?.[0]?.toUpperCase() ?? "?"}</Text>
          )}
        </View>


        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.business_name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {item.city ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="location-outline" size={12} color="#6D6D78" />
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
      </View>


      {/* CTAs */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={onViewProfile}
          style={({ pressed }) => ({
            flex: 1,
            borderWidth: 1.5,
            borderColor: "#FE5D9D",
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: "#FE5D9D", fontWeight: "600", fontSize: 13 }}>Profil</Text>
        </Pressable>


        <Pressable
          onPress={onBook}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: "#FE5D9D",
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Réserver</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}


// ── Main MapView screen ───────────────────────────────────────────────────────


function computeRegion(mapped: (Specialist & { lat: number; lng: number })[]): Region {
  if (mapped.length === 0) return PARIS;


  const lats = mapped.map((s) => s.lat);
  const lngs = mapped.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);


  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const deltaLat = Math.max((maxLat - minLat) * 1.4, 0.5);
  const deltaLng = Math.max((maxLng - minLng) * 1.4, 0.5);


  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: deltaLat,
    longitudeDelta: deltaLng,
  };
}


export default function SpecialistsMapView({ specialists }: Props) {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const [selectedPro, setSelectedPro] = useState<Specialist | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;


  useEffect(() => {
    if (selectedPro) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }).start();
    }
  }, [selectedPro]);


  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelectedPro(null));
  };


  // Filter specialists that have coordinates
  const mapped = specialists.filter(
    (s) => s.lat != null && s.lng != null
  ) as (Specialist & { lat: number; lng: number })[];


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
        clusterColor="#FE5D9D"
        clusterTextColor="#ffffff"
        clusterFontFamily="System"
        onPress={() => selectedPro && handleClose()}
        renderCluster={(cluster: any) => {
          const { geometry, onPress, properties } = cluster;
          const count: number = properties.point_count;
          const size = count < 5 ? 40 : count < 15 ? 50 : 60;
          return (
            <Marker
              key={`cluster-${cluster.id}`}
              coordinate={{
                longitude: geometry.coordinates[0],
                latitude: geometry.coordinates[1],
              }}
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
        {mapped.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            tracksViewChanges={false}
            onPress={() => {
              slideAnim.setValue(300);
              setSelectedPro(item);
            }}
          >
            <MarkerPin item={item} />
          </Marker>
        ))}
      </ClusteredMapView>


      {/* "Aucun marqueur" hint */}
      {mapped.length === 0 && (
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


      {/* Pro bottom card */}
      {selectedPro && (
        <ProBottomCard
          item={selectedPro}
          slideAnim={slideAnim}
          onClose={handleClose}
          onViewProfile={() =>
            router.push({ pathname: "/specialist/[id]", params: { id: selectedPro.id } })
          }
          onBook={() =>
            router.push({ pathname: "/booking", params: { proId: selectedPro.id } })
          }
        />
      )}


      {/* My location button (iOS) */}
      {Platform.OS === "ios" && (
        <Pressable
          onPress={() => mapRef.current?.animateToRegion(initialRegion, 600)}
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
  cluster: {
    backgroundColor: "#FE5D9D",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  clusterText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
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


  // Bottom card
  bottomCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
    gap: 14,
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  cardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFE0EF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 2,
    borderColor: "#FE5D9D",
  },
  cardAvatarInitial: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FE5D9D",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#09090B",
  },
  cardCity: {
    fontSize: 12,
    color: "#6D6D78",
  },
  cardRating: {
    fontSize: 12,
    fontWeight: "700",
    color: "#09090B",
  },
  cardBtn: {
    backgroundColor: "#FE5D9D",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: "#FE5D9D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  cardBtnText: {
    fontSize: 14,
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
