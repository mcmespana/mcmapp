"""Base classes and data models for all lecturas scrapers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EvangelioData:
    """Data extracted from a single day's gospel commentary page."""

    # Required fields
    url: str
    fecha: str  # YYYY-MM-DD (extracted from page, not from CLI)

    # Gospel content
    cita: Optional[str] = None           # "Juan 7,40-53, o bien: 9,1-41"
    evangelio_texto: Optional[str] = None  # Full gospel text before commentary
    comentario: Optional[str] = None     # Commentary text (plain text)

    # Author
    comentarista: Optional[str] = None   # "Pedro Fraile Yécora"

    # Bonus metadata (extracted at no extra cost)
    titulo: Optional[str] = None         # Title of the commentary
    primera_lectura: Optional[str] = None
    salmo: Optional[str] = None
    santos: Optional[str] = None         # Saints of the day

    # Error tracking
    error: Optional[str] = None          # Set if extraction failed


class BaseScraper(ABC):
    """Abstract base class for all lecturas scrapers."""

    SOURCE_KEY: str = ""   # e.g. "vidaNueva", "loyola"
    SOURCE_URL: str = ""   # canonical URL to scrape

    @abstractmethod
    def fetch(self) -> EvangelioData:
        """Fetch and parse the page. Returns EvangelioData (with error set if failed)."""
        ...

    def validate(self, data: EvangelioData) -> bool:
        """Returns True if the minimum required fields are present."""
        required = [data.cita, data.comentario, data.comentarista]
        return all(f is not None and f.strip() for f in required)

    def to_firebase_payload(self, data: EvangelioData) -> dict:
        """
        Convert EvangelioData to a Firebase Realtime Database payload.

        Uses the source key as a prefix for all fields so multiple sources
        can coexist in the same evangelio/ node without overwriting each other.
        """
        k = self.SOURCE_KEY
        payload = {
            "activo": k,
            f"{k}URL": data.url,
            f"{k}LastUpdated": _now_iso(),
        }

        if data.cita:
            payload[f"{k}Cita"] = data.cita
        if data.comentario:
            payload[f"{k}Comentario"] = data.comentario
        if data.comentarista:
            payload[f"{k}Comentarista"] = data.comentarista
        if data.evangelio_texto:
            payload[f"{k}EvangelioTexto"] = data.evangelio_texto
        if data.titulo:
            payload[f"{k}Titulo"] = data.titulo
        if data.primera_lectura:
            payload[f"{k}PrimeraLectura"] = data.primera_lectura
        if data.salmo:
            payload[f"{k}Salmo"] = data.salmo
        if data.santos:
            payload[f"{k}Santos"] = data.santos
        if data.error:
            payload[f"{k}Error"] = data.error

        return payload


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
