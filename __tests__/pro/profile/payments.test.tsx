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
  useLocalSearchParams: () => ({}),
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
  Input: ({ value, onChangeText, placeholder, label, error, hint }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} testID={`input-${label}`} />
        {hint ? <Text>{hint}</Text> : null}
        {error ? <Text testID="iban-error">{error}</Text> : null}
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
    return <Text testID="error-msg">{message}</Text>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

const mockGetProfile = jest.fn();
const mockGetStripeAccount = jest.fn();
const mockUpdatePaymentSettings = jest.fn();
const mockStripeOnboard = jest.fn();
const mockStripeUpdateDeposit = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getProfile: (...args: any[]) => mockGetProfile(...args),
    updatePaymentSettings: (...args: any[]) => mockUpdatePaymentSettings(...args),
  },
  stripeApi: {
    getAccount: (...args: any[]) => mockGetStripeAccount(...args),
    onboard: (...args: any[]) => mockStripeOnboard(...args),
    updateDeposit: (...args: any[]) => mockStripeUpdateDeposit(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_PROFILE_DATA = {
  iban: 'FR7630006000011234567890189',
  accept_online: false,
};

const MOCK_STRIPE_NOT_CONNECTED = {
  onboarding_complete: false,
  charges_enabled: false,
  deposit_percentage: 0,
};

const MOCK_STRIPE_CONNECTED = {
  onboarding_complete: true,
  charges_enabled: true,
  deposit_percentage: 25,
};

function renderPayments() {
  const ProPaymentsScreen = require('../../../app/(pro)/(profile)/payments').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProPaymentsScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProPaymentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue({ success: true, data: MOCK_PROFILE_DATA });
    mockGetStripeAccount.mockResolvedValue({ success: true, data: MOCK_STRIPE_NOT_CONNECTED });
    mockUpdatePaymentSettings.mockResolvedValue({ success: true });
    mockStripeOnboard.mockResolvedValue({ success: true, data: { url: 'https://stripe.com/onboard' } });
    mockStripeUpdateDeposit.mockResolvedValue({ success: true });
  });

  it('renders Encaissements header', async () => {
    const { findByText } = renderPayments();
    await findByText('Encaissements');
  });

  it('renders Compte Stripe Connect section', async () => {
    const { findByText } = renderPayments();
    await findByText('Compte Stripe Connect');
  });

  it('shows Activation requise when Stripe not connected', async () => {
    const { findByText } = renderPayments();
    await findByText('Activation requise');
    await findByText('Activer Stripe Connect');
  });

  it('shows masked IBAN when iban exists and not editing', async () => {
    const { findByText } = renderPayments();
    // maskIBAN('FR7630006000011234567890189') → 'FR76 •••• •••• •••• •••• •••• 0189'
    await findByText(/FR76.*0189/);
  });

  it('shows IBAN input in editing mode when Modifier pressed', async () => {
    const { findByText, findByPlaceholderText } = renderPayments();
    const modifierBtn = await findByText('Modifier');
    fireEvent.press(modifierBtn);
    await findByPlaceholderText('FR76 XXXX XXXX XXXX XXXX XXXX XXX');
  });

  it('shows Paiements en ligne section', async () => {
    const { findByText } = renderPayments();
    await findByText('Paiements en ligne');
    await findByText('Accepter les paiements en ligne');
  });

  it('renders Enregistrer button', async () => {
    const { findByText } = renderPayments();
    await findByText('Enregistrer');
  });

  it('calls updatePaymentSettings on Enregistrer press with existing valid IBAN', async () => {
    const { findByText } = renderPayments();
    // Screen starts with masked IBAN (not editing mode)
    // The "Enregistrer" button is visible without needing to enter edit mode
    const saveBtn = await findByText('Enregistrer');
    fireEvent.press(saveBtn);
    await waitFor(() => {
      expect(mockUpdatePaymentSettings).toHaveBeenCalled();
    });
    await findByText('Paramètres de paiement mis à jour ✓');
  });

  it('shows account activated when Stripe connected', async () => {
    mockGetStripeAccount.mockResolvedValue({ success: true, data: MOCK_STRIPE_CONNECTED });
    const { findByText } = renderPayments();
    await findByText('Compte activé');
    // Deposit section should appear
    await findByText('Acompte à la réservation');
  });
});
