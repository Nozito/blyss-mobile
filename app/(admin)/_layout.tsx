import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon, Label, VectorIcon } from "expo-router/unstable-native-tabs";
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
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="grid-outline" />,
          selected: <VectorIcon family={Ionicons} name="grid" />,
        }} />
        {/* hidden: keeps "Accueil" as the accessible name (VoiceOver/TalkBack) without showing it under the icon */}
        <Label hidden>Accueil</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="users">
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="people-outline" />,
          selected: <VectorIcon family={Ionicons} name="people" />,
        }} />
        <Label hidden>Utilisateurs</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="calendar-outline" />,
          selected: <VectorIcon family={Ionicons} name="calendar" />,
        }} />
        <Label hidden>Réservations</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="payments">
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="card-outline" />,
          selected: <VectorIcon family={Ionicons} name="card" />,
        }} />
        <Label hidden>Paiements</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <Icon src={{
          default: <VectorIcon family={Ionicons} name="person-circle-outline" />,
          selected: <VectorIcon family={Ionicons} name="person-circle" />,
        }} />
        <Label hidden>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
