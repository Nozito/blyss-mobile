import { useColorScheme } from "react-native";
import { LightColors, DarkColors, type ColorKey } from "@/constants/colors";

/** Palette (light ou dark) suivant le réglage système de l'appareil. */
export function useThemeColors(): Record<ColorKey, string> {
  const scheme = useColorScheme();
  return scheme === "dark" ? DarkColors : LightColors;
}

export function useIsDarkMode(): boolean {
  return useColorScheme() === "dark";
}
