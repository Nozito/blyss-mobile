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
  min_price: number | null;
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
          min_price: f.min_price ?? null,
        };
      });
    },
    enabled: !authLoading && !!isAuthenticated,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 2,
  });

  // apiCall() ne rejette jamais — sans ces throws, un échec métier (ex. token
  // expiré, pro introuvable) laissait le rollback ci-dessous ne jamais se
  // déclencher : l'état optimiste finissait par se corriger au prochain
  // `onSettled`/refetch, mais silencieusement, sans jamais prévenir l'utilisateur.
  //
  // add/remove sont deux mutations distinctes plutôt qu'un seul "toggle" qui
  // relirait `favorites` dans son mutationFn : cette relecture tardive pouvait
  // retomber sur l'état déjà retourné par onMutate (re-render entre les deux),
  // et donc appeler l'action inverse de celle décidée par l'utilisateur. Ici
  // l'action (add ou remove) est fixée une fois pour toutes au moment du clic,
  // dans `toggle()`.
  const addMutation = useMutation({
    mutationFn: async (proId: number) => {
      const res = await favoritesApi.add(proId);
      if (!res.success) throw new Error(res.error ?? "Impossible d'ajouter aux favoris");
      return res;
    },
    onMutate: async (proId: number) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const prev = qc.getQueryData<Specialist[]>(["favorites"]);
      qc.setQueryData<Specialist[]>(["favorites"], (old = []) =>
        old.some((f) => f.id === proId)
          ? old
          : [
              ...old,
              {
                id: proId,
                business_name: "",
                specialty: "",
                city: "",
                rating: 0,
                reviews_count: 0,
                profile_image_url: null,
                cover_image_url: null,
                first_name: "",
                distance_km: null,
                min_price: null,
              },
            ]
      );
      return { prev };
    },
    onError: (_err, _proId, ctx) => {
      if (ctx?.prev) qc.setQueryData(["favorites"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (proId: number) => {
      const res = await favoritesApi.remove(proId);
      if (!res.success) throw new Error(res.error ?? "Impossible de retirer des favoris");
      return res;
    },
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
      // Un double-tap rapide déclenchait deux appels add/remove coup sur coup
      // (rien n'avait encore changé visuellement entre les deux taps).
      if (addMutation.isPending || removeMutation.isPending) return;
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

  return {
    favorites,
    // true uniquement tant qu'aucune donnée n'a jamais été reçue
    isLoading: authLoading || isPending,
    isAuthLoading: authLoading,
    isFetching,
    refetch,
    isFavorited,
    toggle,
    isToggling: addMutation.isPending || removeMutation.isPending,
  };
}
