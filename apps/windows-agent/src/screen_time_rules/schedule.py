from __future__ import annotations

from screen_time_rules.models import DaySchedule, ScheduleWindow


def parse_hm(hm: str) -> int:
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def is_inside_schedule(day_schedule: DaySchedule, minutes_since_midnight: int) -> bool:
    if not day_schedule.schedule:
        return False
    for w in day_schedule.schedule:
        start = parse_hm(w.start)
        end = parse_hm(w.end)
        if start <= end:
            if start <= minutes_since_midnight < end:
                return True
        elif minutes_since_midnight >= start or minutes_since_midnight < end:
            return True
    return False


def minutes_until_schedule_window_ends(
    day_schedule: DaySchedule,
    minutes_since_midnight: int,
) -> float | None:
    if not day_schedule.schedule:
        return None
    best: float | None = None
    for w in day_schedule.schedule:
        start = parse_hm(w.start)
        end = parse_hm(w.end)
        inside = False
        mins_left = 0.0
        if start <= end:
            inside = start <= minutes_since_midnight < end
            mins_left = float(end - minutes_since_midnight)
        else:
            inside = minutes_since_midnight >= start or minutes_since_midnight < end
            if minutes_since_midnight >= start:
                mins_left = float(24 * 60 - minutes_since_midnight + end)
            else:
                mins_left = float(end - minutes_since_midnight)
        if inside:
            if best is None or mins_left < best:
                best = mins_left
    return best
