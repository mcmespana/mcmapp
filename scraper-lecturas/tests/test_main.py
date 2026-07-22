"""
Tests de main._run_one — fetch() vacío cuenta como error (Plan 005: antes
un `fetch()` que devolvía `[]` (p.ej. porque una fuente cambió su HTML)
hacía que `_run_one` devolviera 0 errores y la Action quedara verde sin que
nadie se enterase de que no llegaron lecturas nuevas).
"""

from main import _run_one
from scrapers.base import BaseScraper


class _EmptyFetchScraper(BaseScraper):
    SOURCE_KEY = "empty"

    def fetch(self):
        return []


class _NoneOnlyFetchScraper(BaseScraper):
    SOURCE_KEY = "none-only"

    def fetch(self):
        return [None, None]


def test_empty_fetch_counts_as_error():
    assert _run_one(_EmptyFetchScraper(), dry_run=True) >= 1


def test_all_none_fetch_counts_as_error():
    assert _run_one(_NoneOnlyFetchScraper(), dry_run=True) >= 1
