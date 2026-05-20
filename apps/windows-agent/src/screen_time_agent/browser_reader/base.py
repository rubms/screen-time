"""Shared UIA helpers for browser address bars."""

from __future__ import annotations

import logging
import sys

logger = logging.getLogger(__name__)


def read_address_bar_value(hwnd: int | None, automation_ids: list[str], names: list[str]) -> str | None:
    if sys.platform != "win32":
        return None
    try:
        import comtypes.client
        from comtypes.gen import UIAutomationClient as UIA  # type: ignore[import-untyped]
    except Exception:
        logger.debug("UIAutomation unavailable", exc_info=True)
        return None

    try:
        uia = comtypes.client.CreateObject(
            "{ff48dba4-60ef-4201-aa87-54103eef594e}", interface=UIA.IUIAutomation
        )
        element = uia.ElementFromHandle(hwnd) if hwnd else uia.GetRootElement()
        if element is None:
            return None
        condition = uia.CreatePropertyCondition(
            UIA.UIA_ControlTypePropertyId, UIA.UIA_EditControlTypeId
        )
        found = element.FindFirst(UIA.TreeScope_Descendants, condition)
        if found is None:
            return None
        value_pattern = found.GetCurrentPattern(UIA.UIA_ValuePatternId)
        if value_pattern is None:
            return None
        value = value_pattern.CurrentValue
        return str(value) if value else None
    except Exception:
        logger.debug("address bar read failed", exc_info=True)
        return None
