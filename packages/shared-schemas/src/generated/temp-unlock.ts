/* Auto-generated from JSON Schema — do not edit. */

export interface HttpsScreenTimeControlDevSchemasTempUnlockJson {
  deviceId: string;
  childId: string;
  scope: "schedule" | "schedule+quotas" | "add-minutes";
  target?: string;
  additionalMinutes?: number;
  durationMinutes?: number;
  issuedAt: unknown;
  expiresAt: unknown;
  issuedByUid?: string;
  reason?: string;
  revoked: boolean;
  [k: string]: unknown;
}
