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
    ScraperResult,
    _run_one,
    _exit_code,
    _append_step_summary,
    _build_summary_markdown,
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
    assert "VidaNuevaScraper" in md and "2 fecha(s) con errores" in md
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
# _exit_code — unidades coherentes (Plan 013)
#
# Antes, `_run_one` devolvía errores POR FECHA y `_exit_code` los comparaba con
# el NÚMERO DE SCRAPERS: tres fechas malas de una sola fuente daban exit 2 y el
# summary rojo "Fallaron TODAS las fuentes", con las otras dos fuentes habiendo
# escrito todo. Un apagón total y un hipo trivial eran indistinguibles.
# ---------------------------------------------------------------------------


def test_fechas_fallidas_de_una_fuente_son_exito_parcial():
    # El caso del bug: 3 scrapers, uno con 3 fechas malas pero que SÍ escribió.
    assert _exit_code(dead_scrapers=0, date_errors=3, total_scrapers=3) == 1


def test_todas_las_fuentes_sin_datos_es_exit_2():
    assert _exit_code(dead_scrapers=3, date_errors=3, total_scrapers=3) == 2


def test_todo_limpio_es_exit_0():
    assert _exit_code(dead_scrapers=0, date_errors=0, total_scrapers=3) == 0


def test_una_fuente_muerta_y_dos_sanas_es_exit_1():
    assert _exit_code(dead_scrapers=1, date_errors=0, total_scrapers=3) == 1


def test_summary_distingue_sin_datos_de_fechas_fallidas():
    md = _build_summary_markdown(
        target_date="2026-08-07",
        dry_run=False,
        results=[
            ("DominicosScraper", ScraperResult(date_errors=0, wrote_any=False)),
            ("VaticanNewsScraper", ScraperResult(date_errors=3, wrote_any=True)),
            ("VidaNuevaScraper", ScraperResult(date_errors=0, wrote_any=True)),
        ],
        deleted=0,
        exit_code=1,
    )
    assert "DominicosScraper | ❌ sin datos" in md
    assert "VaticanNewsScraper | ⚠️ 3 fecha(s) con errores" in md
    assert "VidaNuevaScraper | ✅ OK" in md
    # El titular de "todas las fuentes" no aparece en un parcial.
    assert "Ninguna fuente devolvió datos" not in md


def test_summary_exit_2_ya_no_dice_que_fallaron_todas_los_scrapers():
    md = _build_summary_markdown(
        target_date="2026-08-07",
        dry_run=False,
        results=[("DominicosScraper", ScraperResult(date_errors=1, wrote_any=False))],
        deleted=0,
        exit_code=2,
    )
    assert "Ninguna fuente devolvió datos" in md
