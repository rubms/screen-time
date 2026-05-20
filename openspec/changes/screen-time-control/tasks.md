## 1. Repository and monorepo bootstrap

- [x] 1.1 Create the monorepo layout: `apps/{windows-agent,android-agent,web-dashboard}`, `packages/{shared-schemas,shared-rules-engine}`, `firebase/`, `scripts/`, top-level `README.md`, `LICENSE` (MIT), `.editorconfig`, `.gitignore` (Python, Kotlin, Node, Firebase, IDE)
- [x] 1.2 Add a root `pnpm-workspace.yaml` and `package.json` declaring TS/JS workspaces (`web-dashboard`, `shared-schemas`, `shared-rules-engine`, `firebase/functions`); pin Node 20 in `.nvmrc`; configure Prettier + ESLint at root
- [x] 1.3 Add `scripts/firebase-setup.sh` (Bash) that walks a user through `firebase login`, `firebase projects:create`, enabling APIs (Auth, Firestore, Functions, Hosting), and writes `firebase/.firebaserc`. README documents prerequisites (firebase-tools, gcloud optional)
  - Acceptance: a parent following the README from a clean machine can provision a project end-to-end without manual GCP console steps beyond the OAuth consent screen.
- [x] 1.4 Configure `commitlint` + `husky` + `lint-staged` enforcing Conventional Commits and per-language formatting on staged files

## 2. Shared schemas package (`packages/shared-schemas`)

- [x] 2.1 Define JSON Schemas for: `Rules`, `RulesTarget` (app & url variants), `WeeklySchedule`, `Device`, `Child`, `Family`, `TempUnlock`, `SessionEvent`, `DailyRollup`, `PairingCode`, `ParentSecrets`. One file per type under `schemas/`
- [x] 2.2 Set up `pnpm` build script that compiles JSON Schemas to TypeScript types via `json-schema-to-typescript`, exporting from `src/index.ts`
- [x] 2.3 Generate Python `pydantic` models from the same schemas via `datamodel-code-generator`, output to `python/screen_time_schemas/`; publish as a local editable install consumed by the Windows agent
- [x] 2.4 Generate Kotlin data classes via `jsonschema2pojo` (or hand-write — there are ~12 types), output to `kotlin/screen_time_schemas/`; publish as a local Gradle module consumed by the Android agent
- [x] 2.5 Add a tiny CI step that asserts `pnpm gen:all` produces no diff in `src/`, `python/`, `kotlin/` (i.e., generated files are checked in)

## 3. Shared rules-engine — TypeScript reference (`packages/shared-rules-engine`)

- [x] 3.1 Implement `decide(activity, rules, usage, nowLocal, tempUnlocks): Decision` per `specs/rules-engine/spec.md` in `src/decide.ts`; pure, no I/O
- [x] 3.2 Implement activity resolution: longest-prefix URL pattern match, app matcher selection by platform + `windowTitlePattern`, BLOCKED-app-dominates-URL rule
- [x] 3.3 Implement quota arithmetic across total budget, per-target quota, schedule-window-end, and active temp-unlock additions
- [x] 3.4 Implement temp-unlock composition: additive `add-minutes`; permissive union of `scope`
- [x] 3.5 Author `fixtures/cases.json` with ≥ 50 input/output cases covering every decision branch (BLOCKED, ALLOWED, LIMITED + quota remaining, LIMITED + WARN, OUT_OF_TIME by per-target quota, OUT_OF_TIME by total budget, OUTSIDE_SCHEDULE, multiple temp-unlocks, midnight rollover, URL longest-prefix vs. wildcard, BLOCKED-app-overrides-URL, etc.)
- [x] 3.6 Vitest suite that runs the fixture and any extra unit tests; coverage ≥ 95% lines, ≥ 90% branches; `pnpm test` enforces threshold

## 4. Firebase backend (`firebase/`)

- [x] 4.1 `firestore.rules` implementing the security model from `design.md` §Security rules; include unit tests via `@firebase/rules-unit-testing` covering: parent reads/writes, device append-only events, cross-family isolation, owner-only `families/{fid}` mutations, private/secrets visibility
- [x] 4.2 `firestore.indexes.json` declaring the composite indexes from `design.md` §Indexes
- [x] 4.3 Cloud Function `redeemPairingCode(httpsCallable)`: validates code, creates device doc, mints custom token with `{ familyId, childId, deviceId, role: "device" }` claims
  - Acceptance scenarios: expired code → 410; redeemed code → 409; valid code → 200 with custom token + device document created
- [x] 4.4 Cloud Function `validateTempUnlock(onWrite trigger)`: rejects/auto-revokes documents that violate schema bounds (duration > 240, unknown scope, missing target for add-minutes); emits audit `tamper-attempt` event with `tamperKind: "invalid-temp-unlock"`
- [x] 4.5 Cloud Function `rollupDaily(scheduled, every 30 min)`: scans children whose timezone shows local time between 00:30 and 01:00 and writes `dailyRollups/{YYYY-MM-DD}` from yesterday's events. Idempotent (re-runs replace)
- [x] 4.6 Cloud Function `cleanupOldEvents(scheduled daily)`: deletes raw events with `serverAt < now - 90d` in batches of 500
- [x] 4.7 Cloud Function `getUpdateManifest(httpsCallable)`: proxies GitHub Releases API for `UPDATE_REPO`, returns `{ version, assetUrl, sha256 }` for the requested `{ platform, channel }`; in-memory cache 5 minutes
- [x] 4.8 Cloud Function `verifyParentPin(httpsCallable)`: takes `{ pin }`, compares against `families/{fid}/private/secrets.parentPinHash` (bcrypt) for the caller's family; rate-limited (5 attempts / 5 min / IP)
- [x] 4.9 `firebase.json` wiring Hosting (rewrites everything else to `/index.html`), Functions, Firestore rules/indexes; emulator suite config (`firebase emulators:start --only auth,firestore,functions,hosting`)
- [x] 4.10 End-to-end emulator integration test (Vitest + `firebase-admin`): creates a family, pairs a fake device, writes events, runs the rollup, asserts dashboard-shaped queries return expected data

## 5. Shared rules-engine — Python port

- [x] 5.1 Implement `screen_time_rules/decide.py` mirroring the TS reference, with the same `Decision` shape (use `pydantic` discriminated union)
- [x] 5.2 Pytest parity runner that reads `packages/shared-rules-engine/fixtures/cases.json` and asserts byte-equal JSON output per case
- [x] 5.3 100% mypy --strict clean; `ruff` clean

## 6. Windows agent (`apps/windows-agent`)

- [x] 6.1 Project skeleton: `pyproject.toml` (Poetry), Python 3.12, deps: `pywin32`, `comtypes`, `psutil`, `pydantic>=2`, `firebase-admin`, `google-cloud-firestore`, `pystray`, `pillow` (icons), `winrt-runtime` + `winrt-Windows.UI.Notifications` for toasts, `bcrypt`, `keyring`. Lock with `poetry.lock`
- [x] 6.2 Add `src/screen_time_agent/__main__.py` entry; subcommands: `service install/uninstall/start/stop`, `pair --code XXXXXX`, `debug-run` (foreground mode for development)
- [x] 6.3 Implement `ForegroundWatcher` (1 Hz polling thread) using `win32gui.GetForegroundWindow` + `win32process.GetWindowThreadProcessId` + `psutil.Process(pid).name()`; emits `FocusEvent` to a thread-safe queue
  - Acceptance Gherkin scenarios: matches `specs/windows-agent/spec.md` §"Foreground window detection"
- [x] 6.4 Implement `BrowserReader` abstraction with per-browser UIA strategies for Chrome, Edge, Firefox (each: locate browser top-level window, find AddressBar UIA element by AutomationId/Name heuristics, read `ValuePattern`)
  - Acceptance: each per-browser reader passes a Pytest smoke test using a recorded UIA tree fixture; failures gracefully return `None` and emit `url-read-failed` (rate-limited)
- [x] 6.5 Implement `LocalStateStore` using SQLite (`%PROGRAMDATA%\ScreenTimeControl\state.sqlite`) with tables: `events`, `usage_today`, `rules_cache_meta`, `unlocks_cache`. Atomic writes; WAL mode
- [x] 6.6 Implement `FirestoreClient` (using `firebase-admin` with custom-token auth result reused from pairing): real-time listeners for `rules/current` and `temp-unlocks (deviceId == me)`; batched writes from event queue every 30 s with exponential backoff
- [x] 6.7 Wire `decide(...)` calls every second using `screen_time_rules` Python port; update `usage_today` table; produce `Decision` stream
- [x] 6.8 Implement `WarningUI`: toast via `winrt.Windows.UI.Notifications.ToastNotificationManager`; modal countdown via Tkinter `Toplevel` with `wm_attributes("-topmost", True)`; deduplication: max one toast per (targetId, threshold) per local day
- [x] 6.9 Implement `Closer`: for `OUT_OF_TIME`/`OUTSIDE_SCHEDULE` on a browser tab — locate target tab via UIA and send Ctrl+W; for other apps — `WM_CLOSE` then `TerminateProcess` after 3 s grace. Re-block on re-launch within 60 s (in-memory cooldown set)
- [x] 6.10 Implement Windows Service host (`win32serviceutil.ServiceFramework`): service name `ScreenTimeControlAgent`, runs as LocalSystem, configures recovery actions (3× restart 5 s), DACLs on install/programdata directories to deny non-admin write
- [x] 6.11 Implement watchdog (scheduled task installer): on logon + hourly, runs a tiny script that re-starts the service if not running
- [x] 6.12 Implement `TrayApp` (`pystray`) running as a separate user-session process started via a Run-key entry: shows remaining time, current category; "Settings…" entry opens a PIN prompt then launches the dashboard URL; PIN cached/verified via `verifyParentPin` Cloud Function
- [x] 6.13 Implement `Updater`: poll `getUpdateManifest` every 6 h; download to `%PROGRAMDATA%\ScreenTimeControl\updates\`; verify SHA-256; swap binary on next service restart (or immediately if `autoRestart`)
- [x] 6.14 Implement `ClockMonitor`: thread that tracks `time.monotonic()` vs. `datetime.now()`; emits `clock-tamper-suspected` on suspicious drift; rules engine always uses monotonic delta for quota accumulation
- [x] 6.15 PyInstaller build script `scripts/build-windows.ps1`: `--onefile`, embed icon, sign placeholder for future cert; produces `dist/ScreenTimeControl-{version}.exe`
- [x] 6.16 Inno Setup installer script (`installer/setup.iss`) that places the .exe under `%PROGRAMFILES%\ScreenTimeControl`, runs `service install`, registers the watchdog scheduled task, sets DACLs, and creates Start Menu shortcuts
- [x] 6.17 Integration test (pytest, runs on `windows-latest` GH runner): launches the agent in `debug-run`, opens Notepad and Chrome via subprocess, verifies events captured and decisions correct against a fake `rules.json`

## 7. Shared rules-engine — Kotlin port

- [x] 7.1 Implement `engine.kt` mirroring the TS reference; same `Decision` sealed class
- [x] 7.2 JUnit5 parity test that loads `fixtures/cases.json` and asserts equality against the same fixture used by TS and Python ports
- [x] 7.3 `ktlint` + `detekt` clean

## 8. Android agent (`apps/android-agent`)

- [x] 8.1 Project skeleton: Gradle Wrapper (`./gradlew`), Kotlin 1.9+, AGP 8.x, `compileSdk = 34`, `targetSdk = 34`, `minSdk = 26`. Dependencies: Firebase BoM (auth, firestore, FCM), AndroidX (core, work, lifecycle, appcompat, security-crypto), `kotlinx-coroutines`, `kotlinx-serialization-json`, `bcrypt`, the `shared-rules-engine` and `shared-schemas` Kotlin modules
- [x] 8.2 Document a no-Android-Studio setup: README explains installing JDK 17, downloading `commandlinetools-linux-*`, running `sdkmanager` to install `platforms;android-34`, `build-tools;34.0.0`, `platform-tools`. Verify `./gradlew tasks` works from a fresh machine
- [x] 8.3 Manifest: declare `BIND_ACCESSIBILITY_SERVICE`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, `BIND_DEVICE_ADMIN`, `REQUEST_DELETE_PACKAGES` (for update prompt). XML for AccessibilityService config restricting to browser packages + foreground-window events
- [x] 8.4 Implement `ForegroundWatcherService : AccessibilityService` — handles `TYPE_WINDOW_STATE_CHANGED` and `TYPE_WINDOW_CONTENT_CHANGED`; resolves foreground package; for browsers traverses `AccessibilityNodeInfo` for the URL bar resource id; rate-limits content events (≥ 200 ms per event)
- [x] 8.5 Implement `EnforcementService : Service` started as foreground with `ServiceCompat.startForeground(...)` and `FOREGROUND_SERVICE_TYPE_SPECIAL_USE`; persistent notification shows remaining time + category; periodic ticker (1 Hz coroutine) computes `decide(...)` against local state
- [x] 8.6 Implement `LocalStateStore` using Room: entities `EventEntity`, `UsageTodayEntity`, `RulesCacheEntity`, `UnlocksCacheEntity`; WAL-mode SQLite
- [x] 8.7 Implement `FirestoreSync`: WorkManager periodic worker (15 min) + expedited worker on connectivity-regain; uploads queued events; subscribes to `rules/current` + active `temp-unlocks` as long-running Service-owned listeners
- [x] 8.8 Implement `WarningController`: shows `Toast` for `WARN`; launches a translucent `LockoutActivity` with countdown for `OUT_OF_TIME`/`OUTSIDE_SCHEDULE`; on grace expiry, calls `startActivity(Intent.ACTION_MAIN | CATEGORY_HOME | FLAG_ACTIVITY_NEW_TASK)` then re-shows `LockoutActivity` over the launcher for 60 s
- [x] 8.9 Implement `LockoutActivity`: full-screen, immersive, dismisses only when the engine returns a non-blocking decision OR when the user navigates away naturally; respects `SYSTEM_ALERT_WINDOW` for re-overlay needs
- [x] 8.10 Implement `TamperDeviceAdmin : DeviceAdminReceiver` with `policies: limit-password, force-lock, watch-login, disable-uninstall (api 28+)`. Setup Activity guides parent through DA activation prompt
- [x] 8.11 Implement `AccessibilityWatchdog`: `AccessibilityManager.addAccessibilityStateChangeListener` detects disable; immediately starts `LockoutActivity` with "Re-enable Accessibility" message; emits tamper event
- [x] 8.12 Implement `BootReceiver : BroadcastReceiver` listening to `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED`; (re)starts `EnforcementService`
- [x] 8.13 Implement `PairingActivity`: collects required permissions (Accessibility, Overlay, Battery-optimization-exemption, Device Admin, POST_NOTIFICATIONS), then accepts the 6-character code, calls `redeemPairingCode`, stores custom token in `EncryptedSharedPreferences`, signs into Firebase Auth, transitions to `EnforcementService` running state
- [x] 8.14 Implement `Updater`: WorkManager job runs every 6 h, calls `getUpdateManifest`, downloads APK to internal storage, verifies SHA-256, shows high-priority notification opening the package installer via `Intent.ACTION_VIEW` on the APK URI (via `FileProvider`)
- [x] 8.15 Implement `ClockMonitor`: tracks `SystemClock.elapsedRealtime()` vs. `System.currentTimeMillis()`; emits tamper event on suspicious drift; rules engine uses elapsedRealtime for quota deduction
- [x] 8.16 `./gradlew :app:assembleRelease` produces a signed APK using a key generated by `scripts/android-keygen.sh` (uses `keytool` from JDK); keystore path supplied via environment variables in CI
- [x] 8.17 Espresso instrumentation test (run via `./gradlew connectedCheck` against an emulator started from CLI in CI) covering: pairing flow, lockout activation, toast appearance, accessibility-disabled detection

## 9. Web dashboard (`apps/web-dashboard`)

- [x] 9.1 Vite + React 18 + TypeScript + Tailwind + shadcn/ui scaffold; integrate Firebase Web SDK (Auth, Firestore, Functions); set up React Router; deploy target Firebase Hosting
- [x] 9.2 `AuthProvider`: Google sign-in only; resolves family on first sign-in (creates `families/{fid}` if absent); blocks rendering of family-scoped routes until resolved
- [x] 9.3 Family home page: list children cards with today's total/budget bar and "Add device" button; shows tamper-banner from the last 24h of events
- [x] 9.4 Pairing modal: calls `families/{fid}/pairingCodes`, displays 6-char code with countdown, listens for redemption (real-time listener on the code doc) and auto-closes
- [x] 9.5 Rules editor:
  - Targets list (apps + URLs) with add/edit/remove, category selector, per-day quota inputs, per-target warn/grace overrides
  - URL pattern validator (real-time syntax check + "test against" string)
  - Weekly schedule editor (per-weekday list of `[start, end]` windows; visual range picker)
  - Total daily budget per weekday
  - Defaults: `warningLeadMinutes`, `gracePeriodSeconds`
  - Save writes `rules/current` with incremented version
- [x] 9.6 Per-child usage view:
  - Today: live timeline (stacked bars by target) via real-time subscription on today's events
  - Last 7 days: bar chart of total minutes vs. budget per day (reads `dailyRollups`)
  - Per-target table sorted by today's minutes
  - Event log (warnings, closes, tamper) with filtering
- [x] 9.7 Temp-unlock UI: per-device "Temp unlock" button → modal with duration preset/custom, scope (with target picker for add-minutes), reason note; lists active unlocks with revoke buttons; shows live countdown
- [x] 9.8 Settings page: family name, parent PIN setter, invite other parent by email, view Firebase project ID, "Download diagnostics" (dumps rules + last-30-day events as JSON)
- [x] 9.9 Mobile-responsive verification: Playwright test at 375 × 800 viewport covering: sign-in, pairing modal, temp-unlock flow, rules editor scroll
- [x] 9.10 Vitest unit tests for components; Playwright E2E against the Firebase emulator suite

## 10. CI and release pipeline (`.github/workflows/`)

- [x] 10.1 `ci.yml`: on every PR, runs (in parallel) — `pnpm test` (shared packages + dashboard + functions), `pytest` (shared rules-engine python + windows-agent), `./gradlew test` (android-agent + shared rules-engine kotlin), `firebase emulators:exec` integration test
- [x] 10.2 `parity.yml` (or job inside ci.yml): runs all three rules-engine ports against `fixtures/cases.json` and asserts identical outputs; fails the build on any divergence
- [x] 10.3 `build-windows.yml` (windows-latest runner): builds Windows agent + Inno Setup installer; uploads artifact
- [x] 10.4 `build-android.yml` (ubuntu-latest runner): installs JDK 17 + Android command-line tools via `sdkmanager`; runs `./gradlew assembleRelease` signed with a CI keystore from secrets; uploads artifact
- [x] 10.5 `release.yml` (tag push `v*`): consumes both build artifacts, computes SHA-256, publishes a GitHub Release with assets and a body containing `sha256: <hex>` lines per asset
- [x] 10.6 `deploy-firebase.yml` (manual dispatch, requires a configured Firebase token secret): `firebase deploy --only firestore,functions,hosting`

## 11. Documentation

- [x] 11.1 Root `README.md`: product overview, architecture diagram (mermaid from `design.md`), quickstart for a parent (provision Firebase, deploy dashboard, install agents, pair devices)
- [x] 11.2 `apps/windows-agent/README.md`: local-dev setup, `poetry install`, run `debug-run`, install as service, build the installer
- [x] 11.3 `apps/android-agent/README.md`: no-Android-Studio setup (JDK 17 + command-line tools + `sdkmanager`), `./gradlew assembleDebug`, install on a connected device via `adb install`
- [x] 11.4 `apps/web-dashboard/README.md`: `pnpm dev`, run against emulator, deploy to Hosting
- [x] 11.5 `firebase/README.md`: explains the data model and security rules; how to extend
- [x] 11.6 `docs/parent-guide.md`: end-user-facing guide for parents (pairing, rules editing, temp-unlocks, what to do if the child disables Accessibility, what to do if Defender flags the installer)
- [x] 11.7 `docs/troubleshooting.md`: known limitations (Firefox URL flakiness, Android force-close limitations, APK install prompt) and workarounds

## 12. Smoke tests (acceptance suite)

- [x] 12.1 Manual smoke checklist (`docs/smoke-checklist.md`) covering the user-visible Gherkin scenarios across all specs (pairing, rules sync within 5 s, warn-then-close, schedule outside window, temp-unlock applied within 5 s, tamper-attempt banner, Android Accessibility disable lockout). Each row maps to a spec scenario
- [x] 12.2 Automated end-to-end "happy path" (Playwright + Firebase emulator + fake Windows/Android device shims): create family → add child → pair → write rules → simulate focus events → assert dashboard reflects them → issue temp-unlock → assert applied
