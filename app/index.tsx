import { useEffect } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

// Doit rester aligné sur ONBOARDING_KEY dans app/(auth)/onboarding.tsx.
const ONBOARDING_KEY = "onboarding_seen";

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      AsyncStorage.getItem(ONBOARDING_KEY)
        .then((seen) => {
          router.replace(seen === "true" ? "/(auth)/welcome" : "/(auth)/onboarding");
        })
        .catch(() => router.replace("/(auth)/welcome"));
      return;
    }

    if (user?.is_admin) {
      router.replace("/(admin)/dashboard");
    } else if (user?.role === "pro") {
      if (!user.pro_status) {
        router.replace("/pro-onboarding" as any);
      } else {
        router.replace("/(pro)/dashboard");
      }
    } else {
      router.replace("/(client)");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, user?.id, user?.role, user?.is_admin]);

  return null;
}
