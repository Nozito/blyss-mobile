import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();

jest.mock('react-native-confetti-cannon', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ConfettiCannon = React.forwardRef((_props: any, ref: any) => {
    if (ref) {
      ref.current = { start: jest.fn() };
    }
    return <View testID="confetti" />;
  });
  return ConfettiCannon;
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('true'), // onboarding done → redirect to dashboard
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ plan: 'start' }),
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

const mockRefreshActivePlan = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({
    customerInfo: null,
    activePlan: 'start',
    packages: [],
    purchase: jest.fn(),
    restorePurchases: jest.fn(),
    refreshActivePlan: mockRefreshActivePlan,
  }),
}));

jest.mock('@/lib/api', () => ({}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSuccess() {
  const ProSubscriptionSuccessScreen = require('../../../app/(pro)/(profile)/subscription-success').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProSubscriptionSuccessScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProSubscriptionSuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRefreshActivePlan.mockResolvedValue(undefined);
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue('true');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders Félicitations title', () => {
    const { getByText } = renderSuccess();
    expect(getByText('Félicitations ! 🎉')).toBeTruthy();
  });

  it('renders Votre espace pro est prêt subtitle', () => {
    const { getByText } = renderSuccess();
    expect(getByText('Votre espace pro est prêt')).toBeTruthy();
  });

  it('renders active plan label (Start)', () => {
    const { getByText } = renderSuccess();
    expect(getByText('Start · Actif')).toBeTruthy();
  });

  it('renders Redirection en cours message', () => {
    const { getByText } = renderSuccess();
    expect(getByText('Redirection en cours…')).toBeTruthy();
  });

  it('redirects to dashboard after 4s when onboarding done', async () => {
    renderSuccess();
    await act(async () => {
      jest.advanceTimersByTime(4000);
      // Flush async work
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockRefreshActivePlan).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(pro)/dashboard');
    });
  });

  it('redirects to onboarding after 4s when onboarding NOT done', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockResolvedValue(null);
    renderSuccess();
    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(pro)/onboarding');
    });
  });
});
