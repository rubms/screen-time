import { onCall } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./lib/admin";
import { unauthenticated } from "./lib/errors";

/** Firestore gRPC code for missing index (FAILED_PRECONDITION). */
const MISSING_INDEX_CODE = 9;

export interface EnsureFamilyProfileResponse {
  familyId: string;
  family: {
    ownerUid: string;
    displayName: string;
    schemaVersion: number;
  };
}

async function findFamilyViaParentMembership(
  firestore: Firestore,
  uid: string,
): Promise<{ familyId: string; family: EnsureFamilyProfileResponse["family"] } | null> {
  try {
    const membership = await firestore
      .collectionGroup("parents")
      .where("uid", "==", uid)
      .limit(1)
      .get();

    if (membership.empty) {
      return null;
    }

    const parentDoc = membership.docs[0]!;
    const familyRef = parentDoc.ref.parent?.parent;
    if (!familyRef) {
      return null;
    }

    const familySnap = await familyRef.get();
    if (!familySnap.exists) {
      return null;
    }

    const data = familySnap.data()!;
    return {
      familyId: familyRef.id,
      family: {
        ownerUid: data.ownerUid as string,
        displayName: (data.displayName as string) ?? "My Family",
        schemaVersion: (data.schemaVersion as number) ?? 1,
      },
    };
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === MISSING_INDEX_CODE) {
      return null;
    }
    throw err;
  }
}

async function ensureParentDoc(familyId: string, uid: string): Promise<void> {
  const parentRef = db().doc(`families/${familyId}/parents/${uid}`);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) {
    await parentRef.set({
      uid,
      role: "owner",
      addedAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Finds or creates the caller's family using Admin SDK (bypasses client rules timing).
 */
export const ensureFamilyProfile = onCall(
  { enforceAppCheck: false },
  async (request): Promise<EnsureFamilyProfileResponse> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw unauthenticated();
    }

    const firestore = db();

    const owned = await firestore
      .collection("families")
      .where("ownerUid", "==", uid)
      .limit(1)
      .get();

    if (!owned.empty) {
      const familyDoc = owned.docs[0]!;
      await ensureParentDoc(familyDoc.id, uid);
      const data = familyDoc.data();
      return {
        familyId: familyDoc.id,
        family: {
          ownerUid: data.ownerUid as string,
          displayName: (data.displayName as string) ?? "My Family",
          schemaVersion: (data.schemaVersion as number) ?? 1,
        },
      };
    }

    const viaMembership = await findFamilyViaParentMembership(firestore, uid);
    if (viaMembership) {
      return viaMembership;
    }

    const familyId = crypto.randomUUID();
    const family = {
      ownerUid: uid,
      displayName: "My Family",
      schemaVersion: 1,
    };

    await firestore.doc(`families/${familyId}`).set({
      ...family,
      createdAt: FieldValue.serverTimestamp(),
    });
    await firestore.doc(`families/${familyId}/parents/${uid}`).set({
      uid,
      role: "owner",
      addedAt: FieldValue.serverTimestamp(),
    });

    return { familyId, family };
  },
);
