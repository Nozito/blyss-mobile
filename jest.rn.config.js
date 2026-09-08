module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  // react-native-worklets (dépendance de reanimated 4) : strip les extensions
  // `.native` pour que jest résolve l'implémentation JS pure, sinon
  // « WorkletsError: Native part of Worklets doesn't seem to be initialized ».
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.rn.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind)',
  ],
  coverageThreshold: {
    'app/(pro)/**': {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
