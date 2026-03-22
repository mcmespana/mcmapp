"""Firebase Admin SDK client for writing lecturas data."""

import json
import logging
import os
import time

import firebase_admin
from firebase_admin import credentials, db

log = logging.getLogger(__name__)

_app: firebase_admin.App | None = None


def _get_app() -> firebase_admin.App:
    global _app
    if _app is not None:
        return _app

    service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    database_url = os.environ.get("FIREBASE_DATABASE_URL")

    if not service_account_json:
        raise EnvironmentError(
            "FIREBASE_SERVICE_ACCOUNT_JSON no está configurado. "
            "Copia .env.example a .env y rellena las credenciales."
        )
    if not database_url:
        raise EnvironmentError(
            "FIREBASE_DATABASE_URL no está configurado."
        )

    cred_dict = json.loads(service_account_json)
    cred = credentials.Certificate(cred_dict)
    _app = firebase_admin.initialize_app(cred, {"databaseURL": database_url})
    log.info(f"[Firebase] Conectado a {database_url}")
    return _app


def write_evangelio(fecha: str, payload: dict, retries: int = 2) -> None:
    """
    Write (merge) data into seccion_oracion/lecturas/{fecha}/evangelio.

    Uses update() instead of set() so multiple scrapers writing to the same
    date node don't overwrite each other's fields.

    Args:
        fecha:   YYYY-MM-DD string, used as the date node key.
        payload: Dict of fields to write (e.g. vidaNuevaComentario, vidaNuevaCita, …)
        retries: Number of extra attempts on transient Firebase errors.
    """
    _get_app()
    path = f"seccion_oracion/lecturas/{fecha}/evangelio"

    for attempt in range(1, retries + 2):
        try:
            ref = db.reference(path)
            ref.update(payload)
            log.info(f"[Firebase] Escrito en {path} ({len(payload)} campos)")
            return
        except Exception as e:
            if attempt <= retries:
                wait = 5 * attempt
                log.warning(f"[Firebase] Error en intento {attempt}: {e}. Reintentando en {wait}s…")
                time.sleep(wait)
            else:
                log.error(f"[Firebase] Falló tras {attempt} intentos: {e}")
                raise
