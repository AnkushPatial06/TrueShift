"""Application timezone helpers for attendance and shift calculations."""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import get_settings


def app_timezone() -> ZoneInfo:
    name = get_settings().APP_TIMEZONE
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise RuntimeError(f"Invalid APP_TIMEZONE: {name}") from exc


def local_now() -> datetime:
    return datetime.now(app_timezone())


def local_today() -> date:
    return local_now().date()


def utc_iso(value: datetime | None) -> str | None:
    """Serialize database timestamps as explicit UTC when stored without tzinfo."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def shift_window(start: time, end: time, now: datetime | None = None) -> tuple[datetime, datetime]:
    """Return the shift's start/end around now, accounting for overnight shifts."""
    zone = app_timezone()
    current = (now or datetime.now(zone)).astimezone(zone)
    day = current.date()
    start_dt = datetime.combine(day, start, tzinfo=zone)
    end_dt = datetime.combine(day, end, tzinfo=zone)
    overnight = end <= start
    if overnight:
        end_dt += timedelta(days=1)
        if current < start_dt and current.time() < end:
            start_dt -= timedelta(days=1)
            end_dt -= timedelta(days=1)
    return start_dt, end_dt


def attendance_day(start: time, end: time, now: datetime | None = None) -> date:
    """The shift-start date for an overnight shift still in progress."""
    zone = app_timezone()
    current = (now or datetime.now(zone)).astimezone(zone)
    start_dt, end_dt = shift_window(start, end, current)
    if end <= start and current.time() < end and start_dt.date() < current.date() and start_dt <= current <= end_dt:
        return start_dt.date()
    return current.date()
