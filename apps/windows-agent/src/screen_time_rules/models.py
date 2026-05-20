"""Pydantic models aligned with packages/shared-rules-engine/src/types.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field

Platform = Literal["windows", "android"]
Category = Literal["BLOCKED", "LIMITED", "ALLOWED"]
DayOfWeek = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
TempUnlockScope = Literal["schedule", "schedule+quotas", "add-minutes"]

UNKNOWN_TARGET_ID = "__unknown__"


class Activity(BaseModel):
    app: str
    url: str | None = None
    platform: Platform
    window_title: str | None = Field(None, alias="windowTitle")

    model_config = {"populate_by_name": True}


class ScheduleWindow(BaseModel):
    start: str
    end: str


class DaySchedule(BaseModel):
    schedule: list[ScheduleWindow] = Field(default_factory=list)
    daily_total_minutes: int | None = Field(None, alias="dailyTotalMinutes")

    model_config = {"populate_by_name": True}


class DailyQuotaMinutes(BaseModel):
    default: int | None = None
    mon: int | None = None
    tue: int | None = None
    wed: int | None = None
    thu: int | None = None
    fri: int | None = None
    sat: int | None = None
    sun: int | None = None


class AppMatcher(BaseModel):
    platform: Platform
    matcher: str
    window_title_pattern: str | None = Field(None, alias="windowTitlePattern")

    model_config = {"populate_by_name": True}


class AppTarget(BaseModel):
    kind: Literal["app"] = "app"
    id: str
    display_name: str = Field(alias="displayName")
    platform: Platform | Literal["any"] = "any"
    matchers: list[AppMatcher]
    category: Category
    daily_quota_minutes: DailyQuotaMinutes | None = Field(None, alias="dailyQuotaMinutes")
    warning_lead_minutes: int | None = Field(None, alias="warningLeadMinutes")
    grace_period_seconds: int | None = Field(None, alias="gracePeriodSeconds")

    model_config = {"populate_by_name": True}


class UrlTarget(BaseModel):
    kind: Literal["url"] = "url"
    id: str
    display_name: str = Field(alias="displayName")
    pattern: str
    category: Category
    daily_quota_minutes: DailyQuotaMinutes | None = Field(None, alias="dailyQuotaMinutes")
    warning_lead_minutes: int | None = Field(None, alias="warningLeadMinutes")
    grace_period_seconds: int | None = Field(None, alias="gracePeriodSeconds")

    model_config = {"populate_by_name": True}


RulesTarget = Union[AppTarget, UrlTarget]


class RulesDefaults(BaseModel):
    warning_lead_minutes: int = Field(5, alias="warningLeadMinutes")
    grace_period_seconds: int = Field(120, alias="gracePeriodSeconds")

    model_config = {"populate_by_name": True}


class Rules(BaseModel):
    version: int = 1
    weekly: dict[DayOfWeek, DaySchedule]
    defaults: RulesDefaults
    targets: list[RulesTarget] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class UsageToday(BaseModel):
    total_limited_minutes: float = Field(0, alias="totalLimitedMinutes")
    per_target: dict[str, float] = Field(default_factory=dict, alias="perTarget")

    model_config = {"populate_by_name": True}


class TempUnlock(BaseModel):
    id: str = ""
    device_id: str = Field("", alias="deviceId")
    child_id: str | None = Field(None, alias="childId")
    scope: TempUnlockScope
    target: str | None = None
    additional_minutes: int | None = Field(None, alias="additionalMinutes")
    duration_minutes: int | None = Field(None, alias="durationMinutes")
    expires_at_ms: int = Field(0, alias="expiresAtMs")
    revoked: bool = False

    model_config = {"populate_by_name": True}


class NowLocal(BaseModel):
    local_date: str = Field(alias="localDate")
    day_of_week: DayOfWeek = Field(alias="dayOfWeek")
    minutes_since_midnight: int = Field(alias="minutesSinceMidnight")
    epoch_ms: int = Field(alias="epochMs")

    model_config = {"populate_by_name": True}


class ResolvedTarget(BaseModel):
    target_id: str
    category: Category
    target: Union[RulesTarget, None] = None


class DecisionAllowed(BaseModel):
    kind: Literal["ALLOWED"] = "ALLOWED"


class DecisionBlocked(BaseModel):
    kind: Literal["BLOCKED"] = "BLOCKED"


class DecisionLimitedOk(BaseModel):
    kind: Literal["LIMITED_OK"] = "LIMITED_OK"
    remaining_minutes: float = Field(alias="remainingMinutes")
    warn_at: float = Field(alias="warnAt")

    model_config = {"populate_by_name": True}


class DecisionWarn(BaseModel):
    kind: Literal["WARN"] = "WARN"
    remaining_minutes: float = Field(alias="remainingMinutes")
    reason: str

    model_config = {"populate_by_name": True}


class DecisionOutOfTime(BaseModel):
    kind: Literal["OUT_OF_TIME"] = "OUT_OF_TIME"
    reason: str

    model_config = {"populate_by_name": True}


class DecisionOutsideSchedule(BaseModel):
    kind: Literal["OUTSIDE_SCHEDULE"] = "OUTSIDE_SCHEDULE"


Decision = Union[
    DecisionAllowed,
    DecisionBlocked,
    DecisionLimitedOk,
    DecisionWarn,
    DecisionOutOfTime,
    DecisionOutsideSchedule,
]

BROWSER_APPS = frozenset(
    {
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "brave.exe",
        "opera.exe",
        "com.android.chrome",
        "com.microsoft.emmx",
        "org.mozilla.firefox",
    }
)

DOW_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def now_local_from_datetime(dt: datetime) -> NowLocal:
    from datetime import datetime as dt_cls

    if not isinstance(dt, dt_cls):
        raise TypeError("expected datetime")
    dow = DOW_KEYS[dt.weekday()]
    return NowLocal(
        localDate=dt.strftime("%Y-%m-%d"),
        dayOfWeek=dow,
        minutesSinceMidnight=dt.hour * 60 + dt.minute,
        epochMs=int(dt.timestamp() * 1000),
    )


def decision_to_json(decision: Decision) -> dict[str, Any]:
    data = decision.model_dump(by_alias=True, mode="json", exclude_none=True)
    for key in ("remainingMinutes", "warnAt"):
        if key in data and isinstance(data[key], float) and data[key] == int(data[key]):
            data[key] = int(data[key])
    return data
