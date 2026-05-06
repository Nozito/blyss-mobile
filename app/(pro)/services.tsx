import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Switch,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { Ionicons } from "@expo/vector-icons";
import { proApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Colors } from "@/constants/colors";

type Service = {
  id: number;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  active?: boolean;
};

type FormData = {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
};

export default function ServicesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pro-services"],
    queryFn: () => proApi.getServices(),
  });

  const createMutation = useMutation({
    mutationFn: (d: Parameters<typeof proApi.createService>[0]) => proApi.createService(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-services"] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof proApi.updateService>[1] }) =>
      proApi.updateService(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pro-services"] });
      setShowModal(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => proApi.deleteService(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pro-services"] }),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { name: "", description: "", price: "", duration_minutes: "60" },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: "", description: "", price: "", duration_minutes: "60" });
    setShowModal(true);
  };

  const openEdit = (svc: Service) => {
    setEditing(svc);
    reset({
      name: svc.name,
      description: svc.description ?? "",
      price: String(svc.price),
      duration_minutes: String(svc.duration_minutes),
    });
    setShowModal(true);
  };

  const onSubmit = (fd: FormData) => {
    const payload = {
      name: fd.name,
      description: fd.description,
      price: parseFloat(fd.price),
      duration_minutes: parseInt(fd.duration_minutes, 10),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const services = (data?.data as Service[] | undefined) ?? [];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4">
        <Text className="text-2xl font-bold text-foreground tracking-tight">
          Prestations
        </Text>
        <Pressable
          onPress={openCreate}
          className="w-9 h-9 rounded-2xl items-center justify-center"
          style={{ backgroundColor: Colors.primary }}
        >
          <Ionicons name="add" size={22} color="white" />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshing={false}
          onRefresh={refetch}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Ionicons name="sparkles-outline" size={48} color={Colors.border} />
              <Text className="text-lg font-semibold text-foreground mt-4">
                Aucune prestation
              </Text>
              <Text className="text-muted-foreground mt-1 text-center">
                Créez votre première prestation
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card elevated className="mb-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-base font-semibold text-foreground flex-1">
                      {item.name}
                    </Text>
                    {item.active === false && (
                      <Badge variant="secondary" size="sm">Inactif</Badge>
                    )}
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Text className="text-lg font-bold text-primary">
                      {typeof item.price === "number"
                        ? item.price.toFixed(2)
                        : parseFloat(String(item.price ?? "0")).toFixed(2)} €
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {item.duration_minutes} min
                    </Text>
                  </View>
                  {item.description && (
                    <Text className="text-sm text-muted-foreground mt-1" numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>

                <View className="flex-row gap-1">
                  <Pressable
                    onPress={() => openEdit(item)}
                    className="p-2 bg-primary/10 rounded-xl"
                  >
                    <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Supprimer", `Supprimer "${item.name}" ?`, [
                        { text: "Non", style: "cancel" },
                        {
                          text: "Supprimer",
                          style: "destructive",
                          onPress: () => deleteMutation.mutate(item.id),
                        },
                      ])
                    }
                    className="p-2 bg-destructive/10 rounded-xl"
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Modal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? "Modifier la prestation" : "Nouvelle prestation"}
        bottomSheet
      >
        <View className="gap-4">
          <Controller
            control={control}
            name="name"
            rules={{ required: "Nom requis" }}
            render={({ field: { onChange, value } }) => (
              <Input label="Nom" value={value} onChangeText={onChange} error={errors.name?.message} />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <Input label="Description (optionnel)" value={value} onChangeText={onChange} />
            )}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller
                control={control}
                name="price"
                rules={{ required: "Prix requis" }}
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Prix (€)"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                    error={errors.price?.message}
                  />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller
                control={control}
                name="duration_minutes"
                rules={{ required: "Durée requise" }}
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Durée (min)"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    error={errors.duration_minutes?.message}
                  />
                )}
              />
            </View>
          </View>
          <Button
            onPress={handleSubmit(onSubmit)}
            loading={createMutation.isPending || updateMutation.isPending}
            fullWidth
            style={{ backgroundColor: Colors.primary }}
          >
            {editing ? "Mettre à jour" : "Créer"}
          </Button>
        </View>
      </Modal>
    </View>
  );
}
