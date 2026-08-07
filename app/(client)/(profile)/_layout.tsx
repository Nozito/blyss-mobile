import { Stack } from "expo-router";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function ProfileLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="help" />
      <Stack.Screen name="rgpd" />
    </Stack>
  );
}
