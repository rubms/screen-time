import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "./lib/admin";
import {
  invalidArgument,
  notFound,
  pairingConflict,
  pairingExpired,
} from "./lib/errors";

export interface RedeemPairingCodeRequest {
  familyId: string;
  code: string;
  deviceId: string;
  platform: "windows" | "android";
  displayName?: string;
  installedVersion?: string;
  hardware?: { model?: string; os_version?: string; hostname?: string };
}

export interface RedeemPairingCodeResponse {
  customToken: string;
  familyId: string;
  childId: string;
  deviceId: string;
}

export const redeemPairingCode = onCall(
  { enforceAppCheck: false },
  async (request): Promise<RedeemPairingCodeResponse> => {
    const data = request.data as Partial<RedeemPairingCodeRequest>;
    const familyId = data.familyId?.trim();
    const code = data.code?.trim().toUpperCase();
    const deviceId = data.deviceId?.trim();
    const platform = data.platform;

    if (!familyId || !code || !deviceId || !platform) {
      throw invalidArgument("familyId, code, deviceId, and platform are required");
    }
    if (platform !== "windows" && platform !== "android") {
      throw invalidArgument('platform must be "windows" or "android"');
    }

    const firestore = db();
    const codeRef = firestore.doc(`families/${familyId}/pairingCodes/${code}`);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      throw notFound("Pairing code not found");
    }

    const pairing = codeSnap.data()!;
    const expiresAt = pairing.expiresAt?.toDate?.() ?? new Date(0);

    if (pairing.redeemed === true) {
      throw pairingConflict();
    }
    if (expiresAt.getTime() < Date.now()) {
      throw pairingExpired();
    }

    const childId = pairing.childId as string;
    const deviceRef = firestore.doc(`families/${familyId}/devices/${deviceId}`);
    const now = FieldValue.serverTimestamp();

    await firestore.runTransaction(async (tx) => {
      const fresh = await tx.get(codeRef);
      if (!fresh.exists) {
        throw notFound("Pairing code not found");
      }
      const p = fresh.data()!;
      if (p.redeemed === true) {
        throw pairingConflict();
      }
      if ((p.expiresAt?.toDate?.() ?? new Date(0)).getTime() < Date.now()) {
        throw pairingExpired();
      }

      tx.set(deviceRef, {
        childId,
        platform,
        displayName: data.displayName ?? `${platform} device`,
        pairedAt: now,
        pairedByUid: p.createdByUid ?? null,
        installedVersion: data.installedVersion ?? "0.0.0",
        updateChannel: "stable",
        lastSeenAt: now,
        lastEventAt: null,
        revoked: false,
        hardware: data.hardware ?? null,
      });

      tx.update(codeRef, {
        redeemed: true,
        redeemedAt: now,
        redeemedDeviceId: deviceId,
      });
    });

    let customToken: string;
    try {
      customToken = await auth().createCustomToken(deviceId, {
        familyId,
        childId,
        deviceId,
        role: "device",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("signBlob") || msg.includes("insufficient-permission")) {
        throw new HttpsError(
          "failed-precondition",
          "Cloud Functions cannot mint device tokens yet. Run firebase/scripts/grant-custom-token-signer.sh for this project (Service Account Token Creator on the functions runtime account).",
        );
      }
      throw err;
    }

    return { customToken, familyId, childId, deviceId };
  },
);
