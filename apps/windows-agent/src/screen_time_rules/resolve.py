from __future__ import annotations

import re

from screen_time_rules.browsers import is_browser_app
from screen_time_rules.models import (
    UNKNOWN_TARGET_ID,
    Activity,
    AppTarget,
    DayOfWeek,
    ResolvedTarget,
    Rules,
    RulesDefaults,
    RulesTarget,
    UrlTarget,
)
from screen_time_rules.url import match_url_pattern, normalize_url, pattern_specificity


def match_app_target(activity: Activity, target: AppTarget) -> bool:
    for m in target.matchers:
        if m.platform != activity.platform:
            continue
        if activity.app.lower() != m.matcher.lower():
            continue
        if m.window_title_pattern and activity.window_title:
            try:
                if not re.search(m.window_title_pattern, activity.window_title, re.I):
                    continue
            except re.error:
                continue
        elif m.window_title_pattern and not activity.window_title:
            continue
        return True
    return False


def resolve_app_target(activity: Activity, rules: Rules) -> AppTarget | None:
    for t in rules.targets:
        if not isinstance(t, AppTarget):
            continue
        if match_app_target(activity, t):
            return t
    return None


def resolve_url_target(normalized_url: str, rules: Rules) -> UrlTarget | None:
    url_targets = [t for t in rules.targets if isinstance(t, UrlTarget)]
    url_targets.sort(key=lambda t: pattern_specificity(t.pattern), reverse=True)
    for t in url_targets:
        if match_url_pattern(normalized_url, t.pattern):
            return t
    return None


def resolve_activity(activity: Activity, rules: Rules) -> ResolvedTarget:
    app_target = resolve_app_target(activity, rules)

    if app_target and app_target.category == "BLOCKED":
        return ResolvedTarget(target_id=app_target.id, category="BLOCKED", target=app_target)

    url_target: UrlTarget | None = None
    if activity.url and is_browser_app(activity.app, activity.platform):
        url_target = resolve_url_target(normalize_url(activity.url), rules)

    if url_target:
        return ResolvedTarget(target_id=url_target.id, category=url_target.category, target=url_target)

    if app_target:
        return ResolvedTarget(target_id=app_target.id, category=app_target.category, target=app_target)

    return ResolvedTarget(target_id=UNKNOWN_TARGET_ID, category="LIMITED", target=None)


def get_target_quota_minutes(target: RulesTarget | None, day_of_week: DayOfWeek) -> int | None:
    if target is None or target.daily_quota_minutes is None:
        return None
    q = target.daily_quota_minutes
    day_val = getattr(q, day_of_week, None)
    if day_val is not None:
        return day_val
    return q.default


def get_warning_lead(target: RulesTarget | None, defaults: RulesDefaults) -> int:
    if target and target.warning_lead_minutes is not None:
        return target.warning_lead_minutes
    return defaults.warning_lead_minutes


def get_grace_period(target: RulesTarget | None, defaults: RulesDefaults) -> int:
    if target and target.grace_period_seconds is not None:
        return target.grace_period_seconds
    return defaults.grace_period_seconds
