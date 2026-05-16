import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Shadows } from "@/constants/shadows";

export interface Specialist {
  id: number;
  business_name: string;
  specialty: string;
  city: string;
  rating: number;
  reviews_count: number;
  profile_image_url: string | null;
  cover_image_url: string | null;
  first_name: string;
  distance_km: number | null;
  /** GPS coordinates — present when API returns them (nearby/location queries) */
  lat?: number | null;
  lng?: number | null;
  /** Minimum service price — shown as badge on map markers */
  min_price?: number | null;
}

interface Props {
  item: Specialist;
  isFav: boolean;
  index: number;
  onPress: () => void;
  onToggleFav: () => void;
}

export function SpecialistCard({ item, isFav, index, onPress, onToggleFav }: Props) {
  const photo = item.cover_image_url ?? item.profile_image_url;

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: "row",
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#EBE6E066",
          marginBottom: 12,
          ...Shadows.card,
        }}
      >
        {/* Photo */}
        <View style={{ width: 108, flexShrink: 0, backgroundColor: "#F8F5F1", minHeight: 130 }}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={["#FE5D9D26", "#FE5D9D14", "transparent"]}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 30, fontWeight: "700", color: "#FE5D9D40" }}>
                {item.first_name[0]}
              </Text>
            </LinearGradient>
          )}

          <Pressable
            onPress={onToggleFav}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isFav ? "#FE5D9DE6" : "rgba(0,0,0,0.4)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={isFav ? "heart" : "heart-outline"} size={12} color="#fff" />
          </Pressable>
        </View>

        {/* Info */}
        <View style={{ flex: 1, padding: 16, flexDirection: "column", minHeight: 130 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: "#09090B", lineHeight: 20 }}
              numberOfLines={1}
            >
              {item.business_name}
            </Text>
            <Text
              style={{ fontSize: 12, color: "#FE5D9D", fontWeight: "500", marginTop: 2 }}
              numberOfLines={1}
            >
              {item.specialty}
            </Text>

            {item.rating > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                <Ionicons name="star" size={11} color="#FBBF24" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#09090B" }}>
                  {item.rating != null ? Number(item.rating).toFixed(1) : "–"}
                </Text>
                {item.reviews_count > 0 && (
                  <Text style={{ fontSize: 11, color: "#6D6D78" }}>
                    · {item.reviews_count} avis
                  </Text>
                )}
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Ionicons name="location-outline" size={11} color="#6D6D78" />
              <Text style={{ fontSize: 12, color: "#6D6D78", flex: 1 }} numberOfLines={1}>
                {item.city}
              </Text>
              {item.distance_km != null && (
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#FE5D9D", flexShrink: 0 }}>
                  {item.distance_km} km
                </Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={onPress}
            style={{
              marginTop: 12,
              height: 36,
              borderRadius: 12,
              backgroundColor: "#FE5D9D",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Réserver</Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}
