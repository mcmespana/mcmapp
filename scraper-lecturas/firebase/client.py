"""Firebase Admin SDK client for writing and reading lecturas data."""

import json
import logging
import os
import time

import firebase_admin
import requests as http_requests
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
        raise EnvironmentError("FIREBASE_DATABASE_URL no está configurado.")

    cred_dict = json.loads(service_account_json)
    cred = credentials.Certificate(cred_dict)
    _app = firebase_admin.initialize_app(cred, {"databaseURL": database_url})
    log.info(f"[Firebase] Conectado a {database_url}")
    return _app


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------

def write_evangelio(fecha: str, payload: dict, retries: int = 2) -> None:
    _write(f"seccion_oracion/lecturas/{fecha}/evangelio", payload, retries)


def write_lectura1(fecha: str, payload: dict, retries: int = 2) -> None:
    _write(f"seccion_oracion/lecturas/{fecha}/lectura1", payload, retries)


def write_lectura2(fecha: str, payload: dict, retries: int = 2) -> None:
    _write(f"seccion_oracion/lecturas/{fecha}/lectura2", payload, retries)


def write_salmo(fecha: str, payload: dict, retries: int = 2) -> None:
    """Write (merge) data into seccion_oracion/lecturas/{fecha}/salmo."""
    _write(f"seccion_oracion/lecturas/{fecha}/salmo", payload, retries)


def write_info(fecha: str, payload: dict, retries: int = 2) -> None:
    _write(f"seccion_oracion/lecturas/{fecha}/info", payload, retries)


def _write(path: str, payload: dict, retries: int) -> None:
    """Shared retry logic for all Firebase writes."""
    _get_app()
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


# ---------------------------------------------------------------------------
# Read / query helpers (used by cleanup and dominicos skip-existing)
# ---------------------------------------------------------------------------

def get_existing_dominicos_dates(fechas: list[str]) -> set[str]:
    """
    Return the subset of *fechas* where dominicosLastUpdated already exists
    in Firebase. Used by DominicosScraper to skip dates already scraped.
    """
    _get_app()
    existing: set[str] = set()
    for fecha in fechas:
        try:
            val = db.reference(
                f"seccion_oracion/lecturas/{fecha}/evangelio/dominicosLastUpdated"
            ).get()
            if val is not None:
                existing.add(fecha)
        except Exception as e:
            log.warning(f"[Firebase] Error comprobando {fecha}: {e}")
    return existing


def list_lectura_dates() -> list[str]:
    """
    Return all YYYY-MM-DD keys under seccion_oracion/lecturas/.

    Uses the REST API with ?shallow=true for efficiency (avoids downloading
    all reading content just to list dates). Falls back to a full read if
    the REST call fails.
    """
    _get_app()
    database_url = os.environ.get("FIREBASE_DATABASE_URL", "").rstrip("/")

    # --- Try REST shallow query first ---
    try:
        token = firebase_admin.get_app().credential.get_access_token().access_token
        url = f"{database_url}/seccion_oracion/lecturas.json?shallow=true"
        resp = http_requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return sorted(data.keys()) if data else []
    except Exception as e:
        log.warning(f"[Firebase] Shallow REST query fallida ({e}), usando lectura completa…")

    # --- Fallback: full read (only ~60 nodes in steady state, acceptable) ---
    try:
        data = db.reference("seccion_oracion/lecturas").get() or {}
        return sorted(data.keys())
    except Exception as e:
        log.error(f"[Firebase] No se pudieron listar fechas: {e}")
        return []


def delete_lectura_date(fecha: str) -> None:
    """Delete seccion_oracion/lecturas/{fecha} and all its children."""
    _get_app()
    try:
        db.reference(f"seccion_oracion/lecturas/{fecha}").delete()
        log.info(f"[Firebase] Eliminada lectura {fecha}")
    except Exception as e:
        log.error(f"[Firebase] Error eliminando {fecha}: {e}")
        raise
