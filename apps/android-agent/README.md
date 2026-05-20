# Android agent

Kotlin Android agent for Screen Time Control. Built with **Gradle only** — no Android Studio required.

## Prerequisites

- **JDK 17** (`java -version` should report 17+)
- **Android SDK** via [command-line tools](https://developer.android.com/studio#command-line-tools-only)

### Install SDK (one-time)

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
# Download latest commandlinetools for your OS from developer.android.com
# Unzip to $ANDROID_HOME/cmdline-tools/latest/

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Add to your shell profile:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

### Firebase config

Replace `app/google-services.json` with the file from your family's Firebase project (same package name `com.screentimecontrol.agent`).

## Build

```bash
cd apps/android-agent
./gradlew assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

## Install on device

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Run tests

```bash
./gradlew test
```

## First-run setup

1. Launch the app on the child device.
2. Grant Accessibility, overlay, battery exemption, device admin, and notifications.
3. Enter the 6-character pairing code from the parent dashboard.
4. The agent starts `EnforcementService` (foreground) and `ForegroundWatcherService` (accessibility).

## Architecture

| Component | Role |
|-----------|------|
| `ForegroundWatcherService` | Accessibility: foreground package + browser URL |
| `EnforcementService` | 1 Hz `decide()` loop, usage accounting, notifications |
| `LocalStateStore` / Room | Events queue, usage, rules/unlocks cache |
| `FirestoreSync` | Pairing, rules/unlocks listeners, event upload |
| `SyncWorker` | WorkManager periodic sync (15 min) |
| `UpdateWorker` | `getUpdateManifest` + APK download/verify |
| `LockoutActivity` / `WarningController` | Grace countdown, home intent, overlay |
| `TamperDeviceAdmin` | Uninstall resistance |
| `AccessibilityWatchdog` | Detect accessibility disabled |
| `rules/RulesEngine.kt` | Self-contained rules engine (TS parity) |
