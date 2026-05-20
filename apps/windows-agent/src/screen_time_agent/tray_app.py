"""System tray UI (pystray)."""

from __future__ import annotations

import logging
import os
import sys
import threading
import webbrowser

from screen_time_agent.config import load_config

logger = logging.getLogger(__name__)


def run_tray(*, remaining_label: str = "—", category: str = "LIMITED") -> None:
    try:
        import pystray
        from PIL import Image, ImageDraw
    except ImportError:
        logger.error("pystray/pillow required for tray")
        return

    cfg = load_config()
    child = cfg.child_display_name if cfg else "Child"

    def create_image() -> Image.Image:
        img = Image.new("RGB", (64, 64), color=(30, 120, 200))
        draw = ImageDraw.Draw(img)
        draw.ellipse((8, 8, 56, 56), fill=(255, 255, 255))
        return img

    def on_settings(icon: pystray.Icon, item: pystray.MenuItem) -> None:
        pin = _prompt_pin()
        if pin and _verify_pin(pin):
            url = cfg.dashboard_url if cfg else os.environ.get("SCREEN_TIME_DASHBOARD_URL", "https://example.com")
            webbrowser.open(url)
        else:
            logger.info("settings blocked — invalid PIN")

    def on_quit(icon: pystray.Icon, item: pystray.MenuItem) -> None:
        icon.stop()

    tooltip = f"{child} — {remaining_label} left today ({category})"
    menu = pystray.Menu(
        pystray.MenuItem("Settings…", on_settings),
        pystray.MenuItem("Quit", on_quit),
    )
    icon = pystray.Icon("screen_time_control", create_image(), tooltip, menu)

    # Run in main thread on Windows; daemon thread elsewhere for tests
    if sys.platform == "win32":
        icon.run()
    else:
        t = threading.Thread(target=icon.run, daemon=True)
        t.start()
        t.join()


def _prompt_pin() -> str | None:
    if sys.platform == "win32":
        try:
            import tkinter as tk
            from tkinter import simpledialog

            root = tk.Tk()
            root.withdraw()
            return simpledialog.askstring("Parent PIN", "Enter PIN:", show="*")
        except Exception:
            pass
    return os.environ.get("SCREEN_TIME_DEBUG_PIN")


def _verify_pin(pin: str) -> bool:
    url = os.environ.get("SCREEN_TIME_VERIFY_PIN_URL")
    if not url:
        return pin == os.environ.get("SCREEN_TIME_DEBUG_PIN", "0000")
    import requests

    resp = requests.post(url, json={"pin": pin}, timeout=15)
    return resp.status_code == 200 and resp.json().get("valid", False)
