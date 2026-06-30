import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { ONBOARDING_KEY } from "./(auth)/onboarding";

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const navigate = async () => {
      if (!isAuthenticated) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!seen) {
          router.replace("/(auth)/onboarding" as Parameters<typeof router.replace>[0]);
        } else {
          router.replace("/(auth)/welcome");
        }
        return;
      }

      if (user?.is_admin) {
        router.replace("/(admin)/dashboard");
      } else if (user?.role === "pro") {
        router.replace("/(pro)/dashboard");
      } else {
        router.replace("/(client)");
      }
    };

    void navigate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user?.id, user?.role, user?.is_admin]);

  return null;
}
