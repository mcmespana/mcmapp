"""Date parsing and formatting utilities."""

from datetime import datetime


def parse_vida_nueva_date(raw: str) -> str:
    """
    Parse the date format used by vidanuevadigital.com.

    Input:  "21 / 03 / 2026"
    Output: "2026-03-21"
    """
    raw = raw.strip()
    return datetime.strptime(raw, "%d / %m / %Y").strftime("%Y-%m-%d")


def today_iso() -> str:
    """Return today's date in YYYY-MM-DD format (UTC)."""
    from datetime import timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
