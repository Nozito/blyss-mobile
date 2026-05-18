import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="help" />
      <Stack.Screen name="rgpd" />
    </Stack>
  );
}
