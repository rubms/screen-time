"""Windows Service host."""

from __future__ import annotations

import logging
import sys

logger = logging.getLogger(__name__)

SERVICE_NAME = "ScreenTimeControlAgent"
SERVICE_DISPLAY = "Screen Time Control Agent"


def install_service() -> None:
    if sys.platform != "win32":
        raise RuntimeError("service install requires Windows")
    import win32serviceutil

    win32serviceutil.InstallService(
        ScreenTimeService._svc_reg_class_,  # type: ignore[attr-defined]
        SERVICE_NAME,
        SERVICE_DISPLAY,
        startType=win32serviceutil.SERVICE_AUTO_START,
    )


def uninstall_service() -> None:
    if sys.platform != "win32":
        raise RuntimeError("service uninstall requires Windows")
    import win32serviceutil

    win32serviceutil.RemoveService(SERVICE_NAME)


def start_service() -> None:
    if sys.platform != "win32":
        raise RuntimeError("service start requires Windows")
    import win32serviceutil

    win32serviceutil.StartService(SERVICE_NAME)


def stop_service() -> None:
    if sys.platform != "win32":
        raise RuntimeError("service stop requires Windows")
    import win32serviceutil

    win32serviceutil.StopService(SERVICE_NAME)


if sys.platform == "win32":
    import servicemanager
    import win32event
    import win32service
    import win32serviceutil

    from screen_time_agent.agent_core import AgentCore

    class ScreenTimeService(win32serviceutil.ServiceFramework):
        _svc_name_ = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY
        _svc_description_ = "Enforces screen time rules for child accounts."

        def __init__(self, args: list[str]) -> None:
            win32serviceutil.ServiceFramework.__init__(self, args)
            self.stop_event = win32event.CreateEvent(None, 0, 0, None)
            self._core: AgentCore | None = None

        def SvcStop(self) -> None:
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            win32event.SetEvent(self.stop_event)
            if self._core:
                self._core.stop()

        def SvcDoRun(self) -> None:
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, ""),
            )
            self.main()

        def main(self) -> None:
            logging.basicConfig(level=logging.INFO)
            self._core = AgentCore()
            self._core.start()
            win32event.WaitForSingleObject(self.stop_event, win32event.INFINITE)

else:

    class ScreenTimeService:  # type: ignore[no-redef]
        pass
