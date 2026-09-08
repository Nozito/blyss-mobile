module.exports = function (api) {
  const isTest = api.env("test");
  api.cache(!isTest);
  return {
    presets: [
      // En test (jest), le runtime JSX de NativeWind (react-native-css-interop
      // via jsxImportSource) plante — `wrap-jsx` appelle `type.displayName` sur
      // des composants qu'il ne résout pas dans react-test-renderer. Les tests
      // n'assertent pas sur les styles `className`, on repasse donc au runtime
      // React standard.
      ["babel-preset-expo", { jsxImportSource: isTest ? "react" : "nativewind" }],
    ],
    plugins: [
      // reanimated/plugin requires react-native-worklets which is unavailable in Node/Jest
      ...(isTest ? [] : ["react-native-reanimated/plugin"]),
    ],
  };
};