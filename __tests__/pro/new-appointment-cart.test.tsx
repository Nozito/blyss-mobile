/**
 * Tests — panier V3 dans l'ajout manuel pro (NewAppointmentSheet).
 * Réf : doc §2, §12, §16.
 *
 * Couvre les comportements qu'un test de logique pure (lib/cart.ts) ne peut
 * pas exercer seul : navigation entre étapes, persistance du panier au fil
 * des étapes, blocage du choix de créneau tant que le panier n'a pas au
 * moins 1 prestation, transmission finale en items[].
 */
import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, visible }: any) => (visible ? children : null),
}));

// Le picker natif : un bouton qui pousse une date fixe (loin dans le futur,
// hors seuil des 14 jours d'exécution anticipée) dans onChange — même
// pattern que __tests__/pro/absence-sheet.test.tsx.
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

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, timezone: "Europe/Paris" } }),
}));

const mockSearchClients = jest.fn();
const mockGetServices = jest.fn();
const mockGetAvailability = jest.fn();
const mockCreateAppointment = jest.fn();
const mockGetVariantGroups = jest.fn();
const mockGetOptions = jest.fn();
const mockGetQuestions = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    proApi: {
      searchClients: (...args: any[]) => mockSearchClients(...args),
      getServices: (...args: any[]) => mockGetServices(...args),
      getAvailability: (...args: any[]) => mockGetAvailability(...args),
      createAppointment: (...args: any[]) => mockCreateAppointment(...args),
      updateAppointment: jest.fn(),
    },
    specialistsApi: {
      getVariantGroups: (...args: any[]) => mockGetVariantGroups(...args),
      getOptions: (...args: any[]) => mockGetOptions(...args),
      getQuestions: (...args: any[]) => mockGetQuestions(...args),
    },
  };
});

import { NewAppointmentSheet } from "@/components/screens/pro/calendar/NewAppointmentSheet";

const CLIENT = { id: 42, first_name: "Léa", last_name: "Martin", phone_number: null, email: "lea@test.fr", profile_photo: null };
const PRESTATION_A = { id: 10, name: "Manucure gel", price: 45, duration_minutes: 60, active: true };
const PRESTATION_B = { id: 11, name: "Pose vernis", price: 20, duration_minutes: 30, active: true };
const PRESTATION_C = { id: 12, name: "Nail art", price: 15, duration_minutes: 20, active: true };

function noConfig() {
  mockGetVariantGroups.mockResolvedValue({ success: true, data: [] });
  mockGetOptions.mockResolvedValue({ success: true, data: [] });
  mockGetQuestions.mockResolvedValue({ success: true, data: [] });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetServices.mockResolvedValue({ success: true, data: [PRESTATION_A, PRESTATION_B, PRESTATION_C] });
  mockSearchClients.mockResolvedValue({ success: true, data: [CLIENT] });
  mockGetAvailability.mockResolvedValue({
    success: true,
    data: { timezone: "Europe/Paris", requested_duration_minutes: 60, total_blocked_minutes: 60, days: [] },
  });
  noConfig();
});

async function openToServiceList() {
  const utils = render(
    <NewAppointmentSheet visible onClose={jest.fn()} onSaved={jest.fn()} editing={null} />
  );
  fireEvent.changeText(utils.getByPlaceholderText("Rechercher parmi mes clientes"), "Léa");
  await waitFor(() => expect(utils.getByText("Léa Martin")).toBeTruthy());
  fireEvent.press(utils.getByText("Léa Martin"));
  await waitFor(() => expect(utils.getByText(PRESTATION_A.name)).toBeTruthy());
  return utils;
}

describe("Cas simple — 1 prestation sans configuration (parcours identique à avant le panier)", () => {
  it("sélectionner une prestation simple saute directement à l'étape créneaux, sans écran panier intermédiaire", async () => {
    const utils = await openToServiceList();
    fireEvent.press(utils.getByText(PRESTATION_A.name));

    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());
    // Aucune trace d'un encart panier — un seul item, pas de recap nécessaire.
    expect(utils.queryByText("Déjà ajoutées")).toBeNull();
  });
});

describe("Ajout de plusieurs prestations", () => {
  it("ajouter une 2e prestation reste sur la liste avec un encart panier, n'avance pas seule à l'étape 3", async () => {
    const utils = await openToServiceList();
    fireEvent.press(utils.getByText(PRESTATION_A.name));
    await waitFor(() => expect(mockGetVariantGroups).toHaveBeenCalledWith(PRESTATION_A.id));

    // 1ère prestation simple : avance direct à l'étape 3 (cas simple).
    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());

    // Retour à la liste pour ajouter une 2e prestation (panier désormais non vide).
    fireEvent.press(utils.getByText(/Manucure gel/));
    await waitFor(() => expect(utils.getByText(PRESTATION_B.name)).toBeTruthy());
    fireEvent.press(utils.getByText(PRESTATION_B.name));

    // Cette fois on reste à l'étape 2 (liste), avec le panier affiché.
    await waitFor(() => expect(utils.getByText("Déjà ajoutées")).toBeTruthy());
    expect(utils.getByText("2. Choisis la ou les prestations")).toBeTruthy();
  });

  it("ajouter une 3e prestation accumule les 3 dans le panier avec le total correct", async () => {
    const utils = await openToServiceList();
    fireEvent.press(utils.getByText(PRESTATION_A.name)); // 45€/60min, simple → step3
    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());

    fireEvent.press(utils.getByText(/Manucure gel/)); // retour liste
    await waitFor(() => expect(utils.getByText(PRESTATION_B.name)).toBeTruthy());
    fireEvent.press(utils.getByText(PRESTATION_B.name)); // +20€/30min
    await waitFor(() => expect(utils.getByText("Déjà ajoutées")).toBeTruthy());

    fireEvent.press(utils.getByText(PRESTATION_C.name)); // +15€/20min
    await waitFor(() => {
      // 3 items désormais listés dans l'encart panier.
      expect(utils.getAllByText(/€$/).length).toBeGreaterThanOrEqual(3);
    });

    // CTA de bas de liste affiche le total (45+20+15 = 80€).
    expect(utils.getByText(/Voir les disponibilités · 80,00 €/)).toBeTruthy();
  });
});

describe("Suppression d'un item", () => {
  it("retirer un item du panier réduit le total et le fait disparaître de la liste", async () => {
    const utils = await openToServiceList();
    fireEvent.press(utils.getByText(PRESTATION_A.name));
    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());
    fireEvent.press(utils.getByText(/Manucure gel/));
    await waitFor(() => expect(utils.getByText(PRESTATION_B.name)).toBeTruthy());
    fireEvent.press(utils.getByText(PRESTATION_B.name));
    await waitFor(() => expect(utils.getByText("Déjà ajoutées")).toBeTruthy());

    // Retire "Manucure gel" du panier (reste "Pose vernis" seul, 20€) — la
    // prestation reste sélectionnable dans la liste, seule son entrée dans
    // l'encart panier ("Déjà ajoutées") doit disparaître.
    fireEvent.press(utils.getByLabelText(`Retirer ${PRESTATION_A.name}`));

    await waitFor(() => {
      // Une seule occurrence restante : la ligne sélectionnable de la liste
      // (l'entrée panier a été retirée).
      expect(utils.getAllByText(PRESTATION_A.name)).toHaveLength(1);
    });
    expect(utils.getByText(/Voir les disponibilités · 20,00 €/)).toBeTruthy();
  });
});

describe("Retour au configurateur / à la liste sans perte d'état du panier", () => {
  it("le panier déjà constitué survit à un aller-retour vers la liste des prestations", async () => {
    const utils = await openToServiceList();
    fireEvent.press(utils.getByText(PRESTATION_A.name));
    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());

    // step3 → step2 (retour explicite)
    fireEvent.press(utils.getByText(/Manucure gel/));
    await waitFor(() => expect(utils.getByText(PRESTATION_B.name)).toBeTruthy());

    // Le premier item est toujours dans le panier, visible dans l'encart
    // (en plus de son entrée dans la liste des prestations disponibles).
    expect(utils.getByText("Déjà ajoutées")).toBeTruthy();
    expect(utils.getAllByText(PRESTATION_A.name).length).toBeGreaterThanOrEqual(2);
  });
});

describe("Blocage : pas de créneau tant que le panier n'est pas finalisé", () => {
  it("le moteur de dispo n'est interrogé qu'une fois au moins 1 prestation dans le panier, jamais avant", async () => {
    const utils = render(
      <NewAppointmentSheet visible onClose={jest.fn()} onSaved={jest.fn()} editing={null} />
    );
    fireEvent.changeText(utils.getByPlaceholderText("Rechercher parmi mes clientes"), "Léa");
    await waitFor(() => expect(utils.getByText("Léa Martin")).toBeTruthy());
    fireEvent.press(utils.getByText("Léa Martin"));
    await waitFor(() => expect(utils.getByText(PRESTATION_A.name)).toBeTruthy());

    // Toujours à l'étape 2 (choix des prestations) — le moteur de dispo
    // n'a aucune raison d'avoir été appelé, le panier est vide.
    expect(mockGetAvailability).not.toHaveBeenCalled();
  });
});

describe("Transmission finale au backend en items[]", () => {
  it("soumettre un panier à 2 prestations envoie items[] dans cet ordre, avec les bons ids", async () => {
    const utils = await openToServiceList();
    fireEvent.press(utils.getByText(PRESTATION_A.name));
    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());
    fireEvent.press(utils.getByText(/Manucure gel/));
    await waitFor(() => expect(utils.getByText(PRESTATION_B.name)).toBeTruthy());
    fireEvent.press(utils.getByText(PRESTATION_B.name));
    await waitFor(() => expect(utils.getByText("Déjà ajoutées")).toBeTruthy());
    fireEvent.press(utils.getByText(/Voir les disponibilités/));

    await waitFor(() => expect(utils.getByText("3. Date & heure")).toBeTruthy());
    expect(mockGetAvailability).toHaveBeenCalledWith(
      expect.objectContaining({ serviceIds: [10, 11], durationOverrides: [60, 30] })
    );

    // Choisit une date loin dans le futur (hors seuil des 14 jours) puis une
    // heure manuelle — aucun créneau calculé n'est retourné par le mock.
    fireEvent.press(utils.getByLabelText("Date"));
    fireEvent.press(utils.getByText("pick"));
    fireEvent.press(utils.getByLabelText("Valider la date"));
    await waitFor(() => expect(utils.getByText("14:00")).toBeTruthy());
    fireEvent.press(utils.getByText("14:00"));

    mockCreateAppointment.mockResolvedValue({ success: true, data: { id: 99, price: 65, override_applied: null } });
    fireEvent.press(utils.getByText("Créer le rendez-vous"));

    await waitFor(() => expect(mockCreateAppointment).toHaveBeenCalled());
    const payload = mockCreateAppointment.mock.calls[0][0];
    expect(payload.items).toEqual([
      { prestation_id: 10, selected_variant_value_ids: [], selected_option_ids: [], answers: [] },
      { prestation_id: 11, selected_variant_value_ids: [], selected_option_ids: [], answers: [] },
    ]);
  });
});
