import type { Timestamp } from "firebase/firestore";
import type { Weekday } from "./constants";

export type ActivityCategory = "BLOCKED" | "LIMITED" | "ALLOWED";

export interface Family {
  ownerUid: string;
  displayName: string;
  createdAt?: Timestamp;
  schemaVersion?: number;
}

export interface Child {
  id: string;
  displayName: string;
  avatarColor: string;
  timezone: string;
  archived: boolean;
  createdAt?: Timestamp;
}

export interface Device {
  id: string;
  childId: string;
  platform: "windows" | "android";
  displayName: string;
  pairedAt?: Timestamp;
  lastSeenAt?: Timestamp;
  revoked: boolean;
}

export interface ScheduleWindow {
  start: string;
  end: string;
}

export interface DayRules {
  schedule: ScheduleWindow[];
  dailyTotalMinutes: number | null;
}

export interface QuotaByDay {
  default?: number;
  mon?: number;
  tue?: number;
  wed?: number;
  thu?: number;
  fri?: number;
  sat?: number;
  sun?: number;
}

export interface AppTarget {
  kind: "app";
  id: string;
  displayName: string;
  iconUrl?: string;
  platform: "windows" | "android" | "any";
  matchers: Array<{
    platform: "windows" | "android";
    matcher: string;
    windowTitlePattern?: string;
  }>;
  category: ActivityCategory;
  dailyQuotaMinutes?: QuotaByDay;
  warningLeadMinutes?: number;
  gracePeriodSeconds?: number;
}

export interface UrlTarget {
  kind: "url";
  id: string;
  displayName: string;
  pattern: string;
  category: ActivityCategory;
  dailyQuotaMinutes?: QuotaByDay;
  warningLeadMinutes?: number;
  gracePeriodSeconds?: number;
}

export type RuleTarget = AppTarget | UrlTarget;

export interface RulesDocument {
  version: number;
  updatedAt?: Timestamp;
  updatedByUid?: string;
  weekly: Record<Weekday, DayRules>;
  defaults: {
    warningLeadMinutes: number;
    gracePeriodSeconds: number;
  };
  targets: RuleTarget[];
}

export interface PairingCode {
  childId: string;
  expiresAt: Timestamp;
  redeemed: boolean;
  redeemedAt?: Timestamp;
  deviceId?: string;
}

export type TempUnlockScope = "schedule" | "schedule+quotas" | "add-minutes";

export interface TempUnlock {
  id: string;
  deviceId: string;
  childId: string;
  scope: TempUnlockScope;
  target?: "total" | string;
  additionalMinutes?: number;
  durationMinutes?: number;
  issuedAt?: Timestamp;
  expiresAt: Timestamp;
  issuedByUid: string;
  reason?: string;
  revoked: boolean;
}

export interface DailyRollup {
  date: string;
  totalMinutes: number;
  budgetMinutes: number | null;
  byTarget: Record<string, number>;
}

export interface UsageEvent {
  id: string;
  deviceId: string;
  type: string;
  localDate: string;
  targetId?: string;
  displayName?: string;
  minutes?: number;
  timestamp?: Timestamp;
}
