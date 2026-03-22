"""
Orquestador del scraper de lecturas diarias.

Uso:
    python main.py                      # scrape del día de hoy
    python main.py --date 2026-03-15    # scrape de una fecha específica (backfill)
    python main.py --dry-run            # scrape sin escribir en Firebase

Códigos de salida:
    0 → todo OK
    1 → algún scraper falló (éxito parcial)
    2 → todos los scrapers fallaron
"""

import argparse
import logging
import sys
from pathlib import Path

# Load .env if running locally (ignored in GitHub Actions where envs come from secrets)
if Path(".env").exists():
    try:
        from dotenv import load_dotenv
        load_dotenv()
        logging.info("Cargado .env local")
    except ImportError:
        pass  # python-dotenv not installed — acceptable in production

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

from scrapers.vida_nueva import VidaNuevaScraper
from firebase.client import write_evangelio
from utils.date_utils import today_iso

# Register scrapers here. Adding a new source = add one line.
SCRAPERS = [
    VidaNuevaScraper(),
    # Future sources:
    # LoyolaScraper(),
    # CiudadNuevaScraper(),
]


def run(target_date: str | None = None, dry_run: bool = False) -> int:
    log.info("=" * 60)
    log.info("Scraper Lecturas — inicio")
    if dry_run:
        log.info("MODO DRY-RUN: no se escribirá en Firebase")
    log.info("=" * 60)

    errors = 0

    for scraper in SCRAPERS:
        name = scraper.__class__.__name__
        try:
            log.info(f"[{name}] Iniciando...")
            data = scraper.fetch()

            # If a target_date was provided via CLI, warn if there's a mismatch
            if target_date and data.fecha != "unknown" and data.fecha != target_date:
                log.warning(
                    f"[{name}] Fecha del CLI ({target_date}) no coincide con "
                    f"la fecha extraída del sitio ({data.fecha}). "
                    f"Se usa la fecha del sitio como clave de Firebase."
                )

            if data.error and not scraper.validate(data):
                log.error(f"[{name}] Fallo en extracción: {data.error}")
                if not dry_run and data.fecha != "unknown":
                    # Write error state so the app knows this source is unavailable today
                    payload = scraper.to_firebase_payload(data)
                    write_evangelio(data.fecha, payload)
                errors += 1
                continue

            if not scraper.validate(data):
                log.error(f"[{name}] Datos incompletos — cita={data.cita!r}, comentarista={data.comentarista!r}")
                errors += 1
                continue

            payload = scraper.to_firebase_payload(data)

            log.info(f"[{name}] Extracción OK:")
            log.info(f"  fecha:        {data.fecha}")
            log.info(f"  cita:         {data.cita}")
            log.info(f"  comentarista: {data.comentarista}")
            log.info(f"  comentario:   {len(data.comentario or '')} chars")

            if dry_run:
                log.info(f"[{name}] Dry-run: payload que se escribiría:")
                for k, v in payload.items():
                    preview = str(v)[:80] + ("…" if len(str(v)) > 80 else "")
                    log.info(f"  {k}: {preview}")
            else:
                write_evangelio(data.fecha, payload)
                log.info(f"[{name}] Guardado en Firebase ✓")

        except Exception as e:
            log.error(f"[{name}] Error inesperado: {e}", exc_info=True)
            errors += 1

    log.info("=" * 60)
    if errors == 0:
        log.info("Completado sin errores.")
        return 0
    elif errors < len(SCRAPERS):
        log.warning(f"{errors}/{len(SCRAPERS)} scrapers fallaron (éxito parcial).")
        return 1
    else:
        log.error("TODOS los scrapers fallaron.")
        return 2


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scraper diario de lecturas del evangelio"
    )
    parser.add_argument(
        "--date",
        default=None,
        help=(
            "Fecha de referencia (YYYY-MM-DD). Solo se usa para logging/validación. "
            "La fecha real que se guarda en Firebase se extrae del sitio web. "
            "Default: hoy en UTC."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Hace el scraping pero no escribe en Firebase. Útil para pruebas locales.",
    )
    args = parser.parse_args()

    target_date = args.date or today_iso()
    sys.exit(run(target_date=target_date, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
