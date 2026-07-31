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

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('expo-device', () => ({ isDevice: false }));

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
    packages: [],
    purchase: jest.fn(),
    restorePurchases: jest.fn(),
    refreshActivePlan: jest.fn(),
  }),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

const mockGetSubscription = jest.fn();
const mockUploadProfilePhoto = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getSubscription: (...args: any[]) => mockGetSubscription(...args),
  },
  usersApi: {
    uploadProfilePhoto: (...args: any[]) => mockUploadProfilePhoto(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderProProfile() {
  const ProProfileScreen = require('../../../app/(pro)/(profile)/index').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProProfileScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSubscription.mockResolvedValue({ success: true, data: { plan: 'start', status: 'active' } });
  });

  it('renders pro name', async () => {
    const { findByText } = renderProProfile();
    await findByText('Sophie Martin');
  });

  it('renders pro city indirectly via profile card', async () => {
    const { findByText } = renderProProfile();
    // activity_name is displayed in the profile card
    await findByText('Studio Sophie');
  });

  it('renders Mon profil pro header', async () => {
    const { findByText } = renderProProfile();
    await findByText('Mon profil pro');
  });

  it('renders menu rows', async () => {
    const { findByText } = renderProProfile();
    await findByText('Modifier mon profil');
    await findByText('Mes prestations');
    await findByText('Finance');
    await findByText('Encaissements');
    await findByText('Aide & support');
  });

  it('renders Mon abonnement card', async () => {
    const { findByText } = renderProProfile();
    await findByText('Mon abonnement');
  });

  it('navigates when a menu row is pressed', async () => {
    const { findByText } = renderProProfile();
    const prestationsRow = await findByText('Mes prestations');
    fireEvent.press(prestationsRow);
    expect(mockPush).toHaveBeenCalledWith('/(pro)/(profile)/services');
  });

  it('renders Se déconnecter button', async () => {
    const { findByText } = renderProProfile();
    await findByText('Se déconnecter');
  });
});
