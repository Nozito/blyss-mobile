import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function ShareRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace({ pathname: "/specialist/[id]", params: { id } });
    } else {
      router.replace("/");
    }
  }, [id]);

  return null;
}
