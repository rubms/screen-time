import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./lib/admin";

const VALID_SCOPES = new Set(["schedule", "schedule+quotas", "add-minutes"]);
const MAX_MINUTES = 240;
const MIN_MINUTES = 1;

export interface TempUnlockDoc {
  deviceId: string;
  childId: string;
  scope: string;
  target?: string;
  additionalMinutes?: number;
  durationMinutes?: number;
  revoked?: boolean;
}

function validateUnlock(data: TempUnlockDoc): string | null {
  if (!VALID_SCOPES.has(data.scope)) {
    return `invalid scope: ${data.scope}`;
  }

  if (data.scope === "add-minutes") {
    if (!data.target) {
      return "add-minutes requires target";
    }
    const mins = data.additionalMinutes;
    if (mins == null || mins < MIN_MINUTES || mins > MAX_MINUTES) {
      return `additionalMinutes must be ${MIN_MINUTES}-${MAX_MINUTES}`;
    }
    return null;
  }

  const duration = data.durationMinutes;
  if (duration == null || duration < MIN_MINUTES || duration > MAX_MINUTES) {
    return `durationMinutes must be ${MIN_MINUTES}-${MAX_MINUTES}`;
  }
  return null;
}

async function emitInvalidUnlockAudit(
  familyId: string,
  unlock: TempUnlockDoc,
  unlockId: string,
  reason: string,
): Promise<void> {
  const firestore = db();
  const eventRef = firestore
    .collection(`families/${familyId}/devices/${unlock.deviceId}/events`)
    .doc();

  await eventRef.set({
    eventType: "tamper-attempt",
    at: new Date().toISOString(),
    serverAt: FieldValue.serverTimestamp(),
    localDate: new Date().toISOString().slice(0, 10),
    childId: unlock.childId,
    deviceId: unlock.deviceId,
    platform: "cloud-function",
    agentVersion: "functions",
    app: { id: "system", displayName: "System", platformId: "cloud-function" },
    targetId: "__system__",
    category: "BLOCKED",
    tamperKind: "invalid-temp-unlock",
    unlockId,
    reason,
  });
}

export const validateTempUnlock = onDocumentWritten(
  "families/{familyId}/temp-unlocks/{unlockId}",
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) {
      return;
    }

    const familyId = event.params.familyId;
    const unlockId = event.params.unlockId;
    const data = after.data() as TempUnlockDoc;

    if (data.revoked === true) {
      return;
    }

    const error = validateUnlock(data);
    if (!error) {
      return;
    }

    await after.ref.update({
      revoked: true,
      revokedAt: FieldValue.serverTimestamp(),
      revokedByUid: "system-validator",
    });

    await emitInvalidUnlockAudit(familyId, data, unlockId, error);
  },
);
