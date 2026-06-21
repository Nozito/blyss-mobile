import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Blyss",
  slug: "blyss",
  owner: "nozito",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon-appstore.png",
  scheme: "blyss",
  userInterfaceStyle: "light",
  backgroundColor: "#FFF0F5",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#FFF0F5",
  },
  ios: {
    supportsTablet: false,
    requireFullScreen: true,
    userInterfaceStyle: "light",
    bundleIdentifier: "blyss.app",
    buildNumber: "1",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        "Blyss utilise votre localisation pour trouver des spécialistes près de vous.",
      NSCameraUsageDescription:
        "Blyss utilise la caméra pour modifier votre photo de profil.",
      NSPhotoLibraryUsageDescription:
        "Blyss accède à votre galerie pour votre photo de profil.",
      NSUserNotificationsUsageDescription:
        "Blyss vous envoie des rappels pour vos rendez-vous.",
      // RevenueCat SDK embeds ATT-capable code on iOS — required since iOS 14
      NSUserTrackingUsageDescription:
        "Blyss utilise cet identifiant pour personnaliser ton expérience et améliorer nos services.",
    },
  },
  android: {
    package: "com.blyss.app",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#FFF0F5",
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
    favicon: "./assets/logo.png",
    title: "Blyss — Beauté. Business. Sérénité.",
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
        merchantIdentifier: "merchant.com.blyss.app",
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
    appDescription:
      "La plateforme tout-en-un pour gérer ton salon de nail art comme une pro",
    brandColor: "#FE5D9D",
  },
});
