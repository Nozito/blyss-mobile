import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: require('../../fixtures/proUser').proUser,
    isAuthenticated: true,
    isLoading: false,
    logout: mockLogout,
    refreshProfile: jest.fn(),
    patchUser: jest.fn(),
  }),
}));

jest.mock('@/contexts/RevenueCatContext', () => ({
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
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
    return <Text testID="error-msg">{message}</Text>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

const mockDeleteAccount = jest.fn();

jest.mock('@/lib/api', () => ({
  authApi: {
    deleteAccount: (...args: any[]) => mockDeleteAccount(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderRGPD() {
  const ProRGPDScreen = require('../../../app/(pro)/(profile)/rgpd').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProRGPDScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProRGPDScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteAccount.mockResolvedValue({ success: true });
    mockLogout.mockResolvedValue(undefined);
  });

  it('renders Mes données personnelles header', () => {
    const { getByText } = renderRGPD();
    expect(getByText('Mes données personnelles')).toBeTruthy();
  });

  it('renders Télécharger mes données row', () => {
    const { getByText } = renderRGPD();
    expect(getByText('Télécharger mes données')).toBeTruthy();
  });

  it('renders Modifier mes informations row', () => {
    const { getByText } = renderRGPD();
    expect(getByText('Modifier mes informations')).toBeTruthy();
  });

  it('renders Supprimer mon compte row', () => {
    // "Supprimer mon compte" appears as section header AND as row label
    const { getAllByText } = renderRGPD();
    const elements = getAllByText('Supprimer mon compte');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('opens delete confirmation modal when Supprimer pressed', async () => {
    const { getAllByText, findByText } = renderRGPD();
    // Get the row label "Supprimer mon compte" (the Pressable)
    const elements = getAllByText('Supprimer mon compte');
    // Press the last element which should be the RGPDRow button
    fireEvent.press(elements[elements.length - 1]);
    await findByText('Cette action est irréversible. Toutes tes données personnelles seront supprimées dans les 30 jours.');
  });

  it('renders RGPD intro text', () => {
    const { getByText } = renderRGPD();
    expect(getByText(/tes données t'appartiennent/)).toBeTruthy();
  });

  it('calls deleteAccount and logout when confirming deletion', async () => {
    const { getAllByText, findByText } = renderRGPD();
    const elements = getAllByText('Supprimer mon compte');
    // Press RGPDRow "Supprimer mon compte" to open modal
    fireEvent.press(elements[elements.length - 1]);
    // Modal is now visible — find and press the confirm "Supprimer" button
    const deleteBtn = await findByText('Supprimer');
    fireEvent.press(deleteBtn);
    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('does not call logout when deleteAccount fails', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('Network error'));
    const { getAllByText, findByText } = renderRGPD();
    const elements = getAllByText('Supprimer mon compte');
    fireEvent.press(elements[elements.length - 1]);
    const deleteBtn = await findByText('Supprimer');
    fireEvent.press(deleteBtn);
    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled();
    });
    // Logout should NOT be called when deleteAccount throws
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
