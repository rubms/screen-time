"""Parity tests against shared-rules-engine fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from screen_time_rules.decide import decide
from screen_time_rules.models import (
    Activity,
    NowLocal,
    Rules,
    TempUnlock,
    UsageToday,
    decision_to_json,
)

FIXTURES = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared-rules-engine"
    / "fixtures"
    / "cases.json"
)


def _load_cases() -> list[dict] | None:
    if not FIXTURES.exists():
        return None
    data = json.loads(FIXTURES.read_text(encoding="utf-8"))
    cases = data.get("cases") if isinstance(data, dict) else data
    if not isinstance(cases, list) or not cases:
        return None
    if not isinstance(cases[0], dict) or "expected" not in cases[0]:
        return None
    return cases


@pytest.mark.parametrize(
    "case",
    _load_cases() or [],
    ids=lambda c: c.get("id", "?"),
)
def test_parity_case(case: dict) -> None:
    activity = Activity.model_validate(case["activity"])
    rules = Rules.model_validate(case["rules"])
    usage = UsageToday.model_validate(case["usage"])
    now_local = NowLocal.model_validate(case["nowLocal"])
    unlocks = [TempUnlock.model_validate(u) for u in case.get("tempUnlocks", [])]
    expected = case["expected"]
    actual = decision_to_json(decide(activity, rules, usage, now_local, unlocks))
    assert actual == expected
