/* Auto-generated from JSON Schema — do not edit. */

export interface HttpsScreenTimeControlDevSchemasDeviceJson {
  childId: string;
  platform: "windows" | "android";
  displayName: string;
  pairedAt: unknown;
  pairedByUid?: string;
  installedVersion?: string;
  updateChannel?: "stable" | "beta";
  lastSeenAt?: unknown;
  lastEventAt?: unknown;
  revoked: boolean;
  hardware?: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
