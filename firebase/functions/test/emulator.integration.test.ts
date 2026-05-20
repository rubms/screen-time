/**
 * Integration test against the Firebase emulator suite.
 *
 * Run: firebase emulators:exec --project demo-screen-time \
 *   "cd firebase/functions && pnpm test test/emulator.integration.test.ts"
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeApp, deleteApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { aggregateEvents, type SessionEvent } from "../src/lib/rollup";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-screen-time";
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

/** Set SKIP_EMULATOR_TESTS=1 to skip when emulators are not running. */
const skipUnlessEmulator = process.env.SKIP_EMULATOR_TESTS === "1";

describe.skipIf(skipUnlessEmulator)("emulator integration", () => {
  let app: App;
  const familyId = "integration-fam";
  const childId = "integration-child";
  const deviceId = "integration-device";
  const parentUid = "integration-parent";

  beforeAll(async () => {
    process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR;
    process.env.GCLOUD_PROJECT = PROJECT_ID;

    app = initializeApp({ projectId: PROJECT_ID });
    const db = getFirestore(app);

    await db.doc(`families/${familyId}`).set({
      ownerUid: parentUid,
      displayName: "Integration Family",
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    await db.doc(`families/${familyId}/parents/${parentUid}`).set({
      uid: parentUid,
      email: "parent@test.com",
      displayName: "Parent",
      role: "owner",
      addedAt: FieldValue.serverTimestamp(),
    });
    await db.doc(`families/${familyId}/children/${childId}`).set({
      displayName: "Kid",
      avatarColor: "#00ff00",
      timezone: "UTC",
      archived: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.doc(`families/${familyId}/devices/${deviceId}`).set({
      childId,
      platform: "windows",
      displayName: "Test PC",
      pairedAt: FieldValue.serverTimestamp(),
      revoked: false,
      updateChannel: "stable",
      installedVersion: "0.0.0",
    });

    const code = "TEST01";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.doc(`families/${familyId}/pairingCodes/${code}`).set({
      childId,
      expiresAt,
      redeemed: false,
      createdByUid: parentUid,
    });

    const token = await getAuth(app).createCustomToken(deviceId, {
      familyId,
      childId,
      deviceId,
      role: "device",
    });
    expect(token).toBeTruthy();

    await db.doc(`families/${familyId}/pairingCodes/${code}`).update({
      redeemed: true,
      redeemedDeviceId: deviceId,
    });
  });

  afterAll(async () => {
    if (app) {
      await deleteApp(app);
    }
  });

  it("writes events and produces dashboard-shaped rollup data", async () => {
    const db = getFirestore(app);
    const localDate = "2026-05-18";

    const events: SessionEvent[] = [
      {
        eventType: "focus-end",
        at: `${localDate}T12:00:00.000Z`,
        localDate,
        childId,
        deviceId,
        targetId: "chrome",
        category: "LIMITED",
        durationMs: 300_000,
      },
      {
        eventType: "focus-end",
        at: `${localDate}T13:00:00.000Z`,
        localDate,
        childId,
        deviceId,
        targetId: "chrome",
        category: "LIMITED",
        durationMs: 180_000,
      },
    ];

    for (const ev of events) {
      await db.collection(`families/${familyId}/devices/${deviceId}/events`).add({
        ...ev,
        serverAt: FieldValue.serverTimestamp(),
        platform: "windows",
        agentVersion: "test",
        app: { id: "chrome", displayName: "Chrome", platformId: "chrome.exe" },
      });
    }

    const written = await db
      .collection(`families/${familyId}/devices/${deviceId}/events`)
      .where("localDate", "==", localDate)
      .get();

    expect(written.size).toBeGreaterThanOrEqual(2);

    const rollup = aggregateEvents(events, localDate, childId);
    await db.doc(`families/${familyId}/children/${childId}/dailyRollups/${localDate}`).set({
      ...rollup,
      rolledUpAt: FieldValue.serverTimestamp(),
    });

    const rollupSnap = await db
      .doc(`families/${familyId}/children/${childId}/dailyRollups/${localDate}`)
      .get();

    expect(rollupSnap.exists).toBe(true);
    expect(rollupSnap.data()?.totalLimitedMinutes).toBeCloseTo(8);
    expect(rollupSnap.data()?.perTarget?.chrome?.sessions).toBe(2);

    const parentView = await db
      .collection(`families/${familyId}/children/${childId}/dailyRollups`)
      .where("localDate", "==", localDate)
      .get();

    expect(parentView.empty).toBe(false);
  });
});
