"""
Citation cleaning utilities for liturgical readings.

Pure functions — no I/O, no dependencies outside stdlib — so they can be
unit-tested cheaply and reused across scrapers.
"""

import re

# Ordered longest-first to prevent shorter prefixes from matching first.
_READING_PREFIXES: tuple[str, ...] = (
    "Lectura del santo evangelio según san ",
    "Lectura del santo evangelio según ",
    "Lectura del santo Evangelio según san ",
    "Lectura del santo Evangelio según ",
    "Lectura del libro de las ",
    "Lectura del libro de los ",
    "Lectura de los ",
    "Lectura del libro de la ",
    "Lectura del libro del ",
    "Lectura del libro de ",
    "Lectura de la primera carta del ",
    "Lectura de la primera carta de ",
    "Lectura de la primera Carta del ",
    "Lectura de la primera Carta de ",
    "Lectura de la segunda carta del ",
    "Lectura de la segunda carta de ",
    "Lectura de la segunda Carta del ",
    "Lectura de la segunda Carta de ",
    "Lectura de la tercera carta del ",
    "Lectura de la tercera carta de ",
    "Lectura de la carta del ",
    "Lectura de la carta de ",
    "Lectura de la Carta del ",
    "Lectura de la Carta de ",
    "Lectura de la profecía de ",
    "Lectura de la profecia de ",
    "Lectura del profeta ",
    "Lectura del Apocalipsis de ",
)

# Matches " R/.", " R.", " R/" and everything after (including newlines).
_SALMO_RESPONSE_RE = re.compile(r"\s+R[/.]\.?\s.*$", re.DOTALL)

# Boilerplate closing lines appended by liturgical sites.
_BODY_TAIL_RE = re.compile(
    r"\n?\s*(?:"
    r"Palabra de Dios"
    r"|Palabra del Señor"
    r"|Gloria a ti,\s*Señor\s*Jesús"
    r"|Demos gracias a Dios"
    r")[.\s]*$",
    re.IGNORECASE,
)


def strip_reading_prefix(raw: str) -> str:
    """
    Remove the canonical liturgical heading from a reading citation.

    Examples
    --------
    "Lectura del libro de los Hechos de los apóstoles 11, 1-18"
      → "Hechos de los apóstoles 11, 1-18"

    "Lectura del santo evangelio según san Juan 3, 7-15"
      → "Juan 3, 7-15"

    Unknown prefix → original string unchanged.
    """
    normalized = normalize_whitespace(raw)
    lower = normalized.lower()
    for prefix in _READING_PREFIXES:
        if lower.startswith(prefix.lower()):
            return normalized[len(prefix):]
    return normalized


def strip_salmo_response(raw: str) -> str:
    """
    Remove the responsorial antiphon label ("R/.") and everything after it.

    "Salmo 41, 2-3; 42, 3. 4 R/. Mi alma tiene sed de ti, Dios vivo"
      → "Salmo 41, 2-3; 42, 3. 4"

    "97, 1-2a. 3-4"  (no R/) → unchanged.

    The "Salmo" prefix is preserved if present.
    """
    cleaned = _SALMO_RESPONSE_RE.sub("", normalize_whitespace(raw))
    return cleaned.rstrip(" .,;")


def strip_body_boilerplate(text: str) -> str:
    """
    Remove liturgical closing phrases from reading body text.

    "…recibieron la Palabra de Dios.\nPalabra de Dios."
      → "…recibieron la Palabra de Dios."
    """
    return _BODY_TAIL_RE.sub("", text).rstrip()


def normalize_whitespace(text: str) -> str:
    """Collapse runs of spaces/tabs and strip; preserve newlines."""
    result = re.sub(r"[ \t]+", " ", text)
    return result.strip()
