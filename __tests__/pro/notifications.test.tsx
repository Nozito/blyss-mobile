import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
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

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
}));

const mockGetNotificationSettings = jest.fn();
const mockUpdateNotificationSettings = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getNotificationSettings: (...args: any[]) => mockGetNotificationSettings(...args),
    updateNotificationSettings: (...args: any[]) => mockUpdateNotificationSettings(...args),
  },
  ProNotificationSettings: {},
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  new_reservation: true,
  cancel_change: true,
  daily_reminder: true,
  client_message: true,
  payment_alert: true,
  activity_summary: false,
};

function renderNotifications() {
  const ProNotificationsScreen = require('../../app/(pro)/notifications').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProNotificationsScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProNotificationsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationSettings.mockResolvedValue({ success: true, data: DEFAULT_PREFS });
    mockUpdateNotificationSettings.mockResolvedValue({ success: true });
  });

  it('renders Notifications header', async () => {
    const { findByText } = renderNotifications();
    await findByText('Notifications');
  });

  it('renders notification sections after loading', async () => {
    const { findByText } = renderNotifications();
    await findByText('Rendez-vous & Clientes');
    await findByText('Paiement & Activité');
  });

  it('renders individual notification items', async () => {
    const { findByText } = renderNotifications();
    await findByText('Nouvelles réservations');
    await findByText('Changements & annulations');
  });

  it('calls updateNotificationSettings when toggling a switch', async () => {
    mockUpdateNotificationSettings.mockResolvedValue({ success: true });
    const { findAllByRole } = renderNotifications();
    const switches = await findAllByRole('switch');
    // Toggle the first switch
    fireEvent(switches[0], 'valueChange', false);
    expect(mockUpdateNotificationSettings).toHaveBeenCalledWith(
      expect.objectContaining({ new_reservation: false })
    );
  });

  it('shows system settings row', async () => {
    const { findByText } = renderNotifications();
    await findByText('Réglages système');
  });
});
