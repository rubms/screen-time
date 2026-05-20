import { resolveActivity, getTargetQuotaMinutes, getWarningLead } from "./resolve.js";
import {
  isInsideSchedule,
  minutesUntilScheduleWindowEnds,
} from "./schedule.js";
import { computeUnlockEffects } from "./unlocks.js";
import type {
  Activity,
  Decision,
  NowLocal,
  Rules,
  TempUnlock,
  UsageToday,
} from "./types.js";

const INFINITY = Number.POSITIVE_INFINITY;

export function decide(
  activity: Activity,
  rules: Rules,
  usage: UsageToday,
  nowLocal: NowLocal,
  tempUnlocks: TempUnlock[] = [],
): Decision {
  const resolved = resolveActivity(activity, rules);
  const unlockFx = computeUnlockEffects(tempUnlocks, nowLocal);
  const daySchedule = rules.weekly[nowLocal.dayOfWeek];

  if (resolved.category === "BLOCKED") {
    return { kind: "BLOCKED" };
  }

  if (resolved.category === "ALLOWED") {
    return { kind: "ALLOWED" };
  }

  const insideSchedule = isInsideSchedule(
    daySchedule,
    nowLocal.minutesSinceMidnight,
  );

  if (!insideSchedule && !unlockFx.bypassSchedule) {
    return { kind: "OUTSIDE_SCHEDULE" };
  }

  if (unlockFx.bypassAllQuotas) {
    return {
      kind: "LIMITED_OK",
      remainingMinutes: 9999,
      warnAt: 9994,
    };
  }

  const warningLead = getWarningLead(resolved.target, rules.defaults);
  const limits: number[] = [];

  if (daySchedule.dailyTotalMinutes != null) {
    const totalBudget =
      daySchedule.dailyTotalMinutes + unlockFx.extraTotalMinutes;
    const totalUsed = usage.totalLimitedMinutes;
    limits.push(totalBudget - totalUsed);
  }

  const targetQuota = getTargetQuotaMinutes(
    resolved.target,
    nowLocal.dayOfWeek,
  );
  if (targetQuota != null) {
    const used = usage.perTarget[resolved.targetId] ?? 0;
    const extra =
      unlockFx.extraPerTargetMinutes[resolved.targetId] ?? 0;
    limits.push(targetQuota + extra - used);
  }

  if (insideSchedule && !unlockFx.bypassSchedule) {
    const untilEnd = minutesUntilScheduleWindowEnds(
      daySchedule,
      nowLocal.minutesSinceMidnight,
    );
    if (untilEnd != null) limits.push(untilEnd);
  }

  const remainingMinutes =
    limits.length === 0
      ? INFINITY
      : Math.min(...limits);

  if (!Number.isFinite(remainingMinutes) || remainingMinutes > 1e6) {
    return {
      kind: "LIMITED_OK",
      remainingMinutes: 9999,
      warnAt: 9994,
    };
  }

  if (remainingMinutes <= 0) {
    const reason =
      limits.length > 1 ? "quota-or-schedule" : "quota-exhausted";
    return { kind: "OUT_OF_TIME", reason };
  }

  const warnAt = remainingMinutes - warningLead;

  if (remainingMinutes <= warningLead) {
    return {
      kind: "WARN",
      remainingMinutes,
      reason: remainingMinutes <= 0 ? "quota-exhausted" : "approaching-limit",
    };
  }

  return {
    kind: "LIMITED_OK",
    remainingMinutes,
    warnAt: Math.max(0, warnAt),
  };
}
