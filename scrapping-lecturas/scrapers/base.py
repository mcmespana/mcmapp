"""Base classes and data models for all lecturas scrapers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class EvangelioData:
    """Data extracted from a single day's gospel/readings page."""

    # Required
    url: str
    fecha: str  # YYYY-MM-DD (extracted from page, not from CLI)

    # Gospel content
    cita: Optional[str] = None              # "Juan 7,40-53"
    evangelio_texto: Optional[str] = None   # Full gospel text (plain, \n\n between paragraphs)
    comentario: Optional[str] = None        # Commentary text
    comentarista: Optional[str] = None      # "Pedro Fraile Yécora"

    # Liturgical metadata → info/ node
    titulo: Optional[str] = None
    dia_liturgico: Optional[str] = None     # Saints of the day
    primera_lectura: Optional[str] = None   # Reading 1 citation
    segunda_lectura: Optional[str] = None   # Reading 2 citation (Sundays only)
    salmo: Optional[str] = None             # Psalm citation

    # Reading body texts → lectura1/, lectura2/, salmo/ nodes
    primera_lectura_texto: Optional[str] = None
    segunda_lectura_texto: Optional[str] = None
    salmo_texto: Optional[str] = None

    # Error tracking
    error: Optional[str] = None             # Set if extraction failed


class BaseScraper(ABC):
    """Abstract base class for all lecturas scrapers."""

    SOURCE_KEY: str = ""
    SOURCE_URL: str = ""

    # Subclasses override to declare their minimum valid fields.
    REQUIRED_FIELDS: tuple[str, ...] = ("cita", "comentario", "comentarista")

    # Which Firebase nodes this scraper writes to.
    # main.py uses this to call only the relevant write_* functions.
    WRITES_NODES: frozenset[str] = frozenset({"evangelio", "info"})

    @abstractmethod
    def fetch(self) -> list[EvangelioData]:
        """Fetch and parse. Returns validated data (error items excluded)."""
        ...

    def validate(self, data: EvangelioData) -> bool:
        """True iff all REQUIRED_FIELDS are non-empty strings."""
        for field_name in self.REQUIRED_FIELDS:
            value = getattr(data, field_name, None)
            if value is None or not str(value).strip():
                return False
        return True

    # ------------------------------------------------------------------
    # Payload builders
    # Each builder only writes fields the scraper actually provides,
    # plus the appropriate activo* selectors.
    # ------------------------------------------------------------------

    def to_evangelio_payload(self, data: EvangelioData) -> dict:
        """
        Fields for the evangelio/ node.

        Uses two granular selectors instead of a single 'activo':
          activoTexto     → which source provided cita + EvangelioTexto + URL
          activoComentario → which source provided Comentario + Comentarista

        Each scraper only writes the selectors it has data for.
        Last writer per key wins (Firebase ref.update() merges).
        """
        k = self.SOURCE_KEY
        payload: dict = {
            f"{k}URL": data.url,
            f"{k}LastUpdated": _now_iso(),
        }
        if data.cita:
            payload[f"{k}Cita"] = data.cita
        if data.evangelio_texto:
            payload[f"{k}EvangelioTexto"] = data.evangelio_texto
        if data.comentario:
            payload[f"{k}Comentario"] = data.comentario
        if data.comentarista:
            payload[f"{k}Comentarista"] = data.comentarista
        if data.error:
            payload[f"{k}Error"] = data.error

        # Only write activo selectors when we actually have the relevant data
        if data.cita or data.evangelio_texto:
            payload["activoTexto"] = k
        if data.comentario:
            payload["activoComentario"] = k

        return payload

    def to_lectura1_payload(self, data: EvangelioData) -> dict | None:
        """Fields for the lectura1/ node. None if no data."""
        if not data.primera_lectura and not data.primera_lectura_texto:
            return None
        k = self.SOURCE_KEY
        payload: dict = {"activo": k}
        if data.primera_lectura:
            payload[f"{k}Cita"] = data.primera_lectura
        if data.primera_lectura_texto:
            payload[f"{k}Texto"] = data.primera_lectura_texto
        return payload

    def to_lectura2_payload(self, data: EvangelioData) -> dict | None:
        """Fields for the lectura2/ node. None if no data."""
        if not data.segunda_lectura and not data.segunda_lectura_texto:
            return None
        k = self.SOURCE_KEY
        payload: dict = {"activo": k}
        if data.segunda_lectura:
            payload[f"{k}Cita"] = data.segunda_lectura
        if data.segunda_lectura_texto:
            payload[f"{k}Texto"] = data.segunda_lectura_texto
        return payload

    def to_salmo_payload(self, data: EvangelioData) -> dict | None:
        """Fields for the salmo/ node. None if no data."""
        if not data.salmo and not data.salmo_texto:
            return None
        k = self.SOURCE_KEY
        payload: dict = {"activo": k}
        if data.salmo:
            payload[f"{k}Cita"] = data.salmo
        if data.salmo_texto:
            payload[f"{k}Texto"] = data.salmo_texto
        return payload

    def to_info_payload(self, data: EvangelioData) -> dict:
        """
        Fields for the info/ node (liturgical metadata).

        Uses a single 'activo' selector — same source provides all metadata
        fields in this node (unlike evangelio/ which mixes sources).
        """
        k = self.SOURCE_KEY
        payload: dict = {"activo": k}
        if data.cita:
            payload[f"{k}Evangelio"] = data.cita
        if data.titulo:
            payload[f"{k}Titulo"] = data.titulo
        if data.dia_liturgico:
            payload[f"{k}DiaLiturgico"] = data.dia_liturgico
        if data.primera_lectura:
            payload[f"{k}PrimeraLectura"] = data.primera_lectura
        if data.segunda_lectura:
            payload[f"{k}SegundaLectura"] = data.segunda_lectura
        if data.salmo:
            payload[f"{k}Salmo"] = data.salmo
        return payload


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
