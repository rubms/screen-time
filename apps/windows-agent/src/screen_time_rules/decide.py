"""Pure `decide()` — port of packages/shared-rules-engine/src/decide.ts."""

from __future__ import annotations

import math

from screen_time_rules.models import (
    Activity,
    Decision,
    DecisionAllowed,
    DecisionBlocked,
    DecisionLimitedOk,
    DecisionOutOfTime,
    DecisionOutsideSchedule,
    DecisionWarn,
    NowLocal,
    Rules,
    TempUnlock,
    UsageToday,
)
from screen_time_rules.resolve import get_target_quota_minutes, get_warning_lead, resolve_activity
from screen_time_rules.schedule import is_inside_schedule, minutes_until_schedule_window_ends
from screen_time_rules.unlocks import compute_unlock_effects

_INFINITY = float("inf")


def decide(
    activity: Activity,
    rules: Rules,
    usage: UsageToday,
    now_local: NowLocal,
    temp_unlocks: list[TempUnlock] | None = None,
) -> Decision:
    resolved = resolve_activity(activity, rules)
    unlock_fx = compute_unlock_effects(temp_unlocks or [], now_local)
    day_schedule = rules.weekly[now_local.day_of_week]

    if resolved.category == "BLOCKED":
        return DecisionBlocked()
    if resolved.category == "ALLOWED":
        return DecisionAllowed()

    inside_schedule = is_inside_schedule(day_schedule, now_local.minutes_since_midnight)
    if not inside_schedule and not unlock_fx.bypass_schedule:
        return DecisionOutsideSchedule()

    if unlock_fx.bypass_all_quotas:
        return DecisionLimitedOk(remaining_minutes=9999, warn_at=9994)

    warning_lead = get_warning_lead(resolved.target, rules.defaults)
    limits: list[float] = []

    if day_schedule.daily_total_minutes is not None:
        total_budget = day_schedule.daily_total_minutes + unlock_fx.extra_total_minutes
        limits.append(total_budget - usage.total_limited_minutes)

    target_quota = get_target_quota_minutes(resolved.target, now_local.day_of_week)
    if target_quota is not None:
        used = usage.per_target.get(resolved.target_id, 0)
        extra = unlock_fx.extra_per_target_minutes.get(resolved.target_id, 0)
        limits.append(target_quota + extra - used)

    if inside_schedule and not unlock_fx.bypass_schedule:
        until_end = minutes_until_schedule_window_ends(
            day_schedule, now_local.minutes_since_midnight
        )
        if until_end is not None:
            limits.append(until_end)

    remaining_minutes = _INFINITY if not limits else min(limits)

    if not math.isfinite(remaining_minutes) or remaining_minutes > 1e6:
        return DecisionLimitedOk(remaining_minutes=9999, warn_at=9994)

    if remaining_minutes <= 0:
        reason = "quota-or-schedule" if len(limits) > 1 else "quota-exhausted"
        return DecisionOutOfTime(reason=reason)

    warn_at = remaining_minutes - warning_lead
    if remaining_minutes <= warning_lead:
        return DecisionWarn(
            remaining_minutes=remaining_minutes,
            reason="quota-exhausted" if remaining_minutes <= 0 else "approaching-limit",
        )

    return DecisionLimitedOk(
        remaining_minutes=remaining_minutes,
        warn_at=max(0.0, warn_at),
    )
