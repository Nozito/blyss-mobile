import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../utils/testQueryClient';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('@react-navigation/native', () => ({ useScrollToTop: jest.fn() }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ clientId: '1' }),
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
    return <Text testID="avatar">{name?.[0] ?? '?'}</Text>;
  },
}));

jest.mock('@/components/ui/ErrorMessage', () => ({
  ErrorMessage: ({ message }: any) => {
    const { Text } = require('react-native');
    return <Text>{message}</Text>;
  },
}));

jest.mock('@/components/ui/AnimatedPressable', () => ({
  AnimatedIconButton: ({ children, onPress }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

const mockGetClients = jest.fn();
const mockGetClientNotes = jest.fn();
const mockUpdateClientNotes = jest.fn();
const mockBlockClient = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getClients: (...args: any[]) => mockGetClients(...args),
  },
  nailTechApi: {
    getClientNotes: (...args: any[]) => mockGetClientNotes(...args),
    updateClientNotes: (...args: any[]) => mockUpdateClientNotes(...args),
    blockClient: (...args: any[]) => mockBlockClient(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOCK_NOTES = {
  first_name: 'Alice',
  last_name: 'Dupont',
  email: 'alice@test.fr',
  phone_number: '0601020304',
  notes: 'Cliente fidèle depuis 2022',
  allergies: 'Résine UV',
  preferred_shape: 'Amande',
  preferred_style: 'Minimaliste',
  patch_test_done: true,
};

const MOCK_CLIENT = {
  id: 1,
  name: 'Alice Dupont',
  phone: '0601020304',
  totalVisits: 5,
  lastVisit: '2025-01-10',
};

function renderClientDetail() {
  const ClientDetailScreen = require('../../../app/(pro)/(clients)/client-detail').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ClientDetailScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClientDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClients.mockResolvedValue({ success: true, data: [MOCK_CLIENT] });
    mockGetClientNotes.mockResolvedValue({ success: true, data: MOCK_NOTES });
    mockUpdateClientNotes.mockResolvedValue({ success: true });
    mockBlockClient.mockResolvedValue({ success: true });
  });

  it('renders client name after loading', async () => {
    const { findByText } = renderClientDetail();
    await findByText('Alice Dupont');
  });

  it('renders Fiche cliente title', async () => {
    const { findByText } = renderClientDetail();
    await findByText('Fiche cliente');
  });

  it('renders client notes in the notes field', async () => {
    const { findByDisplayValue } = renderClientDetail();
    await findByDisplayValue('Cliente fidèle depuis 2022');
  });

  it('renders allergies field', async () => {
    const { findByDisplayValue } = renderClientDetail();
    await findByDisplayValue('Résine UV');
  });

  it('save button appears when notes are changed', async () => {
    const { findByDisplayValue, findByText } = renderClientDetail();
    const notesInput = await findByDisplayValue('Cliente fidèle depuis 2022');
    fireEvent.changeText(notesInput, 'Notes modifiées');
    await findByText('Enregistrer les notes');
  });

  it('calls updateClientNotes when save is pressed', async () => {
    const { findByDisplayValue, findByText } = renderClientDetail();
    const notesInput = await findByDisplayValue('Cliente fidèle depuis 2022');
    fireEvent.changeText(notesInput, 'Nouvelles notes');
    const saveBtn = await findByText('Enregistrer les notes');
    fireEvent.press(saveBtn);
    await waitFor(() => {
      expect(mockUpdateClientNotes).toHaveBeenCalledWith(
        1, // number, not string
        expect.objectContaining({ notes: 'Nouvelles notes' })
      );
    });
    expect(typeof mockUpdateClientNotes.mock.calls[0][0]).toBe('number');
  });

  it('renders Bloquer cette cliente button', async () => {
    const { findByText } = renderClientDetail();
    await findByText('Bloquer cette cliente');
  });
});
