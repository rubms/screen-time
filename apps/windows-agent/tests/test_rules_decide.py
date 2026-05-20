"""Unit tests for screen_time_rules.decide."""

from __future__ import annotations

from screen_time_rules import decide
from screen_time_rules.models import (
    Activity,
    AppMatcher,
    AppTarget,
    DaySchedule,
    DecisionAllowed,
    DecisionBlocked,
    DecisionOutsideSchedule,
    NowLocal,
    Rules,
    RulesDefaults,
    ScheduleWindow,
    UsageToday,
)


def _rules(**kwargs: object) -> Rules:
    weekly = {
        dow: DaySchedule(
            schedule=[ScheduleWindow(start="08:00", end="22:00")],
            daily_total_minutes=120,
        )
        for dow in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    }
    return Rules(weekly=weekly, defaults=RulesDefaults(), **kwargs)  # type: ignore[arg-type]


def _now(**kwargs: object) -> NowLocal:
    defaults = {
        "localDate": "2026-05-19",
        "dayOfWeek": "tue",
        "minutesSinceMidnight": 600,
        "epochMs": 0,
    }
    defaults.update(kwargs)
    return NowLocal.model_validate(defaults)


def test_limited_in_schedule() -> None:
    decision = decide(
        Activity(app="unknown.exe", platform="windows"),
        _rules(),
        UsageToday(),
        _now(),
    )
    assert decision.kind in ("LIMITED_OK", "WARN", "OUT_OF_TIME")


def test_blocked_app() -> None:
    rules = _rules(
        targets=[
            AppTarget(
                id="notepad",
                displayName="Notepad",
                platform="windows",
                matchers=[AppMatcher(platform="windows", matcher="notepad.exe")],
                category="BLOCKED",
            )
        ]
    )
    decision = decide(
        Activity(app="notepad.exe", platform="windows"),
        rules,
        UsageToday(),
        _now(),
    )
    assert isinstance(decision, DecisionBlocked)


def test_outside_schedule() -> None:
    decision = decide(
        Activity(app="chrome.exe", url="example.com", platform="windows"),
        _rules(),
        UsageToday(),
        _now(minutesSinceMidnight=23 * 60),
    )
    assert isinstance(decision, DecisionOutsideSchedule)


def test_allowed_target() -> None:
    rules = _rules(
        targets=[
            AppTarget(
                id="calc",
                displayName="Calculator",
                platform="windows",
                matchers=[AppMatcher(platform="windows", matcher="calc.exe")],
                category="ALLOWED",
            )
        ]
    )
    decision = decide(
        Activity(app="calc.exe", platform="windows"),
        rules,
        UsageToday(),
        _now(),
    )
    assert isinstance(decision, DecisionAllowed)
