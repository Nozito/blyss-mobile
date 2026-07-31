import React, { useRef, useCallback, useState, useEffect, memo } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Shadows } from "@/constants/shadows";
import { Colors, withAlpha } from "@/constants/colors";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

const STAGGER_CAP = 8; // avoid a multi-second cascade past the first screenful

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
  /** GPS coordinates — present when API returns them (nearby/location queries).
   * When address_visible is false, these are an approximate public point, not the
   * pro's real location — never precise enough to identify the exact address. */
  lat?: number | null;
  lng?: number | null;
  /** Minimum service price — shown as badge on map markers */
  min_price?: number | null;
  /** False by default — the pro has not published her exact address publicly */
  address_visible?: boolean;
  service_radius_km?: number | null;
  service_area_label?: string | null;
}

interface Props {
  item: Specialist;
  isFav: boolean;
  index: number;
  onPress: () => void;
  onToggleFav: () => void;
  onBook?: () => void;
}

export const SpecialistCard = memo(function SpecialistCard({ item, isFav, index, onPress, onToggleFav, onBook }: Props) {
  const photo = item.cover_image_url ?? item.profile_image_url;
  const reduceMotion = useReducedMotion();
  const cardScale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const entryOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const entryTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 14)).current;
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const delay = Math.min(index, STAGGER_CAP) * 60;
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(entryTranslateY, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
    // Animate once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePressIn = () =>
    Animated.spring(cardScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
    }).start();

  const handlePressOut = () =>
    Animated.spring(cardScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();

  const handleHeartPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, speed: 80 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
    onToggleFav();
  }, [heartScale, onToggleFav]);

  return (
    <Animated.View
      style={{
        opacity: entryOpacity,
        transform: [{ scale: cardScale }, { translateY: entryTranslateY }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Voir le profil de ${item.business_name}`}
        style={{
          flexDirection: "row",
          backgroundColor: Colors.white,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: withAlpha(Colors.border, 0.4),
          marginBottom: 12,
          ...Shadows.card,
        }}
      >
        {/* Photo */}
        <View style={{ width: 108, flexShrink: 0, backgroundColor: Colors.cream, minHeight: 130 }}>
          {photo && !imageError ? (
            <Image
              source={{ uri: photo }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <LinearGradient
              colors={[`${Colors.primary}26`, `${Colors.primary}14`, "transparent"]}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 30, fontWeight: "700", color: `${Colors.primary}40` }}>
                {item.first_name[0]}
              </Text>
            </LinearGradient>
          )}

          <Pressable
            onPress={handleHeartPress}
            accessibilityRole="button"
            accessibilityLabel={isFav ? `Retirer ${item.business_name} des favoris` : `Ajouter ${item.business_name} aux favoris`}
            accessibilityState={{ checked: isFav }}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isFav ? `${Colors.primary}E6` : Colors.overlayDark,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons name={isFav ? "heart" : "heart-outline"} size={12} color={Colors.white} />
            </Animated.View>
          </Pressable>
        </View>

        {/* Info */}
        <View style={{ flex: 1, padding: 16, flexDirection: "column", minHeight: 130 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: Colors.foreground, lineHeight: 20 }}
              numberOfLines={1}
            >
              {item.business_name}
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.primary, fontWeight: "500", marginTop: 2 }}
              numberOfLines={1}
            >
              {item.specialty}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
              {item.rating > 0 && (
                <>
                  <Ionicons name="star" size={11} color="#FBBF24" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground }}>
                    {item.rating != null ? Number(item.rating).toFixed(1) : "–"}
                  </Text>
                  {item.reviews_count > 0 && (
                    <Text style={{ fontSize: 11, color: Colors.mutedForeground }}>
                      · {item.reviews_count} avis
                    </Text>
                  )}
                </>
              )}
              {item.min_price != null && (
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.foreground, marginLeft: item.rating > 0 ? 6 : 0 }}>
                  {item.rating > 0 ? "· " : ""}Dès {Number(item.min_price).toFixed(0)}€
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <Ionicons name="location-outline" size={11} color={Colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: Colors.mutedForeground, flex: 1 }} numberOfLines={1}>
                {item.city}
              </Text>
              {item.distance_km != null && (
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.primary, flexShrink: 0 }}>
                  {item.distance_km} km
                </Text>
              )}
            </View>
          </View>

          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              (onBook ?? onPress)();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Réserver chez ${item.business_name}`}
            style={{
              marginTop: 12,
              height: 36,
              borderRadius: 12,
              backgroundColor: Colors.primary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={Colors.white} />
            <Text style={{ color: Colors.white, fontSize: 13, fontWeight: "600" }}>Réserver</Text>
          </AnimatedPressable>
        </View>
      </Pressable>
    </Animated.View>
  );
});
