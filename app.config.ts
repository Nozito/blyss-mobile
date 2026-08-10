import { ExpoConfig, ConfigContext } from "expo/config";
import withStoreKitConfig from "./plugins/withStoreKitConfig";

const LIVE_ACTIVITY_APP_GROUP = "group.blyss.app";

const EAS_PROJECT_ID = "0e3cae8f-7b87-4e19-9fea-e8a16fa399e4";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Blyss",
  slug: "blyss",
  owner: "nozito",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
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
    userInterfaceStyle: "automatic",
    associatedDomains: ["applinks:blyssapp.fr"],
    // Apple Developer → Membership → Team ID. Required by @bacons/apple-targets
    // to sign the Live Activity Widget Extension target during prebuild.
    appleTeamId: "B92ST2GG54",
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
      // Shared with the LiveRdvWidget target (targets/liveactivity) — lets the
      // static home-screen widget read the next-appointment payload the app
      // writes via the live-activity native module.
      "com.apple.security.application-groups": [LIVE_ACTIVITY_APP_GROUP],
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Required for the app to be authorized to start Live Activities at
      // all (Live RDV feature) — without it, Activity.request() fails and
      // the system logs "No record for <bundleId> found" for every attempt.
      NSSupportsLiveActivities: true,
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
      // Pas de plugin "expo-calendar" dans plugins[] ci-dessous : il injecte aussi
      // NSRemindersUsageDescription + les permissions Android READ/WRITE_CALENDAR,
      // qu'on n'utilise pas (sync Apple Calendar only, iOS only) — même logique que
      // pour NSContactsUsageDescription plus haut, une permission déclarée sans
      // usage réel est un motif de rejet App Store. Les deux clés Calendars
      // couvrent iOS 17+ (Full Access) et les versions antérieures (legacy).
      NSCalendarsFullAccessUsageDescription:
        "Blyss ajoute tes rendez-vous à ton calendrier Apple pour que tu les retrouves partout.",
      NSCalendarsUsageDescription:
        "Blyss ajoute tes rendez-vous à ton calendrier Apple pour que tu les retrouves partout.",
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
    // Doit rester en phase avec le questionnaire "Privacy Nutrition Label"
    // rempli dans App Store Connect — sinon Apple peut rejeter le build pour
    // incohérence entre le manifeste et la fiche du store.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePaymentInfo",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            "NSPrivacyCollectedDataTypePurposeAppFunctionality",
          ],
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
        // 1x1 transparent pixel — the installed expo-splash-screen plugin
        // crashes during prebuild if `image` is omitted entirely
        // ([ios.splashScreenStoryboard]: Cannot read properties of
        // undefined (reading '0')), so this satisfies the plugin while
        // rendering nothing. The OS-rendered splash (before the JS bundle
        // runs) can only show a static, non-scaled image and there's no way
        // to make a single fixed-size asset look right across every device
        // width/scale without either a tiny stray mark or an oversized one
        // — background-color-only avoids that. The animated Blyss logo
        // (app/_layout.tsx → LaunchSplash / BlyssLogoLoader) is the first
        // logo the user actually sees, right after JS takes over.
        // Colors DOIVENT matcher constants/splash.ts pour éviter un flash.
        image: "./assets/splash-blank.png",
        imageWidth: 1,
        backgroundColor: "#FFF0F5",
        dark: {
          image: "./assets/splash-blank.png",
          backgroundColor: "#0A0A0B",
        },
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
    "@bacons/apple-targets",
    // Pas le plugin "@sentry/react-native" ici : il injecte une phase de
    // build Xcode qui tente d'uploader les dSYM/sourcemaps et échoue tout
    // le build (local ET EAS) tant que SENTRY_ORG/SENTRY_PROJECT/
    // SENTRY_AUTH_TOKEN ne sont pas configurés. Sentry.init() (app/_layout.tsx)
    // suffit pour le crash reporting — l'upload de symboles est une
    // amélioration à activer plus tard, une fois les secrets en place.
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
