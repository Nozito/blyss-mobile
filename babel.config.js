module.exports = function (api) {
  const isTest = api.env("test");
  api.cache(!isTest);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // reanimated/plugin requires react-native-worklets which is unavailable in Node/Jest
      ...(isTest ? [] : ["react-native-reanimated/plugin"]),
    ],
  };
};