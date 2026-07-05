const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const reactNative = require("eslint-plugin-react-native");

const nodeGlobals = {
  require: "readonly",
  module: "readonly",
  process: "readonly",
  console: "readonly",
  __dirname: "readonly",
  fetch: "readonly",
};

module.exports = tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      ".claude/**",
      "dist/**",
      "ios/**",
      "android/**",
      "expo-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-native": reactNative,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        __DEV__: "readonly",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-native/no-inline-styles": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      // require() is the standard Metro pattern for static assets (require("./logo.png"))
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Tooling / build config files run under Node's CommonJS module system
    files: [
      "*.config.js",
      "plugins/**/*.js",
      "scripts/**/*.{js,mjs}",
      "eslint.config.js",
    ],
    languageOptions: {
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
