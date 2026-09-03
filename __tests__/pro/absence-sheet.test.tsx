import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

const mockCreate = jest.fn();
const mockGet = jest.fn();
const mockDelete = jest.fn();
const mockToast = jest.fn();

jest.mock("@/lib/api", () => ({
  proApi: {
    createUnavailability: (...a: any[]) => mockCreate(...a),
    getUnavailabilities: (...a: any[]) => mockGet(...a),
    deleteUnavailability: (...a: any[]) => mockDelete(...a),
  },
}));
jest.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, visible }: any) => (visible ? children : null),
}));
jest.mock("@/hooks/useThemeColors", () => ({
  useThemeColors: () => new Proxy({}, { get: () => "#888" }),
  useIsDarkMode: () => false,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/lib/dateUtils", () => ({
  toLocalDate: (d: Date) => d.toISOString().slice(0, 10),
}));
jest.mock("@/components/ui/ErrorMessage", () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require("react-native");
    return <Text>{message}</Text>;
  },
}));
jest.mock("@/components/ui/LoadingButton", () => ({
  LoadingButton: ({ label, onPress, loading, disabled }: any) => {
    const { Text, Pressable } = require("react-native");
    return (
      <Pressable onPress={disabled ? undefined : onPress} accessibilityState={{ disabled, busy: loading }}>
        <Text>{label}</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/components/ui/AnimatedPressable", () => {
  const { Pressable } = require("react-native");
  return {
    AnimatedPressable: ({ children, onPress }: any) => <Pressable onPress={onPress}>{children}</Pressable>,
    AnimatedIconButton: ({ children, onPress, accessibilityLabel }: any) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel}>{children}</Pressable>
    ),
  };
});
// Le picker natif : un bouton qui pousse une date fixe dans onChange.
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onChange, testID }: any) => (
      <Pressable testID={testID ?? "picker"} onPress={() => onChange({}, new Date("2026-10-01T12:00:00Z"))}>
        <Text>pick</Text>
      </Pressable>
    ),
  };
});

import { AbsenceSheet } from "@/components/screens/pro/calendar/AbsenceSheet";

const setup = (props: Partial<React.ComponentProps<typeof AbsenceSheet>> = {}) => {
  const onChanged = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <AbsenceSheet visible onClose={onClose} unavailabilities={[]} onChanged={onChanged} {...props} />
  );
  return { onChanged, onClose, ...utils };
};

beforeEach(() => jest.clearAllMocks());

describe("AbsenceSheet", () => {
  it("état vide : message dédié, pas de liste", () => {
    const { queryByText, getByText } = setup({ unavailabilities: [] });
    expect(queryByText(/Absences planifiées/)).toBeNull();
    expect(getByText("Aucune absence planifiée")).toBeTruthy();
  });

  it("état chargement : indicateur, ni liste ni message vide", () => {
    const { queryByText, UNSAFE_getAllByType } = setup({ unavailabilities: [], loading: true });
    expect(queryByText("Aucune absence planifiée")).toBeNull();
    const { ActivityIndicator } = require("react-native");
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it("CTA désactivé tant que les deux dates ne sont pas choisies", () => {
    const { getByText } = setup();
    expect(getByText("Sélectionne les dates")).toBeTruthy();
  });

  it("succès : crée l'absence puis rafraîchit la liste via onChanged", async () => {
    mockCreate.mockResolvedValue({ success: true });
    mockGet.mockResolvedValue({ success: true, data: [{ id: 9, start_date: "2026-10-01", end_date: "2026-10-01", reason: null }] });
    const { getByText, getAllByText, onChanged, onClose } = setup();

    fireEvent.press(getAllByText("Sélectionner une date")[0]); // ouvre picker "Du"
    fireEvent.press(getAllByText("pick")[0]);
    fireEvent.press(getAllByText("Sélectionner une date")[0]); // ouvre picker "Au"
    fireEvent.press(getAllByText("pick")[0]);

    fireEvent.press(getByText("Bloquer la période"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalled();
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith([
      { id: 9, start_date: "2026-10-01", end_date: "2026-10-01", reason: null },
    ]));
    expect(onClose).toHaveBeenCalled();
  });

  it("erreur : affiche le message si l'API échoue", async () => {
    mockCreate.mockRejectedValue(new Error("boom"));
    const { getByText, getAllByText, findByText } = setup();
    fireEvent.press(getAllByText("Sélectionner une date")[0]);
    fireEvent.press(getAllByText("pick")[0]);
    fireEvent.press(getAllByText("Sélectionner une date")[0]);
    fireEvent.press(getAllByText("pick")[0]);
    fireEvent.press(getByText("Bloquer la période"));
    expect(await findByText("Impossible d'enregistrer la période")).toBeTruthy();
  });

  it("suppression : optimiste + rollback + toast si l'API échoue", async () => {
    mockDelete.mockResolvedValue({ success: false, error: "nope" });
    const list = [{ id: 3, start_date: "2026-10-05", end_date: "2026-10-05", reason: "Congé" }];
    const { getByLabelText, onChanged } = setup({ unavailabilities: list });
    fireEvent.press(getByLabelText("Supprimer cette période d'absence"));
    // retrait optimiste
    expect(onChanged).toHaveBeenCalledWith([]);
    // rollback
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(list));
    expect(mockToast).toHaveBeenCalledWith("Impossible de supprimer cette absence", "error");
  });
});
