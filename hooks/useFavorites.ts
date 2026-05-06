import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { favoritesApi } from "@/lib/api";

export function useFavorites() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favoritesApi.getAll(),
  });

  const addMutation = useMutation({
    mutationFn: (proId: number) => favoritesApi.add(proId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (proId: number) => favoritesApi.remove(proId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const favorites = (data?.data as Array<{ id: number; pro_id?: number }> | undefined) ?? [];

  const isFavorited = (proId: number) =>
    favorites.some((f) => f.pro_id === proId || f.id === proId);

  const toggle = (proId: number) => {
    if (isFavorited(proId)) {
      removeMutation.mutate(proId);
    } else {
      addMutation.mutate(proId);
    }
  };

  return {
    favorites,
    isLoading,
    isFavorited,
    toggle,
    isToggling: addMutation.isPending || removeMutation.isPending,
  };
}
