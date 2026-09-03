import React from "react";
import { render } from "@testing-library/react-native";

const mockNet = { isConnected: true };

jest.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockNet,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return { BlurView: ({ children, ...p }: any) => <View {...p}>{children}</View> };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/hooks/useThemeColors", () => ({
  useThemeColors: () => ({ foreground: "#111" }),
  useIsDarkMode: () => false,
}));

import { OfflineBanner } from "@/components/ui/OfflineBanner";

describe("OfflineBanner", () => {
  it("affiche le message quand hors connexion", () => {
    mockNet.isConnected = false;
    const { getByText } = render(<OfflineBanner />);
    const label = getByText("Pas de connexion internet");
    expect(label.props.accessibilityRole).toBe("alert");
  });

  it("reste monté (animé) même connecté, sous la safe area", () => {
    mockNet.isConnected = true;
    const { getByText } = render(<OfflineBanner />);
    // le composant ne se démonte pas : il s'anime hors écran
    expect(getByText("Pas de connexion internet")).toBeTruthy();
  });
});
