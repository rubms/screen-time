# Smoke test checklist

Manual acceptance checks mapped to OpenSpec scenarios. Run after a full deploy to a test Firebase project with at least one Windows or Android device paired.

| # | Area | Steps | Expected | Spec reference |
|---|------|--------|----------|----------------|
| 1 | Auth | Open dashboard logged out | Sign-in page only; no Firestore reads | parent-dashboard: Anonymous visit |
| 2 | Auth | Sign in with Google | Family loads; children list | parent-dashboard: Sign-in completes |
| 3 | Family | Create child “Alex” | Child card appears | family-account: Parent creates a child |
| 4 | Pairing | Add device → copy code | 6-char code, countdown ~10:00 | family-account: Generate pairing code |
| 5 | Pairing | Redeem on agent | Modal closes; device listed | family-account: Child redeems code |
| 6 | Rules | Edit URL quota; save | Toast “Devices syncing…” | parent-dashboard: Edit URL target |
| 7 | Rules | Enter invalid URL pattern | Inline error; save disabled | parent-dashboard: Invalid URL pattern |
| 8 | Rules sync | Change rule on dashboard | Agent applies within **5 s** | rules-configuration / rules-engine |
| 9 | Usage | Open child detail | Timeline/chart within **2 s** | parent-dashboard: Today’s timeline |
| 10 | Enforcement | Focus LIMITED app over quota | Warning then grace modal | rules-engine: warn-then-close |
| 11 | Schedule | Focus outside window | Lockout / block | rules-engine: schedule scenarios |
| 12 | Temp unlock | 15 min schedule-only | Badge countdown; lockout clears **≤5 s** | temp-unlock: 15-min schedule bypass |
| 13 | Temp unlock | Revoke active unlock | Normal rules within **5 s** | temp-unlock: Revocation |
| 14 | Tamper | Simulate tamper event | Banner on home (24h) | parent-dashboard / device-tamper-protection |
| 15 | Android | Disable Accessibility | Lockout until fixed | android-agent / tamper specs |
| 16 | Settings | Set 6-digit PIN | Saved to private/secrets | parent-dashboard: Set parent PIN |
| 17 | Mobile | 375px width: child → temp unlock | Form usable; no horizontal scroll | parent-dashboard: Mobile temp-unlock |

**Automated happy path (when emulator suite exists):** Playwright + Firebase emulators — create family → child → pair → rules → simulated events → dashboard reflects → temp-unlock applied (tasks.md §12.2).
