import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  specialistsApi,
  reviewsApi,
  favoritesApi,
  instagramApi,
} from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const { width } = Dimensions.get("window");

function photoUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

export default function SpecialistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["specialist", id],
    queryFn: () => specialistsApi.getSpecialistById(Number(id)),
    enabled: Boolean(id),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => reviewsApi.getBySpecialist(id!),
    enabled: Boolean(id),
  });

  const { data: igData } = useQuery({
    queryKey: ["instagram", id],
    queryFn: () => instagramApi.getPublicPhotos(Number(id)),
    enabled: Boolean(id),
  });

  const { data: favData, refetch: refetchFav } = useQuery({
    queryKey: ["fav-check", id],
    queryFn: () => favoritesApi.check(Number(id)),
    enabled: Boolean(id),
  });

  const addFavMutation = useMutation({
    mutationFn: () => favoritesApi.add(Number(id)),
    onSuccess: () => refetchFav(),
  });

  const removeFavMutation = useMutation({
    mutationFn: () => favoritesApi.remove(Number(id)),
    onSuccess: () => refetchFav(),
  });

  const pro = data?.data as Record<string, unknown> | undefined;
  const reviews: Array<Record<string, unknown>> = (reviewsData?.data as Array<Record<string, unknown>> | undefined) ?? [];
  const igPhotos = (igData?.data as Record<string, unknown> | undefined)?.photos as Array<Record<string, unknown>> | undefined;
  const isFavorited = favData?.data?.isFavorite ?? false;
  const proAvgRating: number | null = pro?.avg_rating != null ? (pro.avg_rating as number) : null;
  const proClientsCount: number | null = pro?.clients_count != null ? (pro.clients_count as number) : null;

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!pro) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Spécialiste introuvable</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">Retour</Text>
        </Pressable>
      </View>
    );
  }

  const services = (pro.prestations as unknown[] | undefined) ?? [];

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      {/* Banner */}
      <View className="h-56 bg-primary-light">
        {pro.banner_photo ? (
          <Image
            source={{ uri: photoUrl(pro.banner_photo as string) }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View className="flex-1 bg-primary-light" />
        )}

        {/* Back + favorite buttons */}
        <View
          className="absolute left-4 right-4 flex-row justify-between"
          style={{ top: insets.top + 8 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/80 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color={Colors.foreground} />
          </Pressable>
          <Pressable
            onPress={() =>
              isFavorited ? removeFavMutation.mutate() : addFavMutation.mutate()
            }
            className="w-9 h-9 rounded-full bg-white/80 items-center justify-center"
          >
            <Ionicons
              name={isFavorited ? "heart" : "heart-outline"}
              size={20}
              color={isFavorited ? Colors.primary : Colors.foreground}
            />
          </Pressable>
        </View>
      </View>

      <View className="px-5 -mt-8">
        {/* Profile info */}
        <View className="flex-row items-end gap-3 mb-4">
          <Avatar
            uri={photoUrl(pro.profile_photo as string | null)}
            name={`${pro.first_name ?? ""} ${pro.last_name ?? ""}`}
            size={72}
          />
          <View className="flex-1 pb-1">
            <Text className="text-xl font-bold text-foreground">
              {(pro.activity_name as string | null) ??
                `${pro.first_name ?? ""} ${pro.last_name ?? ""}`}
            </Text>
            {Boolean(pro.city) && (
              <View className="flex-row items-center gap-1 mt-0.5">
                <Ionicons name="location-outline" size={13} color={Colors.mutedForeground} />
                <Text className="text-sm text-muted-foreground">
                  {pro.city as string}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Rating + stats */}
        <View className="flex-row gap-4 mb-4">
          {proAvgRating != null ? (
            <View className="flex-row items-center gap-1.5">
              <StarRating value={Math.round(proAvgRating)} readonly size={16} />
              <Text className="text-sm font-semibold text-foreground">
                {proAvgRating.toFixed(1)}
              </Text>
              <Text className="text-sm text-muted-foreground">
                ({reviews.length})
              </Text>
            </View>
          ) : null}
          {proClientsCount != null ? (
            <Text className="text-sm text-muted-foreground">
              {proClientsCount} clientes
            </Text>
          ) : null}
        </View>

        {/* Specialties */}
        {(pro.pro_specialties as string[] | null)?.length ? (
          <View className="flex-row flex-wrap gap-2 mb-4">
            {(pro.pro_specialties as string[]).map((s) => (
              <Badge key={s} variant="default">{s}</Badge>
            ))}
          </View>
        ) : null}

        {/* Bio */}
        {Boolean(pro.bio) && (
          <Card className="mb-5">
            <Text className="text-sm text-foreground leading-5">{pro.bio as string}</Text>
          </Card>
        )}

        {/* Book button */}
        <Button
          size="lg"
          fullWidth
          onPress={() => router.push({ pathname: "/(client)/booking", params: { proId: id } })}
          style={{ marginBottom: 24 }}
        >
          Prendre rendez-vous
        </Button>

        {/* Services */}
        {services.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">Prestations</Text>
            {services.map((s) => {
              const svc = s as Record<string, unknown>;
              return (
                <View
                  key={String(svc.id)}
                  className="flex-row items-center justify-between py-3 border-b border-border"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-medium text-foreground">
                      {String(svc.name ?? svc.nom ?? "")}
                    </Text>
                    {svc.description != null ? (
                      <Text className="text-sm text-muted-foreground mt-0.5" numberOfLines={2}>
                        {String(svc.description)}
                      </Text>
                    ) : null}
                    <Text className="text-sm text-muted-foreground mt-0.5">
                      {String(svc.duration_minutes ?? svc.tempsBloque ?? 60)} min
                    </Text>
                  </View>
                  <Text className="text-base font-bold text-primary">
                    {Number(svc.price ?? svc.prixBase ?? 0).toFixed(2)} €
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Instagram gallery */}
        {igPhotos && igPhotos.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Instagram
            </Text>
            <FlatList
              horizontal
              data={igPhotos}
              keyExtractor={(item) => String(item.media_id)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: String(item.media_url) }}
                  style={{ width: 120, height: 120, borderRadius: 12, marginRight: 8 }}
                  contentFit="cover"
                />
              )}
            />
          </View>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View>
            <Text className="text-lg font-semibold text-foreground mb-3">
              Avis ({reviews.length})
            </Text>
            {(reviews as Array<Record<string, unknown>>).slice(0, 5).map((r) => (
              <Card key={String(r.id)} elevated className="mb-3">
                <View className="flex-row items-center gap-2 mb-2">
                  <StarRating value={Number(r.rating)} readonly size={14} />
                  <Text className="text-xs text-muted-foreground">
                    {new Date(String(r.created_at)).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                {r.comment != null ? (
                  <Text className="text-sm text-foreground leading-5">
                    {String(r.comment)}
                  </Text>
                ) : null}
                <Text className="text-xs text-muted-foreground mt-1">
                  — {String(r.client_first_name ?? "")} {String(r.client_last_name ?? "").charAt(0)}.
                </Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
