import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { favoritesApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Specialist } from "@/components/screens/client/specialists/SpecialistCard";

interface FavoriteRaw {
  pro_id: number;
  first_name: string;
  last_name: string;
  activity_name: string | null;
  city: string | null;
  profile_photo: string | null;
  specialty: string | null;
  avg_rating: number;
  reviews_count: number;
}

export function useFavorites() {
  const qc = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const {
    data: favorites = [],
    isPending,
    isFetching,
    refetch,
  } = useQuery<Specialist[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await favoritesApi.getAll();
      if (!res.success || !Array.isArray(res.data)) return [];
      return res.data.map((raw) => {
        const f = raw as FavoriteRaw;
        return {
          id: f.pro_id,
          business_name: f.activity_name || `${f.first_name} ${f.last_name}`,
          specialty: f.specialty || "Prothésiste ongulaire",
          city: f.city || "",
          rating: Number(f.avg_rating) || 0,
          reviews_count: Number(f.reviews_count) || 0,
          profile_image_url: f.profile_photo,
          cover_image_url: null,
          first_name: f.first_name,
          distance_km: null,
        };
      });
    },
    enabled: !authLoading && !!isAuthenticated,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

  const addMutation = useMutation({
    mutationFn: (proId: number) => favoritesApi.add(proId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      return { prev: qc.getQueryData<Specialist[]>(["favorites"]) };
    },
    onError: (_err, _proId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["favorites"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (proId: number) => favoritesApi.remove(proId),
    onMutate: async (proId: number) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<Specialist[]>(["favorites"]);
      qc.setQueryData<Specialist[]>(["favorites"], (old = []) => old.filter((f) => f.id !== proId));
      return { prev };
    },
    onError: (_err, _proId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["favorites"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const isFavorited = useCallback(
    (proId: number) => favorites.some((f) => f.id === proId),
    [favorites]
  );

  const toggle = useCallback(
    (proId: number) => {
      const willFavorite = !isFavorited(proId);
      Haptics.impactAsync(
        willFavorite ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Rigid
      ).catch(() => {});
      if (willFavorite) {
        addMutation.mutate(proId);
      } else {
        removeMutation.mutate(proId);
      }
    },
    [isFavorited, addMutation, removeMutation]
  );

  const removeFavorite = useCallback(
    (proId: number) => {
      qc.setQueryData<Specialist[]>(["favorites"], (prev = []) =>
        prev.filter((f) => f.id !== proId)
      );
      qc.setQueryData<Set<number>>(["favorites-ids"], (prev = new Set()) => {
        const next = new Set(prev);
        next.delete(proId);
        return next;
      });
      favoritesApi.remove(proId).catch(() => {
        void qc.invalidateQueries({ queryKey: ["favorites"] });
        void qc.invalidateQueries({ queryKey: ["favorites-ids"] });
      });
    },
    [qc]
  );

  return {
    favorites,
    // true uniquement tant qu'aucune donnée n'a jamais été reçue
    isLoading: authLoading || isPending,
    isAuthLoading: authLoading,
    isFetching,
    refetch,
    isFavorited,
    toggle,
    removeFavorite,
    isToggling: addMutation.isPending || removeMutation.isPending,
  };
}
