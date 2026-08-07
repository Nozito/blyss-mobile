import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
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
  useRevenueCat: () => ({
    customerInfo: null,
    activePlan: 'start',
    packages: [
      {
        key: 'serenite',
        priceString: '39,90 €',
        rcPackage: { identifier: 'blyss_serenite_monthly' },
        annualRcPackage: null,
        annualPriceString: null,
      },
    ],
    purchase: jest.fn(),
    restorePurchases: jest.fn(),
    refreshActivePlan: jest.fn(),
  }),
}));

jest.mock('@/lib/api', () => ({}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderUpgrade() {
  const ProUpgradeScreen = require('../../../app/(pro)/(profile)/upgrade').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProUpgradeScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProUpgradeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Upgrade requis header', () => {
    const { getByText } = renderUpgrade();
    expect(getByText('Upgrade requis')).toBeTruthy();
  });

  it('renders Fonctionnalité non incluse hero text', () => {
    const { getByText } = renderUpgrade();
    expect(getByText('Fonctionnalité non incluse')).toBeTruthy();
  });

  it('renders target plan label (Sérénité)', () => {
    const { getAllByText } = renderUpgrade();
    // "Sérénité" appears in hero text + plan card
    const elements = getAllByText('Sérénité');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders feature list for Sérénité plan', () => {
    const { getByText } = renderUpgrade();
    expect(getByText('Tout Start inclus')).toBeTruthy();
    expect(getByText('Module finance & statistiques')).toBeTruthy();
    expect(getByText('Portfolio photos')).toBeTruthy();
    expect(getByText('Rappels automatiques')).toBeTruthy();
  });

  it('renders Passer au plan Sérénité CTA', () => {
    const { getByText } = renderUpgrade();
    expect(getByText('Passer au plan Sérénité')).toBeTruthy();
  });

  it('navigates to subscription screen when CTA pressed', () => {
    const { getByText } = renderUpgrade();
    fireEvent.press(getByText('Passer au plan Sérénité'));
    expect(mockPush).toHaveBeenCalledWith('/pro-subscription');
  });

  it('renders Retour au tableau de bord link', () => {
    const { getByText } = renderUpgrade();
    expect(getByText('Retour au tableau de bord')).toBeTruthy();
  });

  it('navigates to dashboard when back link pressed', () => {
    const { getByText } = renderUpgrade();
    fireEvent.press(getByText('Retour au tableau de bord'));
    expect(mockPush).toHaveBeenCalledWith('/(pro)/dashboard');
  });
});
