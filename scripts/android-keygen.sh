#!/usr/bin/env bash
set -euo pipefail
KEYSTORE="${ANDROID_KEYSTORE_PATH:-$HOME/.android/stc-release.keystore}"
STORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-screen-time}"
KEY_PASS="${ANDROID_KEY_PASSWORD:-$STORE_PASS}"
if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias stc \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STORE_PASS" -keypass "$KEY_PASS" \
    -dname "CN=Screen Time Control, OU=Dev, O=STC, L=Local, ST=NA, C=US"
fi
echo "Keystore: $KEYSTORE"
echo "Export ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_PASSWORD for CI"
