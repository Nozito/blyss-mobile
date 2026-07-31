import React from 'react';
import { render } from '@testing-library/react-native';
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
  useSegments: () => [],
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
  useRevenueCat: () => ({ customerInfo: null, activePlan: null, packages: [], purchase: jest.fn(), restorePurchases: jest.fn(), refreshActivePlan: jest.fn() }),
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, visible }: any) => (visible ? children : null),
}));

jest.mock('@/components/ui/LoadingButton', () => ({
  LoadingButton: ({ label }: any) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
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

const mockGetCalendar = jest.fn();
const mockGetSlots = jest.fn();
const mockGetUnavailabilities = jest.fn();
const mockCreateSlot = jest.fn();
const mockUpdateSlot = jest.fn();
const mockDeleteSlot = jest.fn();
const mockCreateUnavailability = jest.fn();
const mockDeleteUnavailability = jest.fn();
const mockUpdateReservationStatus = jest.fn();
const mockMarkNoShow = jest.fn();

jest.mock('@/lib/api', () => ({
  proApi: {
    getCalendar: (...args: any[]) => mockGetCalendar(...args),
    getSlots: (...args: any[]) => mockGetSlots(...args),
    getUnavailabilities: (...args: any[]) => mockGetUnavailabilities(...args),
    createSlot: (...args: any[]) => mockCreateSlot(...args),
    updateSlot: (...args: any[]) => mockUpdateSlot(...args),
    deleteSlot: (...args: any[]) => mockDeleteSlot(...args),
    createUnavailability: (...args: any[]) => mockCreateUnavailability(...args),
    deleteUnavailability: (...args: any[]) => mockDeleteUnavailability(...args),
    updateReservationStatus: (...args: any[]) => mockUpdateReservationStatus(...args),
  },
  nailTechApi: {
    markNoShow: (...args: any[]) => mockMarkNoShow(...args),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderCalendar() {
  const ProCalendarScreen = require('../../app/(pro)/calendar').default;
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProCalendarScreen />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProCalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCalendar.mockResolvedValue({ success: true, data: [] });
    mockGetSlots.mockResolvedValue({ success: true, data: [] });
    mockGetUnavailabilities.mockResolvedValue({ success: true, data: [] });
  });

  it('renders the Agenda header', async () => {
    const { findByText } = renderCalendar();
    await findByText('Agenda');
  });

  it('renders current month/year in calendar grid', async () => {
    const { findByText } = renderCalendar();
    const now = new Date();
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    await findByText(new RegExp(`${months[now.getMonth()]}.*${now.getFullYear()}`));
  });

  it('shows empty slot state when no slots', async () => {
    const { findByText } = renderCalendar();
    await findByText('Aucun créneau ce jour');
  });

  it('renders "Créneau" add button', async () => {
    const { findByText } = renderCalendar();
    await findByText('Créneau');
  });

  it('renders Planning and Absences cards', async () => {
    const { findByText } = renderCalendar();
    await findByText('Planning');
    await findByText('Absences');
  });
});
