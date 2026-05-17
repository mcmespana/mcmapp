"""Date parsing and formatting utilities."""

from datetime import datetime, timedelta, timezone


def parse_vida_nueva_date(raw: str) -> str:
    """
    Parse the date format used by vidanuevadigital.com.

    Input:  "21 / 03 / 2026"
    Output: "2026-03-21"
    """
    raw = raw.strip()
    return datetime.strptime(raw, "%d / %m / %Y").strftime("%Y-%m-%d")


def today_iso() -> str:
    """Return today's date YYYY-MM-DD in UTC. Legacy — prefer today_madrid_iso()."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def today_madrid_iso() -> str:
    """
    Return today's date YYYY-MM-DD in Europe/Madrid timezone.

    Critical for the 01:10 cron: in summer (CEST, UTC+2) the cron fires at
    23:10 UTC the *previous* calendar day. Using UTC would give yesterday's date.
    """
    try:
        from zoneinfo import ZoneInfo  # Python 3.9+ stdlib
        tz = ZoneInfo("Europe/Madrid")
    except ImportError:
        import logging
        logging.getLogger(__name__).warning(
            "zoneinfo unavailable, falling back to UTC+1 (may be off by 1h at DST boundary)"
        )
        tz = timezone(timedelta(hours=1))
    return datetime.now(tz).strftime("%Y-%m-%d")


def date_range_iso(
    start_offset: int,
    end_offset_inclusive: int,
    base: str | None = None,
) -> list[str]:
    """
    Build a sorted list of YYYY-MM-DD strings offset from *base*.

    date_range_iso(0, 30)          → 31 dates: today(Madrid) .. today+30
    date_range_iso(-30, 30)        → 61 dates
    date_range_iso(-1, 1, "2026-04-12") → ["2026-04-11", "2026-04-12", "2026-04-13"]
    """
    base_dt = _parse_iso(base) if base else _parse_iso(today_madrid_iso())
    return [
        (base_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
        for offset in range(start_offset, end_offset_inclusive + 1)
    ]


def iso_days_ago(n: int, base: str | None = None) -> str:
    """
    Return the date that is *n* days before *base* (default: today Madrid).

    iso_days_ago(30) → today - 30 days  →  cutoff date for cleanup.
    """
    base_dt = _parse_iso(base) if base else _parse_iso(today_madrid_iso())
    return (base_dt - timedelta(days=n)).strftime("%Y-%m-%d")


def _parse_iso(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")
