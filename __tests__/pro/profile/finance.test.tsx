import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
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

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  moveAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: '/tmp/test.pdf' }),
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

const mockGetFinanceStats = jest.fn();
const mockUpdateFinanceObjective = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getFinanceStats: (...args: any[]) => mockGetFinanceStats(...args),
    updateFinanceObjective: (...args: any[]) => mockUpdateFinanceObjective(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_STATS = {
  today: 120,
  week: 350,
  month: 1400,
  lastMonth: 1200,
  objective: 2000,
  forecast: 1800,
  trend: 'up',
  topServices: [
    { name: 'Pose gel', revenue: 700, count: 14, percentage: 50 },
    { name: 'Remplissage', revenue: 400, count: 10, percentage: 28.5 },
  ],
};

function renderFinance() {
  const ProFinanceScreen = require('../../../app/(pro)/(profile)/finance').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProFinanceScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProFinanceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFinanceStats.mockResolvedValue({ success: true, data: MOCK_STATS });
    mockUpdateFinanceObjective.mockResolvedValue({ success: true });
  });

  it('renders Finances header', async () => {
    const { findByText } = renderFinance();
    await findByText('Finances');
  });

  it('renders period selector tabs', async () => {
    const { findByText } = renderFinance();
    await findByText('Cette semaine');
    await findByText('Ce mois');
    await findByText('Cette année');
  });

  it('renders revenue stat cards', async () => {
    const { findByText, findAllByText } = renderFinance();
    await findByText("Aujourd'hui");
    // "Cette semaine" appears in the tab selector AND in stat cards
    const weekElements = await findAllByText('Cette semaine');
    expect(weekElements.length).toBeGreaterThanOrEqual(1);
    await findByText('Mois dernier');
  });

  it('renders top services section', async () => {
    const { findByText } = renderFinance();
    await findByText('Top prestations');
    await findByText('Pose gel');
  });

  it('renders monthly objective progress', async () => {
    const { findByText } = renderFinance();
    await findByText('Objectif mensuel');
    // progress = 1400/2000 = 70%
    await findByText('70%');
  });

  it('shows "Sauvegardé ✓" after saving objective', async () => {
    const { findByText } = renderFinance();
    // Open objective modal
    const objectiveCard = await findByText('Objectif mensuel');
    fireEvent.press(objectiveCard);
    // Find input and change it
    const input = await findByText('Enregistrer');
    fireEvent.press(input);
    await waitFor(() => {
      expect(mockUpdateFinanceObjective).toHaveBeenCalled();
    });
    // After success, "Sauvegardé ✓" appears
    await findByText('Sauvegardé ✓');
  });

  it('renders empty state when no stats', async () => {
    mockGetFinanceStats.mockResolvedValue({ success: true, data: null });
    const { findByText } = renderFinance();
    await findByText('Aucune donnée');
  });
});
