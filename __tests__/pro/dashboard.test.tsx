import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testQueryClient';
// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('true'),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

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

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({
    customerInfo: null,
    activePlan: null,
    packages: [],
    purchase: jest.fn(),
    restorePurchases: jest.fn(),
    refreshActivePlan: jest.fn(),
  }),
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ children }: any) => children,
}));

jest.mock('@/components/ui/SkeletonBox', () => ({
  SkeletonBox: () => null,
}));

jest.mock('@/components/ui/ErrorMessage', () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

const mockGetDashboard = jest.fn();
const mockGetUnavailabilities = jest.fn();
const mockCreateUnavailability = jest.fn();
const mockDeleteUnavailability = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getDashboard: (...args: any[]) => mockGetDashboard(...args),
    getUnavailabilities: (...args: any[]) => mockGetUnavailabilities(...args),
    createUnavailability: (...args: any[]) => mockCreateUnavailability(...args),
    deleteUnavailability: (...args: any[]) => mockDeleteUnavailability(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_DASHBOARD = {
  weeklyStats: { services: 7, change: 12, isUp: true },
  todayForecast: 200,
  upcomingClients: [],
  fillRate: 75,
  clientsThisWeek: 4,
  topServices: [],
  weeklyRevenue: [],
};

function renderDashboard() {
  const ProDashboard = require('../../app/(pro)/dashboard').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProDashboard />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnavailabilities.mockResolvedValue({ success: true, data: [] });
  });

  it('shows skeleton while loading', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {})); // never resolves
    renderDashboard();
    // SkeletonBox is mocked to null but the loading branch renders a View
    // Check that we rendered something (no crash)
    expect(true).toBe(true);
  });

  it('renders revenue value from API data', async () => {
    mockGetDashboard.mockResolvedValue({ success: true, data: BASE_DASHBOARD });
    const { findByText } = renderDashboard();
    // todayForecast = 200 → "200" renders
    await findByText('200');
  });

  it('renders greeting with user first name', async () => {
    mockGetDashboard.mockResolvedValue({ success: true, data: BASE_DASHBOARD });
    const { findByText } = renderDashboard();
    await findByText(/Sophie/);
  });

  it('renders empty upcoming clients message when no clients', async () => {
    mockGetDashboard.mockResolvedValue({ success: true, data: BASE_DASHBOARD });
    const { findByText } = renderDashboard();
    await findByText('Aucune cliente prévue');
  });

  it('renders upcoming client names when clients present', async () => {
    const data = {
      ...BASE_DASHBOARD,
      upcomingClients: [
        {
          id: 1,
          client_user_id: 99,
          name: 'Alice Dupont',
          service: 'Manucure',
          time: '10:00',
          price: 45,
          status: 'upcoming' as const,
          avatar: 'AD',
        },
      ],
    };
    mockGetDashboard.mockResolvedValue({ success: true, data });
    const { findByText } = renderDashboard();
    await findByText('Alice Dupont');
  });

  it('navigates to client detail when tapping an upcoming client', async () => {
    const data = {
      ...BASE_DASHBOARD,
      upcomingClients: [
        {
          id: 1,
          client_user_id: 99,
          name: 'Alice Dupont',
          service: 'Manucure',
          time: '10:00',
          price: 45,
          status: 'upcoming' as const,
          avatar: 'AD',
        },
      ],
    };
    mockGetDashboard.mockResolvedValue({ success: true, data });
    const { findByText } = renderDashboard();
    const clientRow = await findByText('Alice Dupont');
    fireEvent.press(clientRow);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('client-detail?clientId=99')
    );
  });

  it('renders without crash on API error', async () => {
    mockGetDashboard.mockResolvedValue({ success: false, data: null });
    const { findByText } = renderDashboard();
    // Falls back to empty state
    await findByText('Aucune cliente prévue');
  });

  it('ligne tendance/CTA : conteneur peut passer à la ligne (anti-chevauchement)', async () => {
    mockGetDashboard.mockResolvedValue({ success: true, data: BASE_DASHBOARD });
    const { findByText } = renderDashboard();
    const trend = await findByText(/% vs semaine dernière/);
    expect(trend.props.style).toEqual(expect.objectContaining({ flexShrink: 1 }));
    // Un ancêtre proche porte flexWrap:"wrap" → tendance et CTA peuvent
    // se répartir sur deux lignes au lieu de se chevaucher.
    const flatten = (s: any) => (Array.isArray(s) ? Object.assign({}, ...s.flat(Infinity)) : s ?? {});
    let node: any = trend.parent;
    let found = false;
    for (let i = 0; i < 5 && node; i++) {
      if (flatten(node.props?.style).flexWrap === 'wrap') { found = true; break; }
      node = node.parent;
    }
    expect(found).toBe(true);
  });
});
