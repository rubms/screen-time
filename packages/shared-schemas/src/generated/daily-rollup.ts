/* Auto-generated from JSON Schema — do not edit. */

export interface HttpsScreenTimeControlDevSchemasDailyRollupJson {
  localDate: string;
  childId: string;
  totalLimitedMinutes: number;
  totalAllowedMinutes?: number;
  totalBlockedAttempts?: number;
  perTarget?: {
    [k: string]: unknown;
  };
  warnings?: {
    [k: string]: unknown;
  };
  forceCloses?: {
    [k: string]: unknown;
  };
  scheduleAdherence?: {
    [k: string]: unknown;
  };
  tamperAttempts?: number;
  [k: string]: unknown;
}
