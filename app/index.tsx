import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace("/(auth)/welcome");
    } else if (user?.is_admin) {
      router.replace("/(admin)/dashboard");
    } else if (user?.role === "pro") {
      router.replace("/(pro)/dashboard");
    } else {
      router.replace("/(client)");
    }
  // router intentionnellement exclu : nouvel objet à chaque state change nav
  // user?.id stable (primitive) au lieu de user (référence objet)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user?.id, user?.role, user?.is_admin]);

  return null;
}
