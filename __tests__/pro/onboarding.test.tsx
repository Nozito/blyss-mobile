import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), // not done → show onboarding
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: require('../fixtures/proUser').proUser,
    isAuthenticated: true,
    isLoading: false,
    logout: jest.fn(),
    refreshProfile: jest.fn(),
    patchUser: jest.fn(),
  }),
}));

const mockRefreshActivePlan = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({
    customerInfo: null,
    activePlan: null,
    packages: [],
    purchase: jest.fn(),
    restorePurchases: jest.fn(),
    refreshActivePlan: mockRefreshActivePlan,
  }),
}));

jest.mock('@/lib/api', () => ({}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderOnboarding() {
  const ProOnboardingScreen = require('../../app/(pro)/onboarding').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProOnboardingScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProOnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshActivePlan.mockResolvedValue(undefined);
    // Not done → show slides
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('renders first slide title', async () => {
    const { findByText } = renderOnboarding();
    await findByText('Ton agenda pro');
  });

  it('renders Suivant button on first slide', async () => {
    const { findByText } = renderOnboarding();
    await findByText('Suivant');
  });

  it('renders Passer skip button', async () => {
    const { findByText } = renderOnboarding();
    await findByText('Passer');
  });

  it('navigates to next slide when pressing Suivant', async () => {
    const { findByText } = renderOnboarding();
    const nextBtn = await findByText('Suivant');
    fireEvent.press(nextBtn);
    await findByText('Tes clientes');
  });

  it('shows C\'est parti! on last slide and calls router.replace on press', async () => {
    const { findByText } = renderOnboarding();
    // Navigate to last slide (slide index 2)
    const nextBtn1 = await findByText('Suivant');
    fireEvent.press(nextBtn1);
    const nextBtn2 = await findByText('Suivant');
    fireEvent.press(nextBtn2);
    const ctaBtn = await findByText("C'est parti !");
    expect(ctaBtn).toBeTruthy();
    await act(async () => {
      fireEvent.press(ctaBtn);
    });
    await waitFor(() => {
      expect(mockRefreshActivePlan).toHaveBeenCalled();
    });
    expect(mockReplace).toHaveBeenCalledWith('/(pro)/dashboard');
  });
});
