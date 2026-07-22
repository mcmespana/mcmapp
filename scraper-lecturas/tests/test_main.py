"""
Tests de main._run_one — fetch() vacío cuenta como error (Plan 005: antes
un `fetch()` que devolvía `[]` (p.ej. porque una fuente cambió su HTML)
hacía que `_run_one` devolviera 0 errores y la Action quedara verde sin que
nadie se enterase de que no llegaron lecturas nuevas), y de
main._append_step_summary / _build_summary_markdown — el resumen visible en
la pestaña "Summary" del run de GitHub Actions (para que un fallo parcial se
vea de un vistazo sin abrir logs).
"""

from main import _run_one, _append_step_summary, _build_summary_markdown
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


def test_build_summary_marks_failed_source_visibly():
    md = _build_summary_markdown(
        target_date="2026-07-22",
        dry_run=False,
        results=[("DominicosScraper", 0), ("VidaNuevaScraper", 2)],
        deleted=3,
        exit_code=1,
    )
    assert "Fallo parcial" in md
    assert "DominicosScraper" in md and "✅ OK" in md
    assert "VidaNuevaScraper" in md and "❌ 2 error(es)" in md
    assert "3" in md


def test_append_step_summary_writes_to_github_step_summary_file(tmp_path, monkeypatch):
    summary_file = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary_file))

    _append_step_summary("### hola")

    assert summary_file.read_text(encoding="utf-8").strip() == "### hola"


def test_append_step_summary_is_noop_without_env_var(monkeypatch):
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    # No debe lanzar aunque no exista la variable (ejecución local).
    _append_step_summary("### hola")
