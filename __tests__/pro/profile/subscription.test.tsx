import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
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
    activePlan: null,
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
        annualRcPackage: { identifier: 'blyss_serenite_annual' },
        annualPriceString: '399 €/an',
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
    isReady: true,
  }),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => null,
}));

jest.mock('@/components/ui/ErrorMessage', () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text testID="error-msg">{message}</Text>;
  },
}));

jest.mock('@/components/ui/AnimatedPressable', () => ({
  AnimatedIconButton: ({ children, onPress }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

const mockGetSubscription = jest.fn();
const mockSyncSubscription = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getSubscription: (...args: any[]) => mockGetSubscription(...args),
    syncSubscription: (...args: any[]) => mockSyncSubscription(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSubscription() {
  const ProSubscriptionScreen = require('../../../app/pro-subscription').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProSubscriptionScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProSubscriptionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSubscription.mockResolvedValue({ success: true, data: { plan: null, status: null } });
    mockSyncSubscription.mockResolvedValue({ success: true, data: { reconciled: true } });
    mockPurchase.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });
    mockRefreshActivePlan.mockResolvedValue(undefined);
  });

  it('renders Choisis ta formule header', async () => {
    const { findByText } = renderSubscription();
    await findByText('Choisis ta formule');
  });

  it('renders all 3 plan cards', async () => {
    const { findByText } = renderSubscription();
    await findByText('Start');
    await findByText('Sérénité');
    await findByText('Signature');
  });

  it('renders prices from packages', async () => {
    const { findByText } = renderSubscription();
    await findByText('29,90 €');
    await findByText('39,90 €');
    await findByText('49,90 €');
  });

  it('renders billing period toggle (Mensuel/Annuel)', async () => {
    const { findByText } = renderSubscription();
    await findByText('Mensuel');
    await findByText('Annuel');
  });

  it('calls purchase when Choisir Start is pressed', async () => {
    const { findByText } = renderSubscription();
    const startCTA = await findByText("Choisir Start");
    fireEvent.press(startCTA);
    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalled();
    });
  });

  it('renders restore purchases link', async () => {
    const { findByText } = renderSubscription();
    await findByText('Restaurer mes achats');
  });
});
