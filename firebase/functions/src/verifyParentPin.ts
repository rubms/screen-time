import { createHash } from "node:crypto";
import { onCall } from "firebase-functions/v2/https";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import {
  invalidArgument,
  permissionDenied,
  resourceExhausted,
  unauthenticated,
} from "./lib/errors";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

async function resolveFamilyIdForParent(uid: string): Promise<string> {
  const families = await db().collection("families").get();
  for (const fam of families.docs) {
    const parent = await fam.ref.collection("parents").doc(uid).get();
    if (parent.exists) {
      return fam.id;
    }
  }
  throw permissionDenied("Caller is not a parent in any family");
}

export interface VerifyParentPinRequest {
  pin: string;
}

export interface VerifyParentPinResponse {
  valid: boolean;
}

function clientKey(rawIp: string | undefined, uid: string): string {
  const ip = rawIp ?? "unknown";
  const hash = createHash("sha256").update(`${ip}:${uid}`).digest("hex").slice(0, 32);
  return hash;
}

async function checkRateLimit(familyId: string, key: string): Promise<void> {
  const ref = db().doc(`families/${familyId}/private/rateLimits_${key}`);
  const snap = await ref.get();
  const now = Date.now();

  if (!snap.exists) {
    await ref.set({ attempts: 1, windowStart: now });
    return;
  }

  const data = snap.data()!;
  const windowStart = (data.windowStart as number) ?? 0;
  let attempts = (data.attempts as number) ?? 0;

  if (now - windowStart > WINDOW_MS) {
    await ref.set({ attempts: 1, windowStart: now });
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    throw resourceExhausted("Too many PIN attempts. Try again in a few minutes.");
  }

  await ref.set({ attempts: attempts + 1, windowStart });
}

async function resetRateLimit(familyId: string, key: string): Promise<void> {
  await db().doc(`families/${familyId}/private/rateLimits_${key}`).delete();
}

export const verifyParentPin = onCall(
  { enforceAppCheck: false },
  async (request): Promise<VerifyParentPinResponse> => {
    if (!request.auth?.uid) {
      throw unauthenticated();
    }

    const pin = (request.data as VerifyParentPinRequest)?.pin;
    if (!pin || typeof pin !== "string" || pin.length < 4 || pin.length > 32) {
      throw invalidArgument("pin must be 4-32 characters");
    }

    const uid = request.auth.uid;
    const firestore = db();
    const familyId = await resolveFamilyIdForParent(uid);
    const rateKey = clientKey(request.rawRequest?.ip, uid);

    await checkRateLimit(familyId, rateKey);

    const secretsSnap = await firestore.doc(`families/${familyId}/private/secrets`).get();
    const hash = secretsSnap.data()?.parentPinHash as string | undefined;

    if (!hash) {
      throw permissionDenied("Parent PIN is not configured");
    }

    const valid = await bcrypt.compare(pin, hash);
    if (valid) {
      await resetRateLimit(familyId, rateKey);
      await firestore.doc(`families/${familyId}/private/secrets`).set(
        { parentPinVerifiedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }

    return { valid };
  },
);
