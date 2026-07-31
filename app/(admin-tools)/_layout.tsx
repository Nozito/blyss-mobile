import React from "react";
import { Redirect } from "expo-router";
import { Stack } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminToolsLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user || !user.is_admin) return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_bottom" }} />
  );
}
