export type Platform = "windows" | "android";
export type Category = "BLOCKED" | "LIMITED" | "ALLOWED";
export type DayOfWeek =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type TempUnlockScope = "schedule" | "schedule+quotas" | "add-minutes";

export interface Activity {
  app: string;
  url?: string | null;
  platform: Platform;
  windowTitle?: string | null;
}

export interface ScheduleWindow {
  start: string;
  end: string;
}

export interface DaySchedule {
  schedule: ScheduleWindow[];
  dailyTotalMinutes: number | null;
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

export interface AppMatcher {
  platform: Platform;
  matcher: string;
  windowTitlePattern?: string;
}

export interface AppTarget {
  kind: "app";
  id: string;
  displayName: string;
  platform: Platform | "any";
  matchers: AppMatcher[];
  category: Category;
  dailyQuotaMinutes?: DailyQuotaMinutes;
  warningLeadMinutes?: number;
  gracePeriodSeconds?: number;
}

export interface UrlTarget {
  kind: "url";
  id: string;
  displayName: string;
  pattern: string;
  category: Category;
  dailyQuotaMinutes?: DailyQuotaMinutes;
  warningLeadMinutes?: number;
  gracePeriodSeconds?: number;
}

export type RulesTarget = AppTarget | UrlTarget;

export interface RulesDefaults {
  warningLeadMinutes: number;
  gracePeriodSeconds: number;
}

export interface Rules {
  version: number;
  weekly: Record<DayOfWeek, DaySchedule>;
  defaults: RulesDefaults;
  targets: RulesTarget[];
}

export interface UsageToday {
  /** Sum of LIMITED focus minutes today (all targets). */
  totalLimitedMinutes: number;
  /** Per-target LIMITED minutes. */
  perTarget: Record<string, number>;
}

export interface TempUnlock {
  id: string;
  deviceId: string;
  scope: TempUnlockScope;
  target?: "total" | string;
  additionalMinutes?: number;
  expiresAtMs: number;
  revoked: boolean;
}

export interface NowLocal {
  /** ISO date YYYY-MM-DD in device local timezone. */
  localDate: string;
  dayOfWeek: DayOfWeek;
  /** Minutes since midnight, 0–1439. */
  minutesSinceMidnight: number;
  /** Epoch ms for unlock expiry checks. */
  epochMs: number;
}

export type Decision =
  | { kind: "ALLOWED" }
  | { kind: "BLOCKED" }
  | { kind: "LIMITED_OK"; remainingMinutes: number; warnAt: number }
  | { kind: "WARN"; remainingMinutes: number; reason: string }
  | { kind: "OUT_OF_TIME"; reason: string }
  | { kind: "OUTSIDE_SCHEDULE" };

export interface ResolvedTarget {
  targetId: string;
  category: Category;
  target: RulesTarget | null;
}
