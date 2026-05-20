## Why

Parents need a single, reliable system to budget and enforce screen time across
their children's Windows PCs and Android devices, with per-app and per-website
control, daily quotas, a global daily schedule, and a unified parent dashboard.
Off-the-shelf solutions are either platform-locked, expensive, easy to bypass,
or do not offer per-URL accounting inside browsers. This change introduces a
self-hosted (parent-owned Firebase project), open-source system covering all
three sides: a Windows agent, an Android agent, and a parent web dashboard.

## What Changes

- **NEW** Windows agent (Python 3.12 + pywin32 + UI Automation, packaged with
  PyInstaller, installed as a tamper-resistant Windows Service) that:
  - Detects the foreground window and the foreground browser tab URL (Chrome,
    Edge, Firefox) via UI Automation.
  - Classifies the current activity as BLOCKED / LIMITED / ALLOWED based on
    per-child rules synced from Firestore.
  - Counts focus time toward a daily total and per-target quotas (no idle
    detection — focus time counts regardless of input activity).
  - Shows a toast warning before a limit is reached, then a topmost modal
    countdown dialog, then force-closes the offending app/tab when the grace
    period ends.
  - Enforces a global daily schedule (e.g., 09:00–20:00); outside that window
    only ALLOWED items are usable.
  - Operates fully offline against a local cache of rules; queues session
    events and syncs them to Firestore when connectivity returns.
- **NEW** Android agent (Kotlin, built via Gradle CLI without Android Studio)
  that:
  - Uses an AccessibilityService to detect the foreground app package and the
    active browser tab URL (Chrome, Edge, Firefox).
  - Runs a foreground Service for continuous tracking and a DeviceAdminReceiver
    for tamper resistance (cannot be uninstalled or have Accessibility disabled
    without the parent PIN).
  - Same classification, quotas, schedule, warning/close behavior, and offline
    semantics as the Windows agent (shared rules-engine logic).
  - "Closes" an app by sending an intent to the launcher (Home) and overlaying
    a full-screen lock until the user navigates away or grace expires.
- **NEW** Parent web dashboard (React + Vite + TypeScript + Tailwind, deployed
  to Firebase Hosting) that:
  - Authenticates parents via Google sign-in (Firebase Auth).
  - Manages families, children (profiles), and the devices bound to each child.
  - Configures rules: category assignments for apps and URL patterns; per-day-
    of-week global schedule and total daily screen-time budget; per-target
    daily quotas; warning/grace timings.
  - Generates one-time pairing codes for binding new child devices.
  - Visualizes per-day, per-week usage: total screen time, per-app and per-URL
    breakdowns, schedule adherence, warning/close events, tamper attempts.
  - Issues temp-unlocks with configurable scope (bypass schedule only / bypass
    schedule + per-target quotas / add N extra minutes to a category or
    target) and duration.
- **NEW** Firebase backend: Firestore schema, security rules, indexes, and
  TypeScript Cloud Functions for pairing-code issuance, device custom-token
  minting, daily aggregation rollups, and temp-unlock validation.
- **NEW** Shared rules-engine package (TypeScript reference + parity-tested
  ports to Python and Kotlin) so all three runtimes evaluate the same rules
  the same way, validated against a shared fixture set.
- **NEW** Auto-update for child agents via GitHub Releases (Windows: in-place
  binary replace on service restart; Android: APK side-load prompt).
- **NEW** GitHub Actions CI building Windows .exe (windows-latest runner) and
  Android signed .apk (ubuntu-latest with command-line Android SDK, no
  Studio), publishing to GitHub Releases.

## Capabilities

### New Capabilities

- `family-account`: Family creation, parent Google authentication, child
  profile management, device pairing via one-time codes, and the Firestore
  data model that scopes everything to a family.
- `rules-configuration`: The data model and editing UX for categories
  (BLOCKED / LIMITED / ALLOWED), app-targets and URL-pattern-targets, the
  global daily schedule, the total daily screen-time budget, and per-target
  daily quotas — all per child profile and per day of week.
- `rules-engine`: The pure, deterministic logic that, given the current
  activity (app + optional URL), the rules, today's usage so far, and the
  current local time, returns the enforcement decision (allowed / warning /
  blocked / forced-close) and remaining time. Single source of truth shared
  across the three agents (TS reference + Python + Kotlin ports + parity
  tests).
- `windows-agent`: The Windows-side runtime — foreground/window/browser-URL
  detection, focus-time accounting, warning UI, force-close enforcement,
  tamper-resistant Windows Service, local cache, and Firestore sync.
- `android-agent`: The Android-side runtime — AccessibilityService for
  foreground app + browser URL, foreground Service for continuous tracking,
  DeviceAdminReceiver for tamper resistance, warning UI, force-close
  enforcement (launcher + lock overlay), local cache, and Firestore sync.
- `parent-dashboard`: The web dashboard — authentication, family/child/device
  management, rules editor, pairing-code generation, usage visualizations,
  and temp-unlock issuance.
- `usage-telemetry`: The session-event audit log: per-focus start/end events,
  warnings shown, force-closes performed, tamper attempts, sync errors;
  stored in Firestore, with Cloud Function daily rollups for fast dashboard
  reads.
- `temp-unlock`: The temporary-unlock workflow — parent issues a scoped,
  time-bounded bypass from the dashboard; child agent applies it within
  seconds (via Firestore real-time listener); revocation; audit trail.
- `auto-update`: GitHub-Releases-based version checking, download,
  verification, and installation for both child agents.
- `device-tamper-protection`: The platform-specific strategy and code paths
  that prevent the child from disabling or uninstalling the agent (Windows
  Service hardening + watchdog; Android DeviceAdminReceiver + Accessibility
  re-prompt + uninstall protection).

### Modified Capabilities

None — this is a greenfield initiative; there are no existing specs in
`openspec/specs/` to modify.

## Impact

- **New repositories / packages**: Establishes the monorepo layout
  (`apps/windows-agent`, `apps/android-agent`, `apps/web-dashboard`,
  `packages/shared-schemas`, `packages/shared-rules-engine`, `firebase/`).
- **New external dependencies**:
  - Python: `pywin32`, `comtypes`, `psutil`, `pydantic`, `firebase-admin`,
    `pystray`, `pyinstaller`, `pytest`, `nssm` (bundled for service install).
  - Kotlin/Android: Firebase Android BoM (Auth, Firestore, FCM), AndroidX
    (Core, WorkManager, AppCompat), `kotlinx-coroutines`, JUnit5, Espresso;
    `commandlinetools-linux-*` in CI.
  - Web: React 18, Vite, TypeScript, Tailwind, shadcn/ui, Firebase Web SDK,
    recharts, Vitest, Playwright.
- **Firebase project provisioning**: Each family runs against its own
  Firebase project (Auth, Firestore, Hosting, Functions, Storage). The
  repository ships `firebase.json`, `firestore.rules`, `firestore.indexes
  .json`, and a setup script.
- **GitHub Actions**: Two new workflows (Windows build, Android build) plus a
  release workflow that publishes signed artifacts.
- **Privacy/security**: All data lives in the parent's own Firebase project;
  Firestore security rules strictly scope reads/writes by family and role
  (parent vs. device). Child devices use short-lived custom tokens minted by a
  Cloud Function after pairing-code redemption.
- **Platform risks** (must be designed around, see `design.md`):
  - Browser URL reading via Windows UI Automation is sensitive to browser
    updates (especially Firefox); we need per-browser strategies + a fallback
    to "browser app, URL unknown" so accounting still works.
  - Android AccessibilityService can be disabled by the user from system
    Settings; we detect re-disable and immediately lock the device + notify
    via FCM-driven dashboard refresh until re-enabled.
  - Android DeviceAdmin uninstall protection requires user consent during
    pairing; without it, tamper resistance degrades to "Medium".
  - PyInstaller-packaged Python binaries may trigger Windows Defender
    heuristics; ship a code-signed build (parent-supplied cert) or document
    the SmartScreen workaround.
  - Killing a tab inside a browser is best-effort: we close the tab via UI
    Automation if possible; otherwise we close the whole browser window
    (documented limitation).

## Non-goals

- **iOS / macOS / Linux child agents** — out of scope.
- **VPN- or router-level URL blocking** — only application-level enforcement
  on the device itself.
- **HTTPS traffic inspection / DPI** — URLs are read from the browser UI, not
  from network traffic.
- **Multi-tenant SaaS** — each family owns its Firebase project; no shared
  backend service.
- **Per-keystroke or content-based filtering** — only app identity and URL
  hostname/path patterns are evaluated.
- **Parental control of system-level Android features** (Wi-Fi, Bluetooth,
  airplane mode) beyond what's necessary to enforce app/URL rules.
- **A mobile parent app** — the dashboard is web-only (responsive, usable
  from a phone browser).
- **Localization** — English UI only in this initial change.
