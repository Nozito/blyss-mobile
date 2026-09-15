/**
 * Tests — panier V3 dans le parcours client (app/booking.tsx).
 * Réf : doc §2, §16.
 *
 * Complète __tests__/booking/cart.test.ts (logique pure) et
 * __tests__/pro/new-appointment-cart.test.tsx (même panier côté pro) en
 * couvrant le câblage spécifique à l'écran client : cas simple inchangé,
 * accumulation du panier, transmission finale en items[] au paiement.
 */
import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

// Références stables entre rendus (comme le vrai expo-router) : un nouvel
// objet à chaque appel ferait boucler l'effet de app/booking.tsx qui dépend
// de `router` ("Maximum update depth exceeded").
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ proId: "7" }),
  useRouter: () => mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
  Redirect: () => null,
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({ confirmPayment: jest.fn() }),
}));

const mockAuthValue = { isAuthenticated: true, isLoading: false };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const mockGetProById = jest.fn();
const mockGetServices = jest.fn();
const mockGetVariantGroups = jest.fn();
const mockGetOptions = jest.fn();
const mockGetQuestions = jest.fn();
const mockGetPublicAvailability = jest.fn();
const mockCreateReservation = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    specialistsApi: {
      getProById: (...a: any[]) => mockGetProById(...a),
      getServices: (...a: any[]) => mockGetServices(...a),
      getVariantGroups: (...a: any[]) => mockGetVariantGroups(...a),
      getOptions: (...a: any[]) => mockGetOptions(...a),
      getQuestions: (...a: any[]) => mockGetQuestions(...a),
      getPublicAvailability: (...a: any[]) => mockGetPublicAvailability(...a),
    },
    stripePaymentsApi: {
      ...actual.stripePaymentsApi,
      createReservation: (...a: any[]) => mockCreateReservation(...a),
    },
    messagesApi: { openThread: jest.fn() },
  };
});

import BookingScreen from "@/app/booking";

const PRO = {
  id: 7,
  first_name: "Camille",
  last_name: "Dupont",
  activity_name: "Camille Nails",
  city: "Lyon",
  profile_photo: null,
  accept_online_payment: false,
  stripe_onboarding_complete: false,
  deposit_percentage: 0,
  cancellation_notice_hours: 24,
  acceptance_conditions: null,
};
const PRESTATION_A = { id: 10, name: "Manucure gel", description: null, price: 45, duration_minutes: 60, active: true };
const PRESTATION_B = { id: 11, name: "Pose vernis", description: null, price: 20, duration_minutes: 30, active: true };

function noConfig() {
  mockGetVariantGroups.mockResolvedValue({ success: true, data: [] });
  mockGetOptions.mockResolvedValue({ success: true, data: [] });
  mockGetQuestions.mockResolvedValue({ success: true, data: [] });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProById.mockResolvedValue({ success: true, data: PRO });
  mockGetServices.mockResolvedValue({ success: true, data: [PRESTATION_A, PRESTATION_B] });
  mockGetPublicAvailability.mockResolvedValue({
    success: true,
    data: { timezone: "Europe/Paris", requested_duration_minutes: 60, total_blocked_minutes: 60, days: [] },
  });
  noConfig();
});

describe("Cas simple — 1 prestation (parcours V1 inchangé)", () => {
  it("choisir l'unique prestation sans configuration avance directement à l'étape créneaux", async () => {
    const utils = render(<BookingScreen />);
    await waitFor(() => expect(utils.getByText(PRESTATION_A.name)).toBeTruthy());

    fireEvent.press(utils.getByText(PRESTATION_A.name));

    await waitFor(() => expect(mockGetPublicAvailability).toHaveBeenCalled());
    // Étape créneaux atteinte : le CTA panier de l'étape 1 n'apparaît jamais.
    expect(utils.queryByText(/Voir les créneaux ·/)).toBeNull();
  });
});

describe("Panier à plusieurs prestations", () => {
  it("ajouter une 2e prestation affiche le récap panier avec le total, sans avancer seule", async () => {
    const utils = render(<BookingScreen />);
    await waitFor(() => expect(utils.getByText(PRESTATION_A.name)).toBeTruthy());
    fireEvent.press(utils.getByText(PRESTATION_A.name));
    await waitFor(() => expect(mockGetPublicAvailability).toHaveBeenCalledTimes(1));

    // Retour à l'étape 1 pour ajouter une 2e prestation (le composant garde
    // le panier — cf. app/booking.tsx handleBack, ne réinitialise jamais cartItems).
    fireEvent.press(utils.getByLabelText("Retour"));
    await waitFor(() => expect(utils.getByText("Déjà dans ton panier")).toBeTruthy());
    fireEvent.press(utils.getByText(PRESTATION_B.name));

    await waitFor(() => expect(utils.getByText(/Voir les créneaux · 65\.00€/)).toBeTruthy());

    // Cliquer le CTA panier envoie bien serviceIds + durationOverrides
    // alignés (doc §5.4) pour la disponibilité de l'étape 2.
    fireEvent.press(utils.getByText(/Voir les créneaux/));
    await waitFor(() =>
      expect(mockGetPublicAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ serviceIds: [10, 11], durationOverrides: [60, 30] })
      )
    );
  });
});
