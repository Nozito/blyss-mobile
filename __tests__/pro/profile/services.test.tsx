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
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
}));

jest.mock('@/components/ui/AnimatedPressable', () => ({
  AnimatedIconButton: ({ children, onPress }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => null,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

const mockGetServices = jest.fn();
const mockUpdateService = jest.fn();
const mockDuplicateService = jest.fn();
const mockDeleteService = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getServices: (...args: any[]) => mockGetServices(...args),
    updateService: (...args: any[]) => mockUpdateService(...args),
    duplicateService: (...args: any[]) => mockDuplicateService(...args),
    deleteService: (...args: any[]) => mockDeleteService(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_SERVICES = [
  { id: 1, name: 'Pose gel full cover', price: 55, duration_minutes: 90, active: true },
  { id: 2, name: 'Remplissage gel', price: 40, duration_minutes: 60, active: true },
  { id: 3, name: 'Dépose', price: 25, duration_minutes: 30, active: false },
];

function renderServices() {
  const ServicesScreen = require('../../../app/(pro)/(profile)/services').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ServicesScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ServicesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServices.mockResolvedValue({ success: true, data: MOCK_SERVICES });
    mockUpdateService.mockResolvedValue({ success: true });
    mockDuplicateService.mockResolvedValue({ success: true });
    mockDeleteService.mockResolvedValue({ success: true });
  });

  it('renders Prestations header', async () => {
    const { findByText } = renderServices();
    await findByText('Prestations');
  });

  it('renders service list items', async () => {
    const { findByText } = renderServices();
    await findByText('Pose gel full cover');
    await findByText('Remplissage gel');
    await findByText('Dépose');
  });

  it('renders service price', async () => {
    const { findByText } = renderServices();
    await findByText('55.00 €');
  });

  it('navigates to service-form when + button pressed', async () => {
    const { findByText } = renderServices();
    // Wait for screen to load
    await findByText('Pose gel full cover');
    mockGetServices.mockResolvedValue({ success: true, data: [] });
    const freshRender = renderServices();
    const createBtn = await freshRender.findByText('Créer une prestation');
    fireEvent.press(createBtn);
    expect(mockPush).toHaveBeenCalledWith('/(pro)/(profile)/service-form');
  });

  it('renders active count in subtitle', async () => {
    const { findByText } = renderServices();
    // 2 active out of 3 total
    await findByText('2 actives sur 3');
  });

  it('renders Inactif badge for inactive service', async () => {
    const { findByText } = renderServices();
    await findByText('Inactif');
  });
});
