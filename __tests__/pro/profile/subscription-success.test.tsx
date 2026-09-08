import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
let mockParams: Record<string, string> = { plan: 'start' };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
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
  const ProSubscriptionSuccessScreen = require('../../../app/pro-subscription-success').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProSubscriptionSuccessScreen />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProSubscriptionSuccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { plan: 'start' };
    mockRefreshActivePlan.mockResolvedValue(undefined);
  });

  it('affiche le tampon « C\'est / Confirmé »', () => {
    const { getByText } = renderSuccess();
    expect(getByText("C'est")).toBeTruthy();
    expect(getByText('Confirmé')).toBeTruthy();
  });

  it('affiche le badge du plan actif', () => {
    const { getByText } = renderSuccess();
    expect(getByText('Start · Actif')).toBeTruthy();
  });

  it('affiche au moins un gain du palier Start', () => {
    const { getByText } = renderSuccess();
    expect(getByText('Un agenda qui se remplit en ligne')).toBeTruthy();
  });

  it('rafraîchit le plan actif au montage (hors preview)', async () => {
    renderSuccess();
    await waitFor(() => expect(mockRefreshActivePlan).toHaveBeenCalled());
  });

  it('1re souscription → bouton « Configurer » qui mène à l\'onboarding pro', () => {
    const { getByText } = renderSuccess();
    fireEvent.press(getByText('Configurer mon agenda →'));
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/pro-onboarding' }),
    );
  });

  it('upgrade → bouton « Voir ce qui change »', () => {
    mockParams = { plan: 'serenite', previousPlan: 'start' };
    const { getByText } = renderSuccess();
    expect(getByText('Voir ce qui change →')).toBeTruthy();
  });
});
