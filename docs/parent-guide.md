# Parent guide

Screen Time Control helps you set schedules, daily budgets, and per-app or per-website limits on your child’s Windows PC and Android phone. You manage everything from the web dashboard; child devices run a small agent that enforces rules locally and syncs usage to your family’s Firebase project.

## Getting started

1. **Create a Firebase project** (one per family) and enable Google sign-in, Firestore, Cloud Functions, and Hosting.
2. **Deploy** the Firebase backend and dashboard (see the root [README](../README.md)).
3. **Sign in** to the dashboard with Google. Your family is created on first sign-in.
4. **Add a child** profile, then **Add device** to get a 6-character pairing code.
5. **Install** the Windows or Android agent on the child device and enter the code within 10 minutes.

## Pairing a device

1. Open the dashboard and tap **Add device** on the child’s card.
2. Copy the 6-character code (valid for 10 minutes).
3. On the child device, open the agent setup screen and enter the code.
4. When pairing succeeds, the modal closes and the device appears in the list.

## Editing rules

Open **Rules** on a child card to:

- Add **apps** (executable or package name) or **URL patterns** (e.g. `youtube.com`).
- Set each target to **Blocked**, **Limited**, or **Allowed**.
- Set **daily budgets** and **allowed hours** per weekday.
- Adjust default **warning** and **grace** times.

Click **Save rules**. Devices should pick up changes within a few seconds.

## Viewing usage

Tap a child’s name to see:

- **Today’s timeline** — time per app/site.
- **Weekly chart** — minutes vs. budget for the last 7 days.
- **Per-target table** — sorted by today’s usage.
- **Event log** — warnings, force-closes, tamper alerts.

## Temporary unlocks

On a device row, tap **Temp unlock** to allow extra time:

- **Schedule only** — ignore “outside allowed hours” for now.
- **Schedule + quotas** — also ignore daily limits.
- **Add minutes** — extra time for total budget or a specific target.

Optional **reason** text is stored for your records. Use **Revoke** to end an unlock early.

## Settings

- **Family name** — shown in the header.
- **Parent PIN** — 4–8 digits; required on child devices to open agent settings.
- **Invite parent** — add another Google account with full access.
- **Download diagnostics** — JSON export of rules and recent events for support.

## If the child disables Accessibility (Android)

The agent needs Accessibility to see which app is open. If the child turns it off, a **lockout screen** appears until a parent re-enables it from device settings or issues a temp unlock after fixing it. Check the dashboard **tamper banner** for recent alerts.

## If Windows Defender flags the installer

The Windows agent is not code-signed in open-source builds. You may need to choose **More info → Run anyway** or add an exclusion for the install folder. Download releases only from your project’s GitHub Releases and verify the `sha256:` line in the release notes.
