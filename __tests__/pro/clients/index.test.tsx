import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));

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
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
}));

jest.mock('@/components/ui/Avatar', () => ({
  Avatar: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name?.[0] ?? '?'}</Text>;
  },
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => null,
}));

jest.mock('@/components/ui/ErrorMessage', () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (val: unknown) => val,
}));

const mockGetClients = jest.fn();
const mockGetBlockedClients = jest.fn();
const mockUnblockClient = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getClients: (...args: any[]) => mockGetClients(...args),
  },
  nailTechApi: {
    getBlockedClients: (...args: any[]) => mockGetBlockedClients(...args),
    unblockClient: (...args: any[]) => mockUnblockClient(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_CLIENTS = [
  { id: 1, name: 'Alice Dupont', phone: '0601020304', totalVisits: 5, lastVisit: '2025-01-01' },
  { id: 2, name: 'Béatrice Martin', phone: '0611223344', totalVisits: 2, lastVisit: '2025-02-01' },
  { id: 3, name: 'Claire Leroy', phone: null, totalVisits: 8, lastVisit: '2025-03-01' },
];

function renderClients() {
  const ProClientsScreen = require('../../../app/(pro)/(clients)/index').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProClientsScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProClientsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClients.mockResolvedValue({ success: true, data: MOCK_CLIENTS });
    mockGetBlockedClients.mockResolvedValue({ success: true, data: [] });
  });

  it('renders screen title', async () => {
    const { findByText } = renderClients();
    await findByText('Mes clientes');
  });

  it('renders client list', async () => {
    const { findByText } = renderClients();
    await findByText('Alice Dupont');
    await findByText('Béatrice Martin');
    await findByText('Claire Leroy');
  });

  it('filters list when search text entered', async () => {
    const { findByText, getByPlaceholderText, queryByText } = renderClients();
    await findByText('Alice Dupont');
    const input = getByPlaceholderText('Rechercher par nom ou téléphone...');
    fireEvent.changeText(input, 'Alice');
    await waitFor(() => {
      expect(queryByText('Béatrice Martin')).toBeNull();
    });
    await findByText('Alice Dupont');
  });

  it('navigates to client-detail on row tap', async () => {
    const { findByText } = renderClients();
    const clientRow = await findByText('Alice Dupont');
    fireEvent.press(clientRow);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('client-detail?clientId=1')
    );
  });

  it('shows empty state when no clients', async () => {
    mockGetClients.mockResolvedValue({ success: true, data: [] });
    const { findByText } = renderClients();
    await findByText('Aucune cliente');
  });

  it('renders stats (total clients)', async () => {
    const { findByText } = renderClients();
    // Stats row shows total client count
    await findByText('3');
  });
});
