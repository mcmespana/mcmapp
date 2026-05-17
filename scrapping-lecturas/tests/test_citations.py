"""Unit tests for utils/citations.py — pure functions, no I/O."""

import pytest
from utils.citations import (
    strip_reading_prefix,
    strip_salmo_response,
    strip_body_boilerplate,
    normalize_whitespace,
)

# ---------------------------------------------------------------------------
# strip_reading_prefix
# ---------------------------------------------------------------------------

READING_PREFIX_CASES = [
    # (raw_input, expected_output)
    # --- Evangelio ---
    ("Lectura del santo evangelio según san Juan 3, 7-15", "Juan 3, 7-15"),
    ("Lectura del santo evangelio según san Marcos 16, 15-20", "Marcos 16, 15-20"),
    ("Lectura del santo evangelio según san Lucas 1, 26-38", "Lucas 1, 26-38"),
    ("Lectura del santo Evangelio según san Mateo 5, 1-12", "Mateo 5, 1-12"),
    # --- Hechos ---
    (
        "Lectura del libro de los Hechos de los apóstoles 11, 1-18",
        "Hechos de los apóstoles 11, 1-18",
    ),
    # --- Libro de la / del ---
    ("Lectura del libro de la Sabiduría 7, 7-11", "Sabiduría 7, 7-11"),
    ("Lectura del libro del Génesis 1, 1-31", "Génesis 1, 1-31"),
    ("Lectura del libro del Éxodo 20, 1-17", "Éxodo 20, 1-17"),
    # --- Cartas ---
    (
        "Lectura de la carta del apóstol san Pablo a los Romanos 5, 5-11",
        "apóstol san Pablo a los Romanos 5, 5-11",
    ),
    (
        "Lectura de la primera carta del apóstol san Pedro 1, 3-9",
        "apóstol san Pedro 1, 3-9",
    ),
    (
        "Lectura de la segunda carta de san Pablo a los Corintios 4, 7-15",
        "san Pablo a los Corintios 4, 7-15",
    ),
    # --- Profetas ---
    ("Lectura del profeta Isaías 55, 10-11", "Isaías 55, 10-11"),
    ("Lectura del profeta Jeremías 20, 10-13", "Jeremías 20, 10-13"),
    ("Lectura de la profecía de Ezequiel 37, 12-14", "Ezequiel 37, 12-14"),
    # --- Apocalipsis ---
    ("Lectura del Apocalipsis de san Juan 7, 2-4", "san Juan 7, 2-4"),
    # --- No prefix → unchanged ---
    ("Juan 3, 7-15", "Juan 3, 7-15"),
    ("Hechos de los apóstoles 13, 26-33", "Hechos de los apóstoles 13, 26-33"),
    # --- Leading/trailing whitespace is normalized ---
    (
        "  Lectura del libro de los Hechos de los apóstoles 11, 1-18  ",
        "Hechos de los apóstoles 11, 1-18",
    ),
]


@pytest.mark.parametrize("raw,expected", READING_PREFIX_CASES)
def test_strip_reading_prefix(raw, expected):
    assert strip_reading_prefix(raw) == expected


# ---------------------------------------------------------------------------
# strip_salmo_response
# ---------------------------------------------------------------------------

SALMO_CASES = [
    # (raw_input, expected_output)
    (
        "Salmo 41, 2-3; 42, 3. 4 R/. Mi alma tiene sed de ti, Dios vivo",
        "Salmo 41, 2-3; 42, 3. 4",
    ),
    (
        "Salmo 97, 1-2a. 3-4 R. Ha hecho el Señor maravillas",
        "Salmo 97, 1-2a. 3-4",
    ),
    (
        "Salmo 117 R/. Este es el día que hizo el Señor",
        "Salmo 117",
    ),
    (
        "Salmo 117, 1-2. 16-17. 22-23 R/. Este es el día en que actuó el Señor",
        "Salmo 117, 1-2. 16-17. 22-23",
    ),
    # Preserves "Salmo" prefix
    ("Salmo 22", "Salmo 22"),
    # No R/ → unchanged
    ("97, 1-2a. 3-4", "97, 1-2a. 3-4"),
    # Short form without salmo label
    ("41, 2-3 R/. Mi alma tiene sed", "41, 2-3"),
]


@pytest.mark.parametrize("raw,expected", SALMO_CASES)
def test_strip_salmo_response(raw, expected):
    assert strip_salmo_response(raw) == expected


# ---------------------------------------------------------------------------
# strip_body_boilerplate
# ---------------------------------------------------------------------------

BOILERPLATE_CASES = [
    ("En aquellos días...\nPalabra de Dios.", "En aquellos días..."),
    ("En aquel tiempo...\nPalabra del Señor.", "En aquel tiempo..."),
    ("Texto del evangelio.\nGloria a ti, Señor Jesús.", "Texto del evangelio."),
    ("Texto.\nDemos gracias a Dios.", "Texto."),
    # No boilerplate → unchanged
    ("Texto sin boilerplate", "Texto sin boilerplate"),
    # Case-insensitive
    ("Texto.\nPALABRA DE DIOS.", "Texto."),
]


@pytest.mark.parametrize("raw,expected", BOILERPLATE_CASES)
def test_strip_body_boilerplate(raw, expected):
    assert strip_body_boilerplate(raw) == expected


# ---------------------------------------------------------------------------
# normalize_whitespace
# ---------------------------------------------------------------------------


def test_normalize_whitespace_spaces():
    assert normalize_whitespace("  hello   world  ") == "hello world"


def test_normalize_whitespace_tabs():
    assert normalize_whitespace("hello\t\tworld") == "hello world"


def test_normalize_whitespace_preserves_newlines():
    assert normalize_whitespace("hello\n  world") == "hello\n world"


def test_normalize_whitespace_empty():
    assert normalize_whitespace("   ") == ""
