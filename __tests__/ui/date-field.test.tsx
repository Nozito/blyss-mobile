import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, visible }: any) => (visible ? children : null),
}));
jest.mock("@/components/ui/AnimatedPressable", () => {
  const { Pressable } = require("react-native");
  return {
    AnimatedPressable: ({ children, onPress, accessibilityLabel }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel}>{children}</Pressable>
    ),
  };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/hooks/useThemeColors", () => ({
  useThemeColors: () => new Proxy({}, { get: () => "#888" }),
  useIsDarkMode: () => false,
}));
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onChange }: any) => (
      <Pressable onPress={() => onChange({ type: "set" }, new Date("2026-10-01T12:00:00Z"))}>
        <Text>pick</Text>
      </Pressable>
    ),
  };
});

import { DateField } from "@/components/ui/DateField";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

describe("DateField (iOS)", () => {
  it("le picker est fermé au repos, ouvert au tap sur le champ", () => {
    const { queryByText, getByLabelText } = render(
      <DateField label="Du" value={null} onChange={jest.fn()} formatValue={fmt} />
    );
    expect(queryByText("pick")).toBeNull();
    fireEvent.press(getByLabelText("Du"));
    expect(queryByText("pick")).toBeTruthy();
  });

  it("OK : onChange(parent) appelé une fois, picker refermé", () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByText } = render(
      <DateField label="Du" value={null} onChange={onChange} formatValue={fmt} />
    );
    fireEvent.press(getByLabelText("Du"));
    fireEvent.press(getByText("pick"));      // draft seulement
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(getByLabelText("Valider la date"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(fmt(onChange.mock.calls[0][0])).toBe("2026-10-01");
    expect(queryByText("pick")).toBeNull(); // refermé
  });

  it("Annuler : aucun onChange, picker refermé", () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByText } = render(
      <DateField label="Du" value={null} onChange={onChange} formatValue={fmt} />
    );
    fireEvent.press(getByLabelText("Du"));
    fireEvent.press(getByText("pick"));
    fireEvent.press(getByLabelText("Annuler"));
    expect(onChange).not.toHaveBeenCalled();
    expect(queryByText("pick")).toBeNull();
  });

  it("affiche la valeur formatée quand elle existe, le placeholder sinon", () => {
    const { rerender, getByText } = render(
      <DateField label="Du" value={null} onChange={jest.fn()} formatValue={fmt} placeholder="Choisir" />
    );
    expect(getByText("Choisir")).toBeTruthy();
    rerender(<DateField label="Du" value={new Date("2026-12-25T10:00:00Z")} onChange={jest.fn()} formatValue={fmt} placeholder="Choisir" />);
    expect(getByText("2026-12-25")).toBeTruthy();
  });
});
