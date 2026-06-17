"""
Cleanup utility: delete lecturas older than the retention window.

Designed to run at the end of each nightly scraping cycle to keep the
Firebase tree bounded to ±30 days of today.
"""

import logging
import re

log = logging.getLogger(__name__)

_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def cleanup_old_dates(*, retention_days: int = 30, dry_run: bool = False) -> int:
    """
    Delete all seccion_oracion/lecturas/{fecha} nodes where fecha < today-retention_days.

    Parameters
    ----------
    retention_days:
        Number of days to keep. Default 30.
    dry_run:
        If True, log what *would* be deleted without touching Firebase.

    Returns
    -------
    int
        Count of dates deleted (or that would have been deleted in dry_run).
    """
    from firebase.client import list_lectura_dates, delete_lectura_date
    from utils.date_utils import iso_days_ago

    cutoff = iso_days_ago(retention_days)
    all_dates = list_lectura_dates()
    to_delete = [d for d in all_dates if _is_valid_iso(d) and d < cutoff]

    log.info(
        f"[cleanup] retention={retention_days}d  cutoff={cutoff}  "
        f"total_en_db={len(all_dates)}  a_borrar={len(to_delete)}"
        + ("  [DRY-RUN]" if dry_run else "")
    )

    if not to_delete:
        log.info("[cleanup] Nada que borrar.")
        return 0

    if dry_run:
        for d in to_delete:
            log.info(f"[cleanup] Dry-run: borraría {d}")
    else:
        for d in to_delete:
            delete_lectura_date(d)

    log.info(f"[cleanup] {'Borradas' if not dry_run else 'Se borrarían'} {len(to_delete)} fechas.")
    return len(to_delete)


def _is_valid_iso(s: str) -> bool:
    """Guard against non-date keys that might appear under lecturas/."""
    return bool(_ISO_DATE_RE.match(s))
