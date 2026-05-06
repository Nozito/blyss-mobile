import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Blyss",
  slug: "blyss-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "blyss",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#FFEAF1",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "fr.blyssapp.mobile",
    buildNumber: "1",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Blyss utilise votre localisation pour trouver des spécialistes près de vous.",
      NSCameraUsageDescription:
        "Blyss utilise la caméra pour modifier votre photo de profil.",
      NSPhotoLibraryUsageDescription:
        "Blyss accède à votre galerie pour votre photo de profil.",
      NSUserNotificationsUsageDescription:
        "Blyss vous envoie des rappels pour vos rendez-vous.",
    },
  },
  android: {
    package: "fr.blyssapp.mobile",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFEAF1",
    },
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-secure-store",
    "expo-location",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#FF5EA0",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Blyss accède à votre galerie pour votre photo de profil.",
        cameraPermission:
          "Blyss utilise la caméra pour modifier votre photo de profil.",
      },
    ],
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier: "merchant.fr.blyssapp.mobile",
        enableGooglePay: true,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "0e3cae8f-7b87-4e19-9fea-e8a16fa399e4",
    },
  },
});
