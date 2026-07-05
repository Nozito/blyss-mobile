import { ExpoConfig, ConfigContext } from "expo/config";
import withStoreKitConfig from "./plugins/withStoreKitConfig";

const EAS_PROJECT_ID = "0e3cae8f-7b87-4e19-9fea-e8a16fa399e4";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Blyss",
  slug: "blyss",
  owner: "nozito",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  backgroundColor: "#FFF0F5",

  icon: "./assets/icon-appstore.png",
  scheme: "blyss",

  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#FFF0F5",
  },

  assetBundlePatterns: ["**/*"],

  ios: {
    bundleIdentifier: "blyss.app",
    buildNumber: "1",
    supportsTablet: false,
    requireFullScreen: true,
    userInterfaceStyle: "light",
    associatedDomains: ["applinks:blyssapp.fr"],
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "Blyss utilise votre caméra pour ajouter une photo de profil.",
      NSPhotoLibraryUsageDescription:
        "Blyss accède à votre galerie pour votre photo de profil et votre galerie pro.",
      NSPhotoLibraryAddUsageDescription:
        "Blyss enregistre les photos dans votre galerie.",
      NSFaceIDUsageDescription:
        "Blyss utilise Face ID pour vous connecter rapidement et en sécurité.",
      NSLocationWhenInUseUsageDescription:
        "Blyss utilise votre localisation pour trouver des spécialistes près de vous.",
      NSContactsUsageDescription:
        "Blyss peut accéder à vos contacts pour retrouver des praticiens que vous connaissez.",
      NSUserNotificationsUsageDescription:
        "Blyss vous envoie des rappels pour vos rendez-vous.",
      NSUserTrackingUsageDescription:
        "Blyss utilise cet identifiant pour personnaliser ton expérience et améliorer nos services.",
      CFBundleURLTypes: [
        {
          CFBundleURLName: "blyss.app",
          CFBundleURLSchemes: ["blyss"],
        },
      ],
    },
  },

  android: {
    package: "blyss.app",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFF0F5",
    },
    permissions: [
      "CAMERA",
      "READ_MEDIA_IMAGES",
      "USE_BIOMETRIC",
      "USE_FINGERPRINT",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "blyssapp.fr", pathPrefix: "/s" },
          { scheme: "https", host: "blyssapp.fr", pathPrefix: "/booking" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
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
    "expo-apple-authentication",
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Blyss utilise Face ID pour vous connecter rapidement et en sécurité.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#FE5D9D",
        sounds: [],
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
    withStoreKitConfig,
  ] as ExpoConfig["plugins"],

  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: "appVersion" },

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
    appDescription:
      "La plateforme tout-en-un pour gérer ton salon de nail art comme une pro",
    brandColor: "#FE5D9D",
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.blyssapp.fr",
  },
});
