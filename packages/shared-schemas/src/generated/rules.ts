/* Auto-generated from JSON Schema — do not edit. */

export type HttpsScreenTimeControlDevSchemasRulesTargetJson = AppTarget | UrlTarget;

export interface HttpsScreenTimeControlDevSchemasRulesJson {
  version: number;
  weekly: {
    [k: string]: {
      schedule: ScheduleWindow[];
      dailyTotalMinutes: number | null;
      [k: string]: unknown;
    };
  };
  defaults: {
    warningLeadMinutes: number;
    gracePeriodSeconds: number;
    [k: string]: unknown;
  };
  targets: HttpsScreenTimeControlDevSchemasRulesTargetJson[];
}
export interface ScheduleWindow {
  start: string;
  end: string;
}
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
