import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { adminApi } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";
import { useDebounce } from "@/hooks/useDebounce";

type AdminUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: "client" | "pro";
  is_active: boolean;
  created_at: string;
  profile_photo?: string | null;
};

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: () => adminApi.getUsers({ search: debouncedSearch || undefined, limit: 50 }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => adminApi.deactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => adminApi.reactivateUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const users = (data?.data as AdminUser[] | undefined) ?? [];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-foreground tracking-tight mb-4">
          Utilisateurs
        </Text>
        <View className="flex-row items-center gap-2 bg-card border border-border rounded-2xl px-4 h-11">
          <Ionicons name="search-outline" size={16} color={Colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher…"
            placeholderTextColor={Colors.mutedForeground}
            className="flex-1 text-sm text-foreground"
            autoCorrect={false}
          />
        </View>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 bg-card rounded-2xl p-4 mb-2">
              <Avatar
                name={`${item.first_name} ${item.last_name}`}
                size={44}
              />
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-foreground">
                    {item.first_name} {item.last_name}
                  </Text>
                  <Badge variant={item.role === "pro" ? "default" : "secondary"} size="sm">
                    {item.role}
                  </Badge>
                </View>
                <Text className="text-sm text-muted-foreground">{item.email}</Text>
                {!item.is_active && (
                  <Badge variant="destructive" size="sm">Désactivé</Badge>
                )}
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    item.is_active ? "Désactiver" : "Réactiver",
                    `${item.is_active ? "Désactiver" : "Réactiver"} ${item.first_name} ?`,
                    [
                      { text: "Non", style: "cancel" },
                      {
                        text: "Confirmer",
                        style: item.is_active ? "destructive" : "default",
                        onPress: () =>
                          item.is_active
                            ? deactivateMutation.mutate(item.id)
                            : reactivateMutation.mutate(item.id),
                      },
                    ]
                  )
                }
                className="p-2"
              >
                <Ionicons
                  name={item.is_active ? "ban-outline" : "checkmark-circle-outline"}
                  size={20}
                  color={item.is_active ? Colors.destructive : Colors.success}
                />
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}
