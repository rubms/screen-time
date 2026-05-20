/* Auto-generated from JSON Schema — do not edit. */

export interface HttpsScreenTimeControlDevSchemasSessionEventJson {
  eventType: string;
  at: string;
  serverAt?: unknown;
  localDate: string;
  childId: string;
  deviceId: string;
  platform: string;
  agentVersion?: string;
  app?: {
    [k: string]: unknown;
  };
  url?: {
    [k: string]: unknown;
  };
  targetId?: string;
  category?: "BLOCKED" | "LIMITED" | "ALLOWED";
  durationMs?: number;
  endedReason?: string;
  remainingMinutes?: number;
  warningKind?: string;
  closeMethod?: string;
  tamperKind?: string;
  [k: string]: unknown;
}
