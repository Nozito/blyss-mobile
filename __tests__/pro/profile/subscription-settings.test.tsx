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

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
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

const mockPurchase = jest.fn();
const mockRefreshActivePlan = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({
    customerInfo: null,
    activePlan: 'start',
    packages: [
      {
        key: 'start',
        priceString: '29,90 €',
        rcPackage: { identifier: 'blyss_start_monthly' },
        annualRcPackage: null,
        annualPriceString: null,
      },
      {
        key: 'serenite',
        priceString: '39,90 €',
        rcPackage: { identifier: 'blyss_serenite_monthly' },
        annualRcPackage: null,
        annualPriceString: null,
      },
      {
        key: 'signature',
        priceString: '49,90 €',
        rcPackage: { identifier: 'blyss_signature_monthly' },
        annualRcPackage: null,
        annualPriceString: null,
      },
    ],
    purchase: mockPurchase,
    restorePurchases: jest.fn(),
    refreshActivePlan: mockRefreshActivePlan,
  }),
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

const mockGetSubscription = jest.fn();
const mockSyncSubscription = jest.fn();
const mockCancelSubscription = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getSubscription: (...args: any[]) => mockGetSubscription(...args),
    syncSubscription: (...args: any[]) => mockSyncSubscription(...args),
    cancelSubscription: (...args: any[]) => mockCancelSubscription(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSubscriptionSettings() {
  const ProSubscriptionSettingsScreen = require('../../../app/(pro)/(profile)/subscription-settings').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProSubscriptionSettingsScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProSubscriptionSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSubscription.mockResolvedValue({
      success: true,
      data: {
        plan: 'start',
        status: 'active',
        endDate: '2027-01-01',
        cancelAtPeriodEnd: false,
      },
    });
    mockSyncSubscription.mockResolvedValue({ success: true, data: { reconciled: true } });
    mockCancelSubscription.mockResolvedValue({ success: true });
    mockPurchase.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
  });

  it('renders Mon abonnement header', async () => {
    const { findByText } = renderSubscriptionSettings();
    await findByText('Mon abonnement');
  });

  it('renders current plan as active (Start)', async () => {
    const { findByText } = renderSubscriptionSettings();
    // Active plan highlighted
    await findByText('Start');
    await findByText('Plan actuel');
  });

  it('renders all plan options by label', async () => {
    const { findAllByText } = renderSubscriptionSettings();
    const startElements = await findAllByText('Start');
    expect(startElements.length).toBeGreaterThanOrEqual(1);
    const sereniteElements = await findAllByText('Sérénité');
    expect(sereniteElements.length).toBeGreaterThanOrEqual(1);
    const signatureElements = await findAllByText('Signature');
    expect(signatureElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders billing period toggle', async () => {
    const { findByText } = renderSubscriptionSettings();
    await findByText('Mensuel');
    await findByText('Annuel');
  });

  it('renders cancel subscription button', async () => {
    const { findByText } = renderSubscriptionSettings();
    await findByText('Annuler mon abonnement');
  });

  it('calls purchase when upgrading from start to serenite', async () => {
    const { findAllByText } = renderSubscriptionSettings();
    // The serenite plan card is a Pressable; "Sérénité" appears in it
    const sereniteLabels = await findAllByText('Sérénité');
    // Press the first Sérénité text element (inside the pressable plan card)
    fireEvent.press(sereniteLabels[0]);
    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalled();
    });
  });
});
