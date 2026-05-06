import React from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "./ui/Badge";
import { Avatar } from "./ui/Avatar";
import { Colors } from "@/constants/colors";

interface Specialist {
  id: number;
  first_name: string;
  last_name: string;
  activity_name?: string | null;
  city?: string | null;
  profile_photo?: string | null;
  banner_photo?: string | null;
  avg_rating?: number | null;
  clients_count?: number;
  pro_specialties?: string[] | null;
  distance_km?: number | null;
}

interface SpecialistCardProps {
  specialist: Specialist;
  onFavoriteToggle?: (id: number) => void;
  isFavorited?: boolean;
  compact?: boolean;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

function photoUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

export function SpecialistCard({
  specialist,
  onFavoriteToggle,
  isFavorited = false,
  compact = false,
}: SpecialistCardProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/specialist/${specialist.id}`)}
      className="bg-card rounded-2xl overflow-hidden mb-3"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Banner */}
      {!compact && (
        <View className="h-28 bg-primary-light">
          {specialist.banner_photo ? (
            <Image
              source={{ uri: photoUrl(specialist.banner_photo) }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 bg-primary-light" />
          )}
          {/* Favorite button */}
          {onFavoriteToggle && (
            <Pressable
              onPress={() => onFavoriteToggle(specialist.id)}
              className="absolute top-3 right-3 bg-white/80 rounded-full p-1.5"
            >
              <Ionicons
                name={isFavorited ? "heart" : "heart-outline"}
                size={18}
                color={isFavorited ? Colors.primary : Colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>
      )}

      <View className="p-4">
        <View className="flex-row items-start gap-3">
          <Avatar
            uri={photoUrl(specialist.profile_photo)}
            name={`${specialist.first_name} ${specialist.last_name}`}
            size={compact ? 36 : 48}
          />

          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
              {specialist.activity_name ??
                `${specialist.first_name} ${specialist.last_name}`}
            </Text>

            <View className="flex-row items-center gap-1 mt-0.5">
              {specialist.city && (
                <Text className="text-xs text-muted-foreground">{specialist.city}</Text>
              )}
              {specialist.distance_km != null && (
                <Text className="text-xs text-muted-foreground">
                  · {specialist.distance_km.toFixed(1)} km
                </Text>
              )}
            </View>

            <View className="flex-row items-center gap-2 mt-1.5">
              {specialist.avg_rating != null && (
                <View className="flex-row items-center gap-0.5">
                  <Ionicons name="star" size={12} color={Colors.secondary} />
                  <Text className="text-xs font-medium text-foreground">
                    {specialist.avg_rating.toFixed(1)}
                  </Text>
                </View>
              )}
              {specialist.clients_count != null && (
                <Text className="text-xs text-muted-foreground">
                  {specialist.clients_count} clientes
                </Text>
              )}
            </View>
          </View>

          {compact && onFavoriteToggle && (
            <Pressable onPress={() => onFavoriteToggle(specialist.id)}>
              <Ionicons
                name={isFavorited ? "heart" : "heart-outline"}
                size={20}
                color={isFavorited ? Colors.primary : Colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        {/* Specialties */}
        {!compact && specialist.pro_specialties && specialist.pro_specialties.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {specialist.pro_specialties.slice(0, 3).map((s) => (
              <Badge key={s} variant="default" size="sm">
                {s}
              </Badge>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}
