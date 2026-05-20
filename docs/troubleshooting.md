# Troubleshooting

## Dashboard

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| Blank page after sign-in | Firestore rules or missing family | Confirm Auth and Firestore are enabled; check browser console |
| Rules don’t save | Validation error on URL pattern | Fix the pattern (no `http://`); use the test field |
| Usage empty | No events yet or rollup pending | Wait for agent to sync; check device **last seen** |
| Pairing code expired | 10-minute window passed | Generate a new code |

## Windows agent

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| URLs show as “unknown” | UI Automation couldn’t read address bar | Common on Firefox; site still limited by browser app category |
| All browser tabs close | Ctrl+W failed, fallback terminated process | Expected fallback; child should use one browser window |
| Agent stops after reboot | Service not running | Reinstall as service; check Windows Services |
| Defender blocked install | Unsigned binary | See parent guide; verify SHA-256 from release |

## Android agent

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| Can’t install APK | Unknown sources / Play Protect | Allow install from this source; verify release checksum |
| Force-close only sends Home | OS limitation without device owner | Lockout overlay is the intended behavior |
| Accessibility keeps disabling | Child toggled in Settings | Re-enable; watch tamper events on dashboard |
| Battery optimization kills agent | OEM power saving | Exempt app from battery restrictions |

## Sync and clocks

- Agents queue events offline and upload in batches.
- If the device clock jumps backward, agents ignore the jump for quota math.
- Daily totals roll over at **local midnight** in the child’s timezone.

## Getting help

Use **Settings → Download diagnostics** and share the JSON (redact if needed) when filing an issue.
