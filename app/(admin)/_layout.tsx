import React from "react";
import { Redirect } from "expo-router";
import { NativeTabs, Icon } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
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
      minimizeBehavior="automatic"
      labelVisibilityMode="unlabeled"
      tabBarStyle={{
        backgroundColor: "rgba(10,10,15,0.85)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
      }}
    >
      <NativeTabs.Trigger name="dashboard">
        <Icon src={{ default: <SymbolView name="grid" renderingMode="monochrome" />, selected: <SymbolView name="grid.fill" renderingMode="hierarchical" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users">
        <Icon src={{ default: <SymbolView name="person.2" renderingMode="monochrome" />, selected: <SymbolView name="person.2.fill" renderingMode="hierarchical" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bookings">
        <Icon src={{ default: <SymbolView name="calendar" renderingMode="monochrome" />, selected: <SymbolView name="calendar.fill" renderingMode="hierarchical" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="payments">
        <Icon src={{ default: <SymbolView name="creditcard" renderingMode="monochrome" />, selected: <SymbolView name="creditcard.fill" renderingMode="hierarchical" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon src={{ default: <SymbolView name="ellipsis.circle" renderingMode="monochrome" />, selected: <SymbolView name="ellipsis.circle.fill" renderingMode="hierarchical" /> }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="analytics"     hidden />
      <NativeTabs.Trigger name="logs"          hidden />
      <NativeTabs.Trigger name="notifications" hidden />
      <NativeTabs.Trigger name="coupons"       hidden />
    </NativeTabs>
  );
}
