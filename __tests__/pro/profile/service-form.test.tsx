import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}), // no id → create mode
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: require('../../fixtures/proUser').proUser,
    isAuthenticated: true,
    isLoading: false,
    logout: jest.fn(),
    refreshProfile: jest.fn(),
    patchUser: jest.fn(),
  }),
}));

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
}));

jest.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChangeText, placeholder, label, error, keyboardType }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          testID={`input-${label ?? placeholder}`}
        />
        {error ? <Text>{error}</Text> : null}
      </View>
    );
  },
}));

jest.mock('@/components/ui/ErrorMessage', () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

const mockGetServices = jest.fn();
const mockCreateService = jest.fn();
const mockUpdateService = jest.fn();
const mockGetVariantGroups = jest.fn();
const mockGetOptions = jest.fn();
const mockGetQuestions = jest.fn();
const mockCreateVariantGroup = jest.fn();
const mockCreateVariantValue = jest.fn();
const mockCreateOption = jest.fn();
const mockCreateQuestion = jest.fn();
const mockCreateQuestionChoice = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getServices: (...args: any[]) => mockGetServices(...args),
    createService: (...args: any[]) => mockCreateService(...args),
    updateService: (...args: any[]) => mockUpdateService(...args),
  },
  prestationConfigApi: {
    getVariantGroups: (...args: any[]) => mockGetVariantGroups(...args),
    getOptions: (...args: any[]) => mockGetOptions(...args),
    getQuestions: (...args: any[]) => mockGetQuestions(...args),
    createVariantGroup: (...args: any[]) => mockCreateVariantGroup(...args),
    createVariantValue: (...args: any[]) => mockCreateVariantValue(...args),
    createOption: (...args: any[]) => mockCreateOption(...args),
    createQuestion: (...args: any[]) => mockCreateQuestion(...args),
    createQuestionChoice: (...args: any[]) => mockCreateQuestionChoice(...args),
    detectSensitiveQuestion: jest.fn().mockResolvedValue({ success: true, data: { suggested: false, matchedKeywords: [] } }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderServiceForm(id?: string) {
  const ExpoRouter = require('expo-router');
  ExpoRouter.useLocalSearchParams = () => (id ? { id } : {});
  const ServiceFormScreen = require('../../../app/(pro)/(profile)/service-form').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ServiceFormScreen />
    </QueryClientProvider>
  );
}

const EXISTING_SERVICE = {
  id: 10,
  name: 'Pose gel',
  description: 'Pose gel sur ongle naturel',
  price: 55,
  duration_minutes: 60,
  active: true,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  pricing_mode: 'fixed',
};

describe('ServiceFormScreen — création (tunnel)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServices.mockResolvedValue({ success: true, data: [] });
    mockCreateService.mockResolvedValue({ success: true, data: { id: 42 } });
    mockUpdateService.mockResolvedValue({ success: true });
    mockGetVariantGroups.mockResolvedValue({ success: true, data: [] });
    mockGetOptions.mockResolvedValue({ success: true, data: [] });
    mockGetQuestions.mockResolvedValue({ success: true, data: [] });
    mockCreateVariantGroup.mockResolvedValue({ success: true, data: { id: 900 } });
    mockCreateVariantValue.mockResolvedValue({ success: true, data: { id: 901 } });
    mockCreateOption.mockResolvedValue({ success: true, data: { id: 902 } });
    mockCreateQuestion.mockResolvedValue({ success: true, data: { id: 903 } });
    mockCreateQuestionChoice.mockResolvedValue({ success: true, data: { id: 904 } });
  });

  it('renders step 1 with the name field', () => {
    const { getByText, getByPlaceholderText } = renderServiceForm();
    expect(getByText("Comment s'appelle ta prestation ?")).toBeTruthy();
    expect(getByPlaceholderText('Ex : Pose gel full cover')).toBeTruthy();
  });

  it('blocks step 1 → 2 when name is empty', () => {
    const { getByText, queryByText } = renderServiceForm();
    fireEvent.press(getByText('Continuer'));
    expect(getByText('Nom requis')).toBeTruthy();
    expect(queryByText('Prix & durée')).toBeNull();
  });

  it('walks through the 5 steps and creates the prestation', async () => {
    const { getByText, getByPlaceholderText } = renderServiceForm();

    fireEvent.changeText(getByPlaceholderText('Ex : Pose gel full cover'), 'Pose gel');
    fireEvent.press(getByText('Continuer'));

    expect(getByText('Prix & durée')).toBeTruthy();
    fireEvent.press(getByText('1h30'));
    fireEvent.press(getByText('Continuer'));

    expect(getByText('Temps de battement')).toBeTruthy();
    fireEvent.press(getByText('Continuer'));

    expect(getByText('Variantes, options & questions')).toBeTruthy();
    fireEvent.press(getByText('Continuer'));

    expect(getByText('Dernière vérif')).toBeTruthy();
    fireEvent.press(getByText('Créer la prestation'));

    await waitFor(() => {
      expect(mockCreateService).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pose gel', price: 30, duration_minutes: 90 })
      );
    });
    await waitFor(() => expect(getByText('Ta prestation est prête')).toBeTruthy());
  });

  it('lets the pro configure an option before the prestation is created, then creates it right after', async () => {
    const { getByText, getByPlaceholderText } = renderServiceForm();

    fireEvent.changeText(getByPlaceholderText('Ex : Pose gel full cover'), 'Pose gel');
    fireEvent.press(getByText('Continuer'));
    fireEvent.press(getByText('Continuer')); // prix & durée
    fireEvent.press(getByText('Continuer')); // battement

    expect(getByText('Variantes, options & questions')).toBeTruthy();
    fireEvent.press(getByText('Options'));
    fireEvent.press(getByText('Ajouter une option'));
    fireEvent.changeText(getByPlaceholderText('Ex : Nail Art'), 'Nail Art');
    fireEvent.press(getByText("Ajouter l'option"));

    // L'option existe déjà dans le brouillon local — rien envoyé au serveur
    // tant que la prestation elle-même n'a pas été créée.
    expect(mockCreateOption).not.toHaveBeenCalled();

    fireEvent.press(getByText('Continuer')); // vers le récap
    fireEvent.press(getByText('Créer la prestation'));

    await waitFor(() => expect(mockCreateService).toHaveBeenCalled());
    await waitFor(() => {
      expect(mockCreateOption).toHaveBeenCalledWith(42, expect.objectContaining({ name: 'Nail Art' }));
    });
    await waitFor(() => expect(getByText('Voir mes variantes & options')).toBeTruthy());
  });

  it('adjusts price with the ±5€ / ±0,50€ stepper', async () => {
    const { getByText, getByPlaceholderText, getByLabelText } = renderServiceForm();
    fireEvent.changeText(getByPlaceholderText('Ex : Pose gel full cover'), 'Pose gel');
    fireEvent.press(getByText('Continuer'));

    fireEvent.press(getByLabelText('+5'));
    fireEvent.press(getByLabelText('+0,5'));
    expect(getByText('35.5€')).toBeTruthy();
  });
});

describe('ServiceFormScreen — modification (édition + barre Enregistrer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServices.mockResolvedValue({ success: true, data: [EXISTING_SERVICE] });
    mockCreateService.mockResolvedValue({ success: true, data: { id: 42 } });
    mockUpdateService.mockResolvedValue({ success: true });
    mockGetVariantGroups.mockResolvedValue({ success: true, data: [] });
    mockGetOptions.mockResolvedValue({ success: true, data: [] });
    mockGetQuestions.mockResolvedValue({ success: true, data: [] });
  });

  it('shows the existing prestation preview and no save bar when untouched', async () => {
    const { findByText, queryByText } = renderServiceForm('10');
    expect(await findByText('Pose gel')).toBeTruthy();
    expect(queryByText('Modifications non enregistrées')).toBeNull();
  });

  it('reveals the save bar after a change and saves on tap', async () => {
    const { findByText, getByText, getByLabelText } = renderServiceForm('10');
    await findByText('Pose gel');

    fireEvent.press(getByText('Prix & durée'));
    fireEvent.press(getByLabelText('+5'));

    expect(getByText('Modifications non enregistrées')).toBeTruthy();
    fireEvent.press(getByText('Enregistrer'));

    await waitFor(() => {
      expect(mockUpdateService).toHaveBeenCalledWith(10, expect.objectContaining({ price: 60 }));
    });
  });
});
