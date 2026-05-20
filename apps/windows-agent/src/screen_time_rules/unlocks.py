from __future__ import annotations

from dataclasses import dataclass, field

from screen_time_rules.models import NowLocal, TempUnlock


@dataclass
class UnlockEffects:
    bypass_schedule: bool = False
    bypass_all_quotas: bool = False
    extra_total_minutes: float = 0
    extra_per_target_minutes: dict[str, float] = field(default_factory=dict)


def active_unlocks(unlocks: list[TempUnlock], now: NowLocal) -> list[TempUnlock]:
    return [u for u in unlocks if not u.revoked and u.expires_at_ms > now.epoch_ms]


def compute_unlock_effects(unlocks: list[TempUnlock], now: NowLocal) -> UnlockEffects:
    effects = UnlockEffects()
    for u in active_unlocks(unlocks, now):
        if u.scope == "schedule":
            effects.bypass_schedule = True
        if u.scope == "schedule+quotas":
            effects.bypass_schedule = True
            effects.bypass_all_quotas = True
        if u.scope == "add-minutes" and u.additional_minutes:
            if u.target == "total":
                effects.extra_total_minutes += u.additional_minutes
            elif u.target:
                effects.extra_per_target_minutes[u.target] = (
                    effects.extra_per_target_minutes.get(u.target, 0) + u.additional_minutes
                )
    return effects
