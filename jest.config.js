/** @type {import('jest').Config} */
module.exports = {
  // Tests purs TS (logique business, API mocks) — pas de composants React Native
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: { strict: false, esModuleInterop: true },
    }],
  },
};
