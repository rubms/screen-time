/* Auto-generated from JSON Schema — do not edit. */

export type HttpsScreenTimeControlDevSchemasRulesTargetJson = AppTarget | UrlTarget;

export interface AppTarget {
  kind: "app";
  id: string;
  displayName: string;
  platform: "windows" | "android" | "any";
  matchers: {
    platform: "windows" | "android" | "any";
    matcher: string;
    windowTitlePattern?: string;
    [k: string]: unknown;
  }[];
  category: "BLOCKED" | "LIMITED" | "ALLOWED";
  dailyQuotaMinutes?: DailyQuotaMinutes;
  warningLeadMinutes?: number;
  gracePeriodSeconds?: number;
  [k: string]: unknown;
}
export interface DailyQuotaMinutes {
  default?: number;
  mon?: number;
  tue?: number;
  wed?: number;
  thu?: number;
  fri?: number;
  sat?: number;
  sun?: number;
}
export interface UrlTarget {
  kind: "url";
  id: string;
  displayName: string;
  pattern: string;
  category: "BLOCKED" | "LIMITED" | "ALLOWED";
  dailyQuotaMinutes?: DailyQuotaMinutes;
  warningLeadMinutes?: number;
  gracePeriodSeconds?: number;
  [k: string]: unknown;
}
