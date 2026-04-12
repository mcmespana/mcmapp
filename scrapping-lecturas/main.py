"""
Orquestador del scraper de lecturas diarias.

Uso:
    python main.py                         # scrape de hoy (Madrid tz)
    python main.py --date 2026-03-15       # scrape de fecha específica
    python main.py --dry-run               # scrape sin escribir en Firebase
    python main.py --backfill-dominicos    # Dominicos: rango -30..+30 días, ignora skip_existing
    python main.py --cleanup-only          # solo limpiar fechas antiguas, sin scraping

Orden de ejecución (último escritor por campo gana vía ref.update()):
    1. DominicosScraper  → evangelio.texto, lectura1, lectura2, salmo, info
    2. VaticanNewsScraper → evangelio.comentario (+15 días desde RSS)
    3. VidaNuevaScraper  → evangelio completo + info (solo hoy)
    4. Cleanup           → elimina lecturas con fecha < hoy-30

Resultado en Firebase:
    Hoy:       evangelio.activoTexto=vidaNueva, activoComentario=vidaNueva
    +1..+14:   evangelio.activoTexto=dominicos, activoComentario=vaticanNews
    +15..+30:  evangelio.activoTexto=dominicos (sin comentario)
    Todos:     lectura1/lectura2/salmo.activo=dominicos

Códigos de salida:
    0 → todo OK
    1 → algún scraper falló parcialmente
    2 → todos los scrapers fallaron
"""

import argparse
import logging
import sys
from pathlib import Path

# Load .env if running locally (ignored in GitHub Actions)
if Path(".env").exists():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

from scrapers.base import BaseScraper, EvangelioData
from scrapers.dominicos import DominicosScraper
from scrapers.vatican_news import VaticanNewsScraper
from scrapers.vida_nueva import VidaNuevaScraper
from firebase.client import (
    write_evangelio,
    write_info,
    write_lectura1,
    write_lectura2,
    write_salmo,
)
from utils.cleanup import cleanup_old_dates
from utils.date_utils import today_madrid_iso, date_range_iso


# ---------------------------------------------------------------------------
# Scraper factory
# ---------------------------------------------------------------------------

def build_scrapers(*, backfill_dominicos: bool, target_date: str) -> list[BaseScraper]:
    """
    Build the ordered scraper list.

    Order matters: last writer per Firebase key wins.
    Dominicos → VaticanNews → VidaNueva guarantees VidaNueva's activos
    end up as the final value for today's evangelio node.
    """
    if backfill_dominicos:
        fechas = date_range_iso(-30, 30, base=target_date)
        dominicos = DominicosScraper(fechas=fechas, skip_existing=False)
    else:
        fechas = date_range_iso(0, 30, base=target_date)
        dominicos = DominicosScraper(fechas=fechas, skip_existing=True)

    return [dominicos, VaticanNewsScraper(), VidaNuevaScraper()]


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def run(
    target_date: str | None = None,
    *,
    dry_run: bool = False,
    backfill_dominicos: bool = False,
    cleanup_only: bool = False,
) -> int:
    log.info("=" * 60)
    log.info("Scraper Lecturas — inicio")
    if dry_run:
        log.info("MODO DRY-RUN: no se escribirá en Firebase")
    if backfill_dominicos:
        log.info("MODO BACKFILL: Dominicos procesará -30..+30 días")
    log.info("=" * 60)

    if target_date is None:
        target_date = today_madrid_iso()
    log.info(f"Fecha base: {target_date}")

    if cleanup_only:
        deleted = cleanup_old_dates(dry_run=dry_run)
        log.info(f"Cleanup finalizado. Borradas: {deleted}")
        return 0

    scrapers = build_scrapers(backfill_dominicos=backfill_dominicos, target_date=target_date)
    errors = sum(_run_one(s, dry_run=dry_run) for s in scrapers)

    # Always run cleanup at end of nightly cycle
    cleanup_old_dates(dry_run=dry_run)

    log.info("=" * 60)
    return _exit_code(errors, len(scrapers))


def _run_one(scraper: BaseScraper, *, dry_run: bool) -> int:
    """Run a single scraper and write results. Returns error count."""
    name = scraper.__class__.__name__
    errors = 0

    try:
        log.info(f"[{name}] Iniciando…")
        data_list = scraper.fetch()
    except Exception as e:
        log.error(f"[{name}] Error inesperado en fetch: {e}", exc_info=True)
        return 1

    writes = scraper.WRITES_NODES

    for data in data_list:
        if data is None:
            continue

        if not scraper.validate(data):
            missing = [
                f for f in scraper.REQUIRED_FIELDS
                if not getattr(data, f, None)
            ]
            log.warning(
                f"[{name}] Validación fallida {data.fecha}: "
                f"campos faltantes {missing}"
            )
            errors += 1
            continue

        log.info(
            f"[{name}] OK {data.fecha}  "
            f"cita={data.cita!r}  "
            f"comentarista={data.comentarista!r}  "
            f"lectura2={'sí' if data.segunda_lectura else 'no'}"
        )

        try:
            _write_nodes(scraper, data, writes, dry_run=dry_run)
        except Exception as e:
            log.error(f"[{name}] Error escribiendo {data.fecha}: {e}", exc_info=True)
            errors += 1

    return errors


def _write_nodes(
    scraper: BaseScraper,
    data: EvangelioData,
    writes: frozenset[str],
    *,
    dry_run: bool,
) -> None:
    """Call the appropriate write_* functions based on scraper.WRITES_NODES."""

    if "evangelio" in writes:
        payload = scraper.to_evangelio_payload(data)
        _write_or_log("evangelio", data.fecha, payload, dry_run)

    if "info" in writes:
        payload = scraper.to_info_payload(data)
        # Only write info if there's something beyond just the activo key
        if len(payload) > 1:
            _write_or_log("info", data.fecha, payload, dry_run)

    if "lectura1" in writes:
        payload = scraper.to_lectura1_payload(data)
        if payload:
            _write_or_log("lectura1", data.fecha, payload, dry_run)

    if "lectura2" in writes:
        payload = scraper.to_lectura2_payload(data)
        if payload:
            _write_or_log("lectura2", data.fecha, payload, dry_run)

    if "salmo" in writes:
        payload = scraper.to_salmo_payload(data)
        if payload:
            _write_or_log("salmo", data.fecha, payload, dry_run)


def _write_or_log(node: str, fecha: str, payload: dict, dry_run: bool) -> None:
    if dry_run:
        log.info(f"  [dry-run] {node}/{fecha} ({len(payload)} campos):")
        for k, v in payload.items():
            preview = str(v)[:80] + ("…" if len(str(v)) > 80 else "")
            log.info(f"    {k}: {preview}")
    else:
        WRITERS = {
            "evangelio": write_evangelio,
            "info":      write_info,
            "lectura1":  write_lectura1,
            "lectura2":  write_lectura2,
            "salmo":     write_salmo,
        }
        WRITERS[node](fecha, payload)
        log.info(f"  ✓ {node}/{fecha} guardado ({len(payload)} campos)")


def _exit_code(errors: int, total_scrapers: int) -> int:
    if errors == 0:
        log.info("Completado sin errores.")
        return 0
    if errors < total_scrapers:
        log.warning(f"{errors}/{total_scrapers} scrapers fallaron (éxito parcial).")
        return 1
    log.error("TODOS los scrapers fallaron.")
    return 2


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper diario de lecturas del evangelio"
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Fecha base YYYY-MM-DD. Default: hoy en Europe/Madrid.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Hace el scraping pero no escribe en Firebase.",
    )
    parser.add_argument(
        "--backfill-dominicos",
        action="store_true",
        help=(
            "Amplía el rango de Dominicos a -30..+30 días e ignora skip_existing. "
            "Útil para la primera ejecución o tras un gap de datos."
        ),
    )
    parser.add_argument(
        "--cleanup-only",
        action="store_true",
        help="Solo ejecuta la limpieza de fechas antiguas, sin scraping.",
    )
    args = parser.parse_args()

    sys.exit(
        run(
            target_date=args.date,
            dry_run=args.dry_run,
            backfill_dominicos=args.backfill_dominicos,
            cleanup_only=args.cleanup_only,
        )
    )


if __name__ == "__main__":
    main()
