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

  // La config splash "moderne" vit dans le plugin expo-splash-screen (plugins[]
  // ci-dessous), pas ici — la clé top-level `splash` est dépréciée depuis le SDK
  // Expo 51 et génère un splash "legacy" (cf. SplashScreenLegacy dans le projet
  // iOS généré) qui n'utilise pas l'API SplashScreen moderne d'Android 12+.

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
      NSUserNotificationsUsageDescription:
        "Blyss vous envoie des rappels pour vos rendez-vous.",
      // NSContactsUsageDescription et NSUserTrackingUsageDescription retirées :
      // aucune des deux API correspondantes (expo-contacts, ATT) n'est utilisée
      // dans le code — une permission déclarée sans usage réel est un motif de
      // rejet App Store (Guideline 5.1.1) et une confusion inutile pour l'utilisateur
      // au moment de la demande d'accès.
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
    [
      "expo-splash-screen",
      {
        // Image statique du "B" affichée par l'OS avant que le JS ne démarre.
        // Le logo animé (dessin → remplissage) ne peut vivre qu'en JS — c'est
        // ce même B qui prend le relais dès que le bundle est prêt (voir
        // app/_layout.tsx → LaunchSplash). La couleur DOIT matcher
        // constants/splash.ts pour éviter un flash au hand-off.
        image: "./assets/splash.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: "#FFF0F5",
      },
    ],
    "expo-secure-store",
    [
      "expo-location",
      {
        // Seul le "when in use" est réellement utilisé (recherche de pros à
        // proximité) — désactiver explicitement le background empêche le plugin
        // d'injecter les clés NSLocationAlways* avec un texte générique non
        // traduit dans l'Info.plist, ce qui expose sinon une permission plus
        // large que ce que l'app fait réellement.
        locationWhenInUsePermission:
          "Blyss utilise votre localisation pour trouver des spécialistes près de vous.",
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
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
        // L'app ne capture jamais de vidéo — désactive l'injection de
        // NSMicrophoneUsageDescription (sinon ajoutée avec un texte générique
        // non utilisé, incohérence relevée à l'audit sécurité).
        microphonePermission: false,
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
