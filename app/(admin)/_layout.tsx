import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";

// SDK 57 : Icon / Label / VectorIcon vivent sous NativeTabs.Trigger.
const { Icon, Label, VectorIcon } = NativeTabs.Trigger;
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ADMIN } from "@/constants/adminTheme";

export default function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen backgroundColor={ADMIN.bg} />;
  if (!user || !user.is_admin) return <Redirect href="/(auth)/login" />;

  return (
    <NativeTabs
      blurEffect="systemUltraThinMaterialDark"
      tintColor={ADMIN.accent}
      minimizeBehavior="never"
      labelVisibilityMode="unlabeled"
    >
      <NativeTabs.Trigger name="dashboard">
        <Icon src={<VectorIcon family={Ionicons} name="grid-outline" />} />
        {/* hidden: keeps "Accueil" as the accessible name (VoiceOver/TalkBack) without showing it under the icon */}
        <Label hidden>Accueil</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="users">
        <Icon src={<VectorIcon family={Ionicons} name="people-outline" />} />
        <Label hidden>Utilisateurs</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <Icon src={<VectorIcon family={Ionicons} name="calendar-outline" />} />
        <Label hidden>Réservations</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="payments">
        <Icon src={<VectorIcon family={Ionicons} name="card-outline" />} />
        <Label hidden>Paiements</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <Icon src={<VectorIcon family={Ionicons} name="person-circle-outline" />} />
        <Label hidden>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
