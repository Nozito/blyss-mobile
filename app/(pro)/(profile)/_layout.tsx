import { Stack } from "expo-router";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function ProProfileLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
