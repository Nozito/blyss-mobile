import React from 'react';
import { render } from '@testing-library/react-native';
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

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      ...require('../../fixtures/proUser').proUser,
      instagram_account: '@sophiestudio',
      banner_photo: null,
    },
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

jest.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChangeText, placeholder, label }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} testID={label} />
      </View>
    );
  },
}));

jest.mock('@/components/ui/AnimatedPressable', () => ({
  AnimatedIconButton: ({ children, onPress, className }: any) => {
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

jest.mock('@/lib/validation', () => ({
  proProfileSchema: {
    safeParse: jest.fn().mockReturnValue({ success: true }),
  },
}));

const mockGetGallery = jest.fn();
const mockGetProfile = jest.fn();
const mockGetServices = jest.fn();
const mockGetIgStatus = jest.fn();
const mockGetIgFeed = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUploadGallery = jest.fn();
const mockDeleteGallery = jest.fn();
const mockUploadBannerPhoto = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getGallery: (...args: any[]) => mockGetGallery(...args),
    getProfile: (...args: any[]) => mockGetProfile(...args),
    getServices: (...args: any[]) => mockGetServices(...args),
    updateProfile: (...args: any[]) => mockUpdateProfile(...args),
    uploadGallery: (...args: any[]) => mockUploadGallery(...args),
    deleteGallery: (...args: any[]) => mockDeleteGallery(...args),
  },
  usersApi: {
    uploadBannerPhoto: (...args: any[]) => mockUploadBannerPhoto(...args),
  },
  instagramApi: {
    getStatus: (...args: any[]) => mockGetIgStatus(...args),
    getFeed: (...args: any[]) => mockGetIgFeed(...args),
    disconnect: jest.fn(),
    importPhoto: jest.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_GALLERY = [
  { id: 1, url: 'https://example.com/1.jpg', thumbnail: 'https://example.com/thumb1.jpg', created_at: '2025-01-01' },
  { id: 2, url: 'https://example.com/2.jpg', thumbnail: 'https://example.com/thumb2.jpg', created_at: '2025-01-02' },
];

function renderPublicProfile() {
  const ProPublicProfileScreen = require('../../../app/(pro)/(profile)/public-profile').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProPublicProfileScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProPublicProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGallery.mockResolvedValue({ success: true, data: MOCK_GALLERY });
    mockGetProfile.mockResolvedValue({ success: true, data: { activity_name: 'Studio Sophie', city: 'Paris', bio: 'Expert', instagram_account: '@sophiestudio', profile_visibility: 'public' } });
    mockGetServices.mockResolvedValue({ success: true, data: [] });
    mockGetIgStatus.mockResolvedValue({ success: true, data: { connected: false } });
    mockGetIgFeed.mockResolvedValue({ success: true, data: { photos: [] } });
    mockUpdateProfile.mockResolvedValue({ success: true });
  });

  it('renders Profil public header', async () => {
    const { findAllByText } = renderPublicProfile();
    const elements = await findAllByText('Profil public');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders gallery section title', async () => {
    const { findByText } = renderPublicProfile();
    await findByText(/Galerie/i);
  });

  it('renders gallery images count', async () => {
    const { findByText } = renderPublicProfile();
    await findByText('2/20 photos');
  });

  it('shows Instagram connect button when not connected', async () => {
    const { findByText } = renderPublicProfile();
    await findByText('Connecter Instagram');
  });

  it('shows connected Instagram status when connected', async () => {
    mockGetIgStatus.mockResolvedValue({ success: true, data: { connected: true, username: 'sophiestudio' } });
    const { findByText } = renderPublicProfile();
    await findByText('@sophiestudio');
  });

  it('renders visibility section', async () => {
    const { findByText } = renderPublicProfile();
    await findByText(/Visibilité/i);
  });
});
