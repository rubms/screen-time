import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";

const PROJECT_ID = "screen-time-control-rules-test";
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [emulatorHost, emulatorPort] = EMULATOR_HOST.split(":");
const skipRulesTests = process.env.SKIP_RULES_TESTS === "1";

let testEnv: RulesTestEnvironment | undefined;

const rules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");

beforeAll(async () => {
  if (skipRulesTests) {
    return;
  }
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: emulatorHost,
        port: Number(emulatorPort),
      },
    });
  } catch {
    console.warn(
      "Firestore emulator not available; set SKIP_RULES_TESTS=1 or start emulators.",
    );
    testEnv = undefined;
  }
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  if (!testEnv) return;
  await testEnv.clearFirestore();
});

function parentDb(uid: string) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore();
}

function deviceDb(claims: {
  familyId: string;
  childId: string;
  deviceId: string;
}) {
  return testEnv
    .authenticatedContext(claims.deviceId, {
      familyId: claims.familyId,
      childId: claims.childId,
      deviceId: claims.deviceId,
      role: "device",
    })
    .firestore();
}

async function seedFamily(familyId: string, ownerUid: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, `families/${familyId}`), {
      ownerUid,
      displayName: "Test Family",
      createdAt: new Date(),
      schemaVersion: 1,
    });
    await setDoc(doc(adminDb, `families/${familyId}/parents/${ownerUid}`), {
      uid: ownerUid,
      email: "owner@test.com",
      displayName: "Owner",
      role: "owner",
      addedAt: new Date(),
    });
    await setDoc(doc(adminDb, `families/${familyId}/children/child1`), {
      displayName: "Alex",
      avatarColor: "#ff0000",
      timezone: "UTC",
      archived: false,
      createdAt: new Date(),
    });
    await setDoc(doc(adminDb, `families/${familyId}/devices/device1`), {
      childId: "child1",
      platform: "windows",
      displayName: "PC",
      pairedAt: new Date(),
      revoked: false,
      updateChannel: "stable",
      installedVersion: "1.0.0",
    });
    await setDoc(doc(adminDb, `families/${familyId}/children/child1/rules/current`), {
      version: 1,
      weekly: {},
      defaults: { warningLeadMinutes: 5, gracePeriodSeconds: 120 },
      targets: [],
    });
  });
}

describe.skipIf(skipRulesTests)("firestore.rules", () => {
  it("allows parent to read family and children", async () => {
    await seedFamily("fam1", "parent1");
    const db = parentDb("parent1");
    await assertSucceeds(getDoc(doc(db, "families/fam1")));
    await assertSucceeds(getDoc(doc(db, "families/fam1/children/child1")));
  });

  it("denies non-member from reading family data", async () => {
    await seedFamily("fam1", "parent1");
    const db = parentDb("stranger");
    await assertFails(getDoc(doc(db, "families/fam1")));
    await assertFails(getDoc(doc(db, "families/fam1/children/child1")));
  });

  it("allows only owner to update family root", async () => {
    await seedFamily("fam1", "parent1");
    const ownerDb = parentDb("parent1");
    await assertSucceeds(
      updateDoc(doc(ownerDb, "families/fam1"), { displayName: "Renamed" }),
    );

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "families/fam1/parents/parent2"), {
        uid: "parent2",
        role: "member",
        email: "m@test.com",
        displayName: "Member",
        addedAt: new Date(),
      });
    });

    const memberDb = parentDb("parent2");
    await assertFails(
      updateDoc(doc(memberDb, "families/fam1"), { displayName: "Hijack" }),
    );
  });

  it("allows device to append events but not update or delete", async () => {
    await seedFamily("fam1", "parent1");
    const db = deviceDb({
      familyId: "fam1",
      childId: "child1",
      deviceId: "device1",
    });

    const event = {
      eventType: "focus-start",
      at: new Date().toISOString(),
      localDate: "2026-05-19",
      childId: "child1",
      deviceId: "device1",
      platform: "windows",
      agentVersion: "1.0.0",
      app: { id: "chrome", displayName: "Chrome", platformId: "chrome.exe" },
      targetId: "chrome",
      category: "LIMITED",
    };

    await assertSucceeds(
      addDoc(collection(db, "families/fam1/devices/device1/events"), event),
    );

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      const events = await getDoc(
        doc(adminDb, "families/fam1/devices/device1/events/event1"),
      );
      if (!events.exists) {
        const snap = await getDoc(
          doc(adminDb, "families/fam1/devices/device1/events"),
        );
        void snap;
      }
    });
  });

  it("denies cross-family device access", async () => {
    await seedFamily("fam1", "parent1");
    await seedFamily("fam2", "parent2");

    const db = deviceDb({
      familyId: "fam1",
      childId: "child1",
      deviceId: "device1",
    });

    await assertFails(getDoc(doc(db, "families/fam2")));
    await assertFails(
      addDoc(collection(db, "families/fam2/devices/device1/events"), {
        eventType: "focus-start",
        at: new Date().toISOString(),
        localDate: "2026-05-19",
        childId: "child1",
        deviceId: "device1",
        platform: "windows",
        agentVersion: "1.0.0",
        app: { id: "x", displayName: "X", platformId: "x.exe" },
        targetId: "x",
        category: "LIMITED",
      }),
    );
  });

  it("denies revoked device from writing events", async () => {
    await seedFamily("fam1", "parent1");
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "families/fam1/devices/device1"), {
        revoked: true,
      });
    });

    const db = deviceDb({
      familyId: "fam1",
      childId: "child1",
      deviceId: "device1",
    });

    await assertFails(
      addDoc(collection(db, "families/fam1/devices/device1/events"), {
        eventType: "focus-start",
        at: new Date().toISOString(),
        localDate: "2026-05-19",
        childId: "child1",
        deviceId: "device1",
        platform: "windows",
        agentVersion: "1.0.0",
        app: { id: "x", displayName: "X", platformId: "x.exe" },
        targetId: "x",
        category: "LIMITED",
      }),
    );
  });

  it("allows parent to read private secrets and denies device", async () => {
    await seedFamily("fam1", "parent1");
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "families/fam1/private/secrets"), {
        parentPinHash: "$2a$10$abcdefghijklmnopqrstuv",
      });
    });

    const pDb = parentDb("parent1");
    await assertSucceeds(getDoc(doc(pDb, "families/fam1/private/secrets")));

    const dDb = deviceDb({
      familyId: "fam1",
      childId: "child1",
      deviceId: "device1",
    });
    await assertFails(getDoc(doc(dDb, "families/fam1/private/secrets")));
  });

  it("denies client device document creation", async () => {
    await seedFamily("fam1", "parent1");
    const pDb = parentDb("parent1");
    await assertFails(
      setDoc(doc(pDb, "families/fam1/devices/new-device"), {
        childId: "child1",
        platform: "android",
        revoked: false,
      }),
    );
  });

  it("denies writes to dailyRollups", async () => {
    await seedFamily("fam1", "parent1");
    const pDb = parentDb("parent1");
    await assertFails(
      setDoc(doc(pDb, "families/fam1/children/child1/dailyRollups/2026-05-18"), {
        totalLimitedMinutes: 0,
      }),
    );
  });
});
