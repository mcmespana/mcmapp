"""Unit tests for scrapers/dominicos.py — parsing only, no HTTP."""

from pathlib import Path
from unittest.mock import patch

import pytest

from scrapers.dominicos import DominicosScraper

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def scraper():
    """Scraper configured for a single test date, skip_existing=False."""
    return DominicosScraper(fechas=["2026-04-12"], skip_existing=False)


@pytest.fixture
def weekday_html():
    return (FIXTURES / "dominicos_weekday.html").read_text(encoding="utf-8")


@pytest.fixture
def sunday_html():
    return (FIXTURES / "dominicos_sunday.html").read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Weekday parsing
# ---------------------------------------------------------------------------

class TestWeekdayParsing:
    def test_evangelio_cita_cleaned(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        # "Lectura del santo evangelio según san Juan 3, 7-15" → "Juan 3, 7-15"
        assert data.cita == "Juan 3, 7-15"

    def test_evangelio_texto_present(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert data.evangelio_texto is not None
        assert "Nicodemo" in data.evangelio_texto

    def test_evangelio_texto_no_boilerplate(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert "Palabra del Señor" not in (data.evangelio_texto or "")

    def test_lectura1_cita_cleaned(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        # "Lectura del libro de los Hechos de los apóstoles 11, 1-18"
        # → "Hechos de los apóstoles 11, 1-18"
        assert data.primera_lectura == "Hechos de los apóstoles 11, 1-18"

    def test_lectura1_texto_present(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert data.primera_lectura_texto is not None
        assert "Pedro" in data.primera_lectura_texto

    def test_lectura1_texto_no_boilerplate(self, scraper, weekday_html):
        # "Palabra de Dios" may appear inside the reading text itself;
        # what we assert is that the TRAILING boilerplate line is stripped.
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        texto = (data.primera_lectura_texto or "").rstrip()
        assert not texto.endswith("Palabra de Dios.")

    def test_salmo_cita_response_stripped(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        # "Salmo 41, 2-3; 42, 3. 4 R/. Mi alma tiene sed de ti, Dios vivo"
        # → "Salmo 41, 2-3; 42, 3. 4"
        assert data.salmo == "Salmo 41, 2-3; 42, 3. 4"

    def test_salmo_texto_present(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert data.salmo_texto is not None
        assert "ciervo" in data.salmo_texto

    def test_no_segunda_lectura_on_weekday(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert data.segunda_lectura is None
        assert data.segunda_lectura_texto is None

    def test_no_comentario_fields(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert data.comentario is None
        assert data.comentarista is None

    def test_fecha_preserved(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert data.fecha == "2026-04-12"

    def test_validate_passes(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        assert scraper.validate(data)


# ---------------------------------------------------------------------------
# Sunday parsing (has segunda lectura)
# ---------------------------------------------------------------------------

class TestSundayParsing:
    def test_evangelio_cita(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        assert data.cita == "Juan 20, 1-9"

    def test_lectura1_cita(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        # Fixture: "Lectura de los Hechos de los Apóstoles 10, 34a. 37-43"
        # strip_reading_prefix removes "Lectura de los "
        assert data.primera_lectura == "Hechos de los Apóstoles 10, 34a. 37-43"

    def test_salmo_cleaned(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        assert data.salmo == "Salmo 117, 1-2. 16-17. 22-23"

    def test_segunda_lectura_present(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        assert data.segunda_lectura is not None
        assert "Colosenses 3, 1-4" in data.segunda_lectura

    def test_segunda_lectura_texto_present(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        assert data.segunda_lectura_texto is not None
        assert "resucitado" in data.segunda_lectura_texto

    def test_segunda_lectura_no_boilerplate(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        assert "Palabra de Dios" not in (data.segunda_lectura_texto or "")

    def test_validate_passes(self, scraper, sunday_html):
        data = scraper._parse_page(sunday_html, "https://example.com", "2026-04-26")
        assert scraper.validate(data)


# ---------------------------------------------------------------------------
# URL building
# ---------------------------------------------------------------------------

class TestUrlBuilding:
    def test_weekday_url_no_zero_pad(self):
        url = DominicosScraper._weekday_url("2026-04-05")
        assert url == "https://www.dominicos.org/predicacion/evangelio-del-dia/5-4-2026/"

    def test_weekday_url_double_digit(self):
        url = DominicosScraper._weekday_url("2026-12-25")
        assert url == "https://www.dominicos.org/predicacion/evangelio-del-dia/25-12-2026/"

    def test_sunday_url(self):
        url = DominicosScraper._sunday_url("2026-04-26")
        assert url == "https://www.dominicos.org/predicacion/homilia/26-4-2026/lecturas/"


# ---------------------------------------------------------------------------
# Payload selectors
# ---------------------------------------------------------------------------

class TestPayloadSelectors:
    def test_evangelio_payload_sets_activoTexto(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        payload = scraper.to_evangelio_payload(data)
        assert payload.get("activoTexto") == "dominicos"

    def test_evangelio_payload_no_activoComentario(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        payload = scraper.to_evangelio_payload(data)
        assert "activoComentario" not in payload

    def test_lectura1_payload_has_activo(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        payload = scraper.to_lectura1_payload(data)
        assert payload is not None
        assert payload.get("activo") == "dominicos"

    def test_salmo_payload_has_cita_and_texto(self, scraper, weekday_html):
        data = scraper._parse_page(weekday_html, "https://example.com", "2026-04-12")
        payload = scraper.to_salmo_payload(data)
        assert payload is not None
        assert "dominicosCita" in payload
        assert "dominicosTexto" in payload
