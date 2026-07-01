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

jest.mock('@/components/ui/AnimatedPressable', () => ({
  AnimatedIconButton: ({ children, onPress }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
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

jest.mock('@/lib/api', () => ({
  proApi: {
    getServices: (...args: any[]) => mockGetServices(...args),
    createService: (...args: any[]) => mockCreateService(...args),
    updateService: (...args: any[]) => mockUpdateService(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderServiceForm(id?: string) {
  if (id) {
    const ExpoRouter = require('expo-router');
    ExpoRouter.useLocalSearchParams = () => ({ id });
  }
  const ServiceFormScreen = require('../../../app/(pro)/(profile)/service-form').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ServiceFormScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ServiceFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServices.mockResolvedValue({ success: true, data: [] });
    mockCreateService.mockResolvedValue({ success: true, data: { id: 10, name: 'Test' } });
    mockUpdateService.mockResolvedValue({ success: true });
    // Reset router mock to create mode
    const ExpoRouter = require('expo-router');
    ExpoRouter.useLocalSearchParams = () => ({});
  });

  it('renders "Nouvelle prestation" title in create mode', () => {
    const { getByText } = renderServiceForm();
    expect(getByText('Nouvelle prestation')).toBeTruthy();
  });

  it('renders empty name field in create mode', () => {
    const { getByPlaceholderText } = renderServiceForm();
    expect(getByPlaceholderText('Ex : Pose gel full cover')).toBeTruthy();
  });

  it('renders price field', () => {
    const { getByPlaceholderText } = renderServiceForm();
    expect(getByPlaceholderText('Ex : 55')).toBeTruthy();
  });

  it('renders duration preset buttons', () => {
    const { getByText } = renderServiceForm();
    expect(getByText('30min')).toBeTruthy();
    expect(getByText('45min')).toBeTruthy();
    expect(getByText('1h')).toBeTruthy();
    expect(getByText('1h30')).toBeTruthy();
    expect(getByText('2h')).toBeTruthy();
  });

  it('renders Créer la prestation CTA', () => {
    const { getByText } = renderServiceForm();
    expect(getByText('Créer la prestation')).toBeTruthy();
  });

  it('calls createService on submit with valid data', async () => {
    const { getByPlaceholderText, getByText } = renderServiceForm();
    // Fill in name
    fireEvent.changeText(getByPlaceholderText('Ex : Pose gel full cover'), 'Pose gel');
    // Fill in price
    fireEvent.changeText(getByPlaceholderText('Ex : 55'), '45');
    // Submit
    fireEvent.press(getByText('Créer la prestation'));
    await waitFor(() => {
      expect(mockCreateService).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pose gel', price: 45 })
      );
    });
  });

  it('shows error when submitting with invalid price', async () => {
    const { getByPlaceholderText, getByText, findByText } = renderServiceForm();
    fireEvent.changeText(getByPlaceholderText('Ex : Pose gel full cover'), 'Pose gel');
    fireEvent.changeText(getByPlaceholderText('Ex : 55'), 'abc'); // invalid price
    fireEvent.press(getByText('Créer la prestation'));
    await findByText('Le prix doit être un nombre positif.');
  });
});
