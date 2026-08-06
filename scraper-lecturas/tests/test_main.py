"""
Tests de main._run_one — fetch() vacío cuenta como error (Plan 005: antes
un `fetch()` que devolvía `[]` (p.ej. porque una fuente cambió su HTML)
hacía que `_run_one` devolviera 0 errores y la Action quedara verde sin que
nadie se enterase de que no llegaron lecturas nuevas), y de
main._append_step_summary / _build_summary_markdown — el resumen visible en
la pestaña "Summary" del run de GitHub Actions (para que un fallo parcial se
vea de un vistazo sin abrir logs).
"""

from main import (
    _run_one,
    _append_step_summary,
    _build_summary_markdown,
    _exit_code,
    ScraperResult,
)
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
    result = _run_one(_EmptyFetchScraper(), dry_run=True)
    assert result.date_errors >= 1
    assert result.wrote_any is False


def test_all_none_fetch_counts_as_error():
    result = _run_one(_NoneOnlyFetchScraper(), dry_run=True)
    assert result.date_errors >= 1
    assert result.wrote_any is False


def test_build_summary_marks_failed_source_visibly():
    md = _build_summary_markdown(
        target_date="2026-07-22",
        dry_run=False,
        results=[
            ("DominicosScraper", ScraperResult(date_errors=0, wrote_any=True)),
            ("VidaNuevaScraper", ScraperResult(date_errors=2, wrote_any=True)),
        ],
        deleted=3,
        exit_code=1,
    )
    assert "Fallo parcial" in md
    assert "DominicosScraper" in md and "✅ OK" in md
    assert "VidaNuevaScraper" in md and "⚠️ 2 fecha(s) con error" in md
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


# ---------------------------------------------------------------------------
# _exit_code — Plan 013: el exit code se deriva de cuántos SCRAPERS no
# produjeron nada, no de la suma de errores por fecha. Antes, 3 scrapers con
# 3 fechas malas de UNA sola fuente (rutinario: Dominicos aún no publica
# fechas futuras) daban exit 2 ("TODAS las fuentes fallaron") aunque las
# otras dos fuentes hubieran escrito todo.
# ---------------------------------------------------------------------------


def test_exit_code_regresion_fechas_sueltas_no_es_apagon_total():
    # 3 scrapers, uno con 3 date_errors pero SÍ escribió algo → antes daba 2.
    assert _exit_code(dead_scrapers=0, date_errors=3, total_scrapers=3) == 1


def test_exit_code_todos_muertos():
    assert _exit_code(dead_scrapers=3, date_errors=0, total_scrapers=3) == 2


def test_exit_code_todo_limpio():
    assert _exit_code(dead_scrapers=0, date_errors=0, total_scrapers=3) == 0


def test_exit_code_una_fuente_muerta_dos_sanas():
    assert _exit_code(dead_scrapers=1, date_errors=0, total_scrapers=3) == 1
