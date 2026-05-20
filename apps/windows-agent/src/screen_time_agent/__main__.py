"""CLI entry: service, pair, debug-run."""

from __future__ import annotations

import argparse
import logging
import sys
import threading
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="screen-time-agent")
    sub = parser.add_subparsers(dest="command", required=True)

    svc = sub.add_parser("service", help="Windows service management")
    svc_sub = svc.add_subparsers(dest="service_cmd", required=True)
    for cmd in ("install", "uninstall", "start", "stop"):
        svc_sub.add_parser(cmd)

    pair = sub.add_parser("pair", help="Pair device with 6-char code")
    pair.add_argument("--code", required=True)
    pair.add_argument("--name", default=None, help="Device display name")

    sub.add_parser("debug-run", help="Run agent in foreground (mock watcher off-Windows)")

    tray = sub.add_parser("tray", help="Run system tray app")
    tray.add_argument("--remaining", default="1h 23m")
    tray.add_argument("--category", default="LIMITED")

    args = parser.parse_args(argv)

    if args.command == "service":
        _run_service_cmd(args.service_cmd)
    elif args.command == "pair":
        from screen_time_agent.pairing import pair_device

        pair_device(args.code, display_name=args.name)
        print("Paired successfully.")
    elif args.command == "debug-run":
        _debug_run()
    elif args.command == "tray":
        from screen_time_agent.tray_app import run_tray

        run_tray(remaining_label=args.remaining, category=args.category)


def _run_service_cmd(cmd: str) -> None:
    from screen_time_agent import service as svc_mod

    handlers = {
        "install": svc_mod.install_service,
        "uninstall": svc_mod.uninstall_service,
        "start": svc_mod.start_service,
        "stop": svc_mod.stop_service,
    }
    handlers[cmd]()


def _debug_run() -> None:
    from screen_time_agent.agent_core import AgentCore

    core = AgentCore()
    core.start()
    print("Agent running (Ctrl+C to stop). Mock watcher on non-Windows.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping…")
    finally:
        core.stop()


if __name__ == "__main__":
    main(sys.argv[1:])
