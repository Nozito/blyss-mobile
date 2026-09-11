/* eslint-disable @typescript-eslint/no-require-imports */
require('@testing-library/jest-native/extend-expect');

// ── AsyncStorage ─────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ── Wrappers animés maison ───────────────────────────────────────────────────
// Passthrough : les tests d'écran n'assertent jamais l'animation, seulement le
// contenu et les interactions. Fournit TOUS les exports (les mocks par fichier
// n'en fournissaient qu'un, d'où « Element type is invalid »).
jest.mock('@/components/ui/AnimatedPressable', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const wrap = (Comp) =>
    React.forwardRef(({ children, ...props }, ref) =>
      React.createElement(Comp, { ref, ...props }, children),
    );
  return {
    AnimatedPressable: wrap(Pressable),
    AnimatedIconButton: wrap(Pressable),
    AnimatedView: wrap(View),
  };
});

// ── Toast ────────────────────────────────────────────────────────────────────
jest.mock('@/components/ui/Toast', () => ({
  ToastProvider: ({ children }) => children,
  useToast: () => ({ showToast: jest.fn(), hideToast: jest.fn() }),
}));

// ── Haptics (souvent appelé sans être mocké) ─────────────────────────────────
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// ── Reanimated ───────────────────────────────────────────────────────────────
// `react-native-reanimated/mock` ne fournit pas tous les hooks (useReducedMotion).
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  // true → les écrans court-circuitent leurs séquences d'animation (callbacks
  // exécutés immédiatement) ; les tests n'assertent que le contenu final.
  useReducedMotion: () => true,
}));

// ── Contexts app souvent non enveloppés dans les tests d'écran ───────────────
jest.mock('@/contexts/TransitionContext', () => ({
  TransitionProvider: ({ children }) => children,
  useAppTransition: () => ({
    showTransition: jest.fn(),
    hideTransition: jest.fn(),
  }),
}));

// BiometricToggle : dépend d'expo-local-authentication (natif) — passthrough vide.
jest.mock('@/components/screens/shared/BiometricToggle', () => ({
  BiometricToggle: () => null,
}));

// ── react-native-maps ────────────────────────────────────────────────────────
// react-native-maps 1.27 (SDK 57) appelle TurboModuleRegistry.getEnforcing
// ('RNMapsAirModule') dès l'import → Invariant Violation en env jest. Mock
// global : chaque composant devient une <View> passe-plat.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = (props) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: Passthrough,
    MapView: Passthrough,
    Marker: Passthrough,
    Circle: Passthrough,
    Callout: Passthrough,
    Polygon: Passthrough,
    Polyline: Passthrough,
    Overlay: Passthrough,
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});
