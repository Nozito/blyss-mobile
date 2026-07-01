import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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
  AnimatedIconButton: ({ children, onPress, className }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));

jest.mock('@/lib/navigation', () => ({ safeBack: jest.fn() }));

jest.mock('@/lib/api', () => ({}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHelp() {
  const ProHelpScreen = require('../../../app/(pro)/(profile)/help').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProHelpScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProHelpScreen', () => {
  it('renders Aide & support header', () => {
    const { getByText } = renderHelp();
    expect(getByText('Aide & support')).toBeTruthy();
  });

  it('renders all 4 category filter tabs', () => {
    const { getByText } = renderHelp();
    expect(getByText('Agenda')).toBeTruthy();
    expect(getByText('Clientes')).toBeTruthy();
    expect(getByText('Paiements')).toBeTruthy();
    expect(getByText('Compte')).toBeTruthy();
  });

  it('shows agenda FAQs by default', () => {
    const { getByText } = renderHelp();
    expect(getByText('Comment créer des créneaux disponibles ?')).toBeTruthy();
    expect(getByText('Comment bloquer des indisponibilités ?')).toBeTruthy();
    expect(getByText('Comment gérer mes réservations ?')).toBeTruthy();
  });

  it('switches to Clientes FAQs when Clientes tab pressed', () => {
    const { getByText, queryByText } = renderHelp();
    fireEvent.press(getByText('Clientes'));
    expect(getByText('Comment voir mes clientes ?')).toBeTruthy();
    expect(getByText('Comment contacter une cliente ?')).toBeTruthy();
    // Agenda FAQ should no longer be visible
    expect(queryByText('Comment créer des créneaux disponibles ?')).toBeNull();
  });

  it('switches to Paiements FAQs', () => {
    const { getByText } = renderHelp();
    fireEvent.press(getByText('Paiements'));
    expect(getByText('Comment activer les paiements en ligne ?')).toBeTruthy();
  });

  it('switches to Compte FAQs', () => {
    const { getByText } = renderHelp();
    fireEvent.press(getByText('Compte'));
    expect(getByText('Comment modifier mon profil public ?')).toBeTruthy();
    expect(getByText('Comment gérer mon abonnement ?')).toBeTruthy();
  });

  it('expands FAQ answer when question pressed', () => {
    const { getByText, queryByText } = renderHelp();
    // Answer not visible initially
    expect(queryByText(/Depuis l'onglet Agenda, sélectionne un jour/)).toBeNull();
    // Press the question
    fireEvent.press(getByText('Comment créer des créneaux disponibles ?'));
    expect(getByText(/Depuis l'onglet Agenda, sélectionne un jour/)).toBeTruthy();
  });

  it('collapses FAQ answer when same question pressed again', () => {
    const { getByText, queryByText } = renderHelp();
    const question = getByText('Comment créer des créneaux disponibles ?');
    fireEvent.press(question);
    // Open → press again to close
    fireEvent.press(question);
    expect(queryByText(/Depuis l'onglet Agenda, sélectionne un jour/)).toBeNull();
  });
});
