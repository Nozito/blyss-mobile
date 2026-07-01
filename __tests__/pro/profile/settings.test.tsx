import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: require('../../fixtures/proUser').proUser,
    isAuthenticated: true,
    isLoading: false,
    logout: jest.fn(),
    refreshProfile: mockRefreshProfile,
    patchUser: jest.fn(),
  }),
}));

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
}));

jest.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChangeText, placeholder, label, error }: any) => {
    const { TextInput, Text, View } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} testID={`input-${label}`} />
        {error ? <Text>{error}</Text> : null}
      </View>
    );
  },
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
    return <Text testID="error-msg">{message}</Text>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

jest.mock('@/lib/validation', () => ({
  phoneSchema: { parse: jest.fn() },
  bioSchema: { parse: jest.fn() },
  getZodError: jest.fn().mockReturnValue(null),
}));

jest.mock('@/hooks/usePro', () => ({
  usePro: () => ({ isPro: true }),
}));

const mockUsersUpdate = jest.fn();
const mockGetSubscription = jest.fn();
const mockExportData = jest.fn();
const mockDeleteAccount = jest.fn();
const mockAuthLogout = jest.fn();

jest.mock('@/lib/api', () => ({
  authApi: {
    exportData: (...args: any[]) => mockExportData(...args),
    deleteAccount: (...args: any[]) => mockDeleteAccount(...args),
    logout: (...args: any[]) => mockAuthLogout(...args),
  },
  usersApi: {
    update: (...args: any[]) => mockUsersUpdate(...args),
  },
  proApi: {
    getSubscription: (...args: any[]) => mockGetSubscription(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSettings() {
  const ProSettingsScreen = require('../../../app/(pro)/(profile)/settings').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProSettingsScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersUpdate.mockResolvedValue({ success: true });
    mockGetSubscription.mockResolvedValue({ success: true, data: { plan: 'start', endDate: '2027-01-01' } });
    mockExportData.mockResolvedValue({ success: true, data: JSON.stringify({ user: {} }) });
    mockDeleteAccount.mockResolvedValue({ success: true });
    mockAuthLogout.mockResolvedValue(undefined);
    mockRefreshProfile.mockResolvedValue(undefined);
  });

  it('renders Paramètres header', () => {
    const { getByText } = renderSettings();
    expect(getByText('Paramètres')).toBeTruthy();
  });

  it('renders Profil et sécurité subtitle', () => {
    const { getByText } = renderSettings();
    expect(getByText('Profil et sécurité')).toBeTruthy();
  });

  it('renders form pre-filled with user data', () => {
    const { getByDisplayValue } = renderSettings();
    expect(getByDisplayValue('Sophie')).toBeTruthy(); // first_name
    expect(getByDisplayValue('Martin')).toBeTruthy(); // last_name
  });

  it('renders save button', () => {
    const { getByText } = renderSettings();
    expect(getByText('Enregistrer les modifications')).toBeTruthy();
  });

  it('renders password change section', () => {
    const { getByText } = renderSettings();
    // SectionHeader renders "Sécurité" label; Input labels render via mock
    expect(getByText('Sécurité')).toBeTruthy();
  });

  it('renders Supprimer mon compte button', () => {
    const { getByText } = renderSettings();
    expect(getByText('Supprimer mon compte')).toBeTruthy();
  });

  it('shows inline delete confirm when Supprimer mon compte pressed', async () => {
    const { getByText, findByText } = renderSettings();
    const deleteBtn = getByText('Supprimer mon compte');
    fireEvent.press(deleteBtn);
    await findByText('Suppression définitive du compte');
  });

  it('calls usersApi.update on form submit', async () => {
    const { getByText } = renderSettings();
    const saveBtn = getByText('Enregistrer les modifications');
    fireEvent.press(saveBtn);
    await waitFor(() => {
      expect(mockUsersUpdate).toHaveBeenCalled();
    });
  });
});
