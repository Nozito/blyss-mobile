import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Chargement..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.is_admin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (user?.role === "pro") {
    return <Redirect href="/(pro)/dashboard" />;
  }

  return <Redirect href="/(client)" />;
}
