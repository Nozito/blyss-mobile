#!/usr/bin/env bash
# Build, install and launch the app on an iOS Simulator with the local
# StoreKit Configuration file active, so RevenueCat can fetch offerings.
#
# Needed because `expo run:ios` / `xcrun simctl launch` don't honor the
# Xcode scheme's "StoreKit Configuration" setting (only Xcode's own Run
# button does) — we pass -StoreKitConfigurationFilePath as a launch
# argument instead, which works regardless of how the app is launched.
#
# Env overrides: DEVICE_ID=<udid> DEVICE_NAME="iPhone 17 Pro" CONFIGURATION=Debug
set -euo pipefail
cd "$(dirname "$0")/.."

BUNDLE_ID="app.blyss.mobile"
SCHEME="Blyss"
WORKSPACE="ios/Blyss.xcworkspace"
DERIVED_DATA="ios/build"
CONFIGURATION="${CONFIGURATION:-Debug}"
STOREKIT_FILENAME="Blyss.storekit"

if [ ! -d ios ]; then
  echo "No ios/ directory found, running expo prebuild..."
  npx expo prebuild -p ios
fi

if [ -n "${DEVICE_ID:-}" ]; then
  UDID="$DEVICE_ID"
else
  UDID=$(xcrun simctl list devices booted | grep -o '[0-9A-F-]\{36\}' | head -1 || true)
  if [ -z "$UDID" ]; then
    NAME="${DEVICE_NAME:-iPhone 17 Pro}"
    UDID=$(xcrun simctl list devices available | grep "$NAME" | grep -o '[0-9A-F-]\{36\}' | head -1)
    if [ -z "$UDID" ]; then
      echo "No simulator named '$NAME' found. Set DEVICE_NAME or DEVICE_ID to pick one." >&2
      exit 1
    fi
    echo "Booting simulator $NAME ($UDID)..."
    xcrun simctl boot "$UDID"
  fi
fi
echo "Using simulator $UDID"
open -a Simulator --args -CurrentDeviceUDID "$UDID" 2>/dev/null || open -a Simulator

if ! lsof -i :8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting Metro..."
  CI=1 npx expo start > /tmp/blyss-metro.log 2>&1 &
  disown
  sleep 3
else
  echo "Metro already running on :8081"
fi

echo "Building $SCHEME ($CONFIGURATION) for simulator..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" \
  build

APP_PATH=$(find "$DERIVED_DATA/Build/Products" -maxdepth 2 -iname "*.app" | head -1)
if [ -z "$APP_PATH" ]; then
  echo "Build failed: no .app produced." >&2
  exit 1
fi

echo "Installing $APP_PATH..."
xcrun simctl install "$UDID" "$APP_PATH"

CONTAINER=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" app)
STOREKIT_PATH="$CONTAINER/$STOREKIT_FILENAME"

echo "Launching with local StoreKit config ($STOREKIT_PATH)..."
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE_ID" -StoreKitConfigurationFilePath "$STOREKIT_PATH"

echo "Done. Metro logs: /tmp/blyss-metro.log"
