# Blyss Mobile

React Native / Expo app — full port of the Blyss web app.

## Stack

| Layer | Library |
|---|---|
| Framework | Expo SDK 53 + Expo Router v4 |
| Language | TypeScript (strict) |
| Styling | NativeWind v4 (Tailwind CSS) |
| State | TanStack Query v5 |
| Auth | JWT via Bearer token in SecureStore |
| Forms | React Hook Form + Zod |
| Maps | react-native-maps |
| Animations | react-native-reanimated |
| Payments | @stripe/stripe-react-native |
| Subscriptions | react-native-purchases (RevenueCat) |
| DB (realtime) | @supabase/supabase-js |

## Getting started

### 1. Install dependencies

```bash
cd blyss-mobile
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# Fill in your values
```

Required vars:
- `EXPO_PUBLIC_API_URL` — your Express backend URL
- `EXPO_PUBLIC_WS_URL` — WebSocket URL (same server, `wss://`)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (for realtime)

### 3. Start dev server

```bash
# iOS simulator
npm run ios

# Android emulator
npm run android

# Expo Go (quick test — some native modules won't work)
npm start
```

### 4. Placeholder assets

Create these placeholder files before first build:

```bash
mkdir -p assets
# Add: icon.png (1024×1024), splash.png (1242×2436), adaptive-icon.png (1024×1024)
# Add: favicon.png (48×48), notification-icon.png (96×96)
```

## EAS Build (production)

### Prerequisites

```bash
npm install -g eas-cli
eas login
```

### Configure EAS

Edit `app.config.ts` → set `extra.eas.projectId` to your EAS project ID:

```bash
eas init   # creates project + sets projectId automatically
```

### Build

```bash
# iOS (TestFlight / App Store)
eas build --platform ios --profile preview
eas build --platform ios --profile production

# Android (Play Store)
eas build --platform android --profile preview
eas build --platform android --profile production
```

### Submit

```bash
eas submit --platform ios
eas submit --platform android
```

## Authentication note

The backend uses HttpOnly cookies for the web app. The mobile app stores JWT tokens
in `expo-secure-store` instead and sends them as `Authorization: Bearer <token>` headers.
The backend must accept both cookie-based and Bearer token auth (or add a Bearer auth
middleware). This is the standard pattern for mobile → REST API auth.

## Architecture

```
app/
  _layout.tsx          Root: providers, splash
  index.tsx            Smart redirect (→ login | client | pro | admin)
  (auth)/              Login, Register, Forgot Password
  (client)/            Tab nav: Home, Explore, Bookings, Favorites, Profile
  (pro)/               Tab nav: Dashboard, Agenda, Clients, Services, Profile
  (admin)/             Tab nav: Dashboard, Users, Bookings, Analytics
  specialist/[id].tsx  Full specialist profile
  booking/[id].tsx     Booking detail

components/
  ui/                  Button, Card, Input, Badge, Avatar, Modal, StarRating…
  SpecialistCard.tsx
  BookingCard.tsx

contexts/
  AuthContext.tsx      JWT auth state (SecureStore)
  NotificationContext  WebSocket + push notifications

lib/
  api.ts               Full API client (mirrors web src/services/api.ts)
  storage.ts           SecureStore wrapper
  queryClient.ts       TanStack Query config
  supabase.ts          Supabase client (realtime)

hooks/
  useDebounce.ts
  useFavorites.ts

constants/
  colors.ts            Blyss brand palette
```
