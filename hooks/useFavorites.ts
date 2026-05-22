import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (proId: number) => favoritesApi.remove(proId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const isFavorited = (proId: number) =>
    favorites.some((f) => f.id === proId);

  const toggle = (proId: number) => {
    if (isFavorited(proId)) {
      removeMutation.mutate(proId);
    } else {
      addMutation.mutate(proId);
    }
  };

  const removeFavorite = (proId: number) => {
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
  };

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
